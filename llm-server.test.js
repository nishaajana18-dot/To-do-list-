/** @jest-environment node */

const http = require('http');

let apiServer;
let ollamaServer;
let apiBaseUrl;

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function postPrompt(prompt, timeoutMs) {
  const response = await fetch(`${apiBaseUrl}/api/infer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, timeoutMs })
  });

  return { response, body: await response.json() };
}

async function waitForTerminal(jobId) {
  const deadline = Date.now() + 2000;

  while (Date.now() < deadline) {
    const response = await fetch(`${apiBaseUrl}/api/infer/${jobId}`);
    const job = await response.json();
    if (['completed', 'failed', 'timed_out'].includes(job.status)) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`Job ${jobId} did not reach a terminal state`);
}

beforeAll(async () => {
  // This deterministic upstream behaves like Ollama but never needs a real model.
  ollamaServer = http.createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      const payload = JSON.parse(body);
      const delayMs = payload.prompt === 'slow prompt' ? 100 : 5;
      setTimeout(() => {
        if (!response.writableEnded) {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ response: `answer: ${payload.prompt}` }));
        }
      }, delayMs);
    });
  });

  const ollamaPort = await listen(ollamaServer);
  process.env.OLLAMA_URL = `http://127.0.0.1:${ollamaPort}/api/generate`;
  process.env.OLLAMA_TIMEOUT_MS = '40';
  process.env.MAX_REQUEST_TIMEOUT_MS = '50';

  jest.resetModules();
  const { app } = require('./llm-server/server');
  apiServer = http.createServer(app);
  const apiPort = await listen(apiServer);
  apiBaseUrl = `http://127.0.0.1:${apiPort}`;
});

afterAll(async () => {
  await close(apiServer);
  await close(ollamaServer);
  delete process.env.OLLAMA_URL;
  delete process.env.OLLAMA_TIMEOUT_MS;
  delete process.env.MAX_REQUEST_TIMEOUT_MS;
});

test('serves nested result pages with absolute asset paths', async () => {
  const response = await fetch(`${apiBaseUrl}/llm-job/example-job`);
  const html = await response.text();

  expect(response.status).toBe(200);
  expect(html).toContain('href="/style.css?v=4"');
  expect(html).toContain('src="/llm-job.js?v=4"');
});

test('serves browser submit page with absolute asset paths', async () => {
  const response = await fetch(`${apiBaseUrl}/llm-submit`);
  const html = await response.text();

  expect(response.status).toBe(200);
  expect(html).toContain('href="/style.css?v=5"');
  expect(html).toContain('src="/llm-submit.js?v=5"');
});

test('rejects missing prompts and malformed JSON', async () => {
  const missingPrompt = await fetch(`${apiBaseUrl}/api/infer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  const malformed = await fetch(`${apiBaseUrl}/api/infer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not-json}'
  });

  expect(missingPrompt.status).toBe(400);
  expect(malformed.status).toBe(400);
});

test('assigns sequential numbers and eventually returns responses', async () => {
  const first = await postPrompt('first prompt', 30);
  const firstResult = await waitForTerminal(first.body.jobId);
  const second = await postPrompt('second prompt', 30);
  const secondResult = await waitForTerminal(second.body.jobId);

  expect(first.response.status).toBe(202);
  expect(first.body.requestNumber).toBe(1);
  expect(firstResult.status).toBe('completed');
  expect(firstResult.response).toBe('answer: first prompt');
  expect(second.body.requestNumber).toBe(2);
  expect(secondResult.response).toBe('answer: second prompt');
});

test('caps requested timeouts at the configured maximum', async () => {
  const created = await postPrompt('capped prompt', 5000);
  const result = await waitForTerminal(created.body.jobId);

  expect(created.body.timeoutMs).toBe(50);
  expect(result.status).toBe('completed');
});

test('marks model calls timed_out when their specific limit expires', async () => {
  const created = await postPrompt('slow prompt', 10);
  const result = await waitForTerminal(created.body.jobId);

  expect(created.body.timeoutMs).toBe(10);
  expect(result.status).toBe('timed_out');
  expect(result.error).toContain('timed out after 10ms');
  expect(result.response).toBeNull();
});
