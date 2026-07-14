/** @jest-environment jsdom */

function setupDom() {
  document.body.innerHTML = `
    <main id="llm-submit-app">
      <form id="llm-submit-form">
        <textarea id="prompt-input" required></textarea>
        <span id="character-count">0 characters</span>
        <button type="submit" id="submit-prompt-btn">Submit prompt</button>
      </form>
      <section id="submit-status"></section>
      <section id="submit-result" hidden>
        <p id="active-prompt"></p>
        <p id="submit-result-details"></p>
        <a id="result-link" href="#">View live response</a>
        <a id="status-link" href="#">Open raw status</a>
      </section>
      <button id="refresh-jobs-btn" type="button">Refresh</button>
      <div id="recent-jobs"></div>
    </main>
  `;
}

function response(body, ok = true) {
  return Promise.resolve({ ok, json: async () => body });
}

function loadSubmitPage(fetchImpl) {
  jest.resetModules();
  setupDom();
  window.fetch = fetchImpl;
  require('./llm-submit.js');
}

function submitPrompt(prompt) {
  document.getElementById('prompt-input').value = prompt;
  document.getElementById('llm-submit-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

async function flushAsync() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('llm submit page', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  test('keeps an accepted prompt and its live response link visible', async () => {
    const fetchMock = jest.fn((url, options) => {
      if (url === '/api/infer' && options?.method === 'POST') {
        return response({
          jobId: 'job-123',
          requestNumber: 3,
          resultPage: '/llm-job/job-123',
          statusPageUrl: 'http://localhost:3001/llm-job/job-123',
          statusUrl: '/api/infer/job-123',
          statusApiUrl: 'http://localhost:3001/api/infer/job-123'
        });
      }
      return response({ jobs: [] });
    });

    loadSubmitPage(fetchMock);
    submitPrompt('Write a short poem.');
    await flushAsync();

    const postCall = fetchMock.mock.calls.find(([url]) => url === '/api/infer');
    expect(JSON.parse(postCall[1].body)).toEqual({ prompt: 'Write a short poem.' });
    expect(document.getElementById('submit-status').textContent).toContain('Prompt accepted');
    expect(document.getElementById('submit-result').hidden).toBe(false);
    expect(document.getElementById('active-prompt').textContent).toBe('Write a short poem.');
    expect(document.getElementById('result-link').href).toBe('http://localhost:3001/llm-job/job-123');
    expect(document.getElementById('status-link').href).toBe('http://localhost:3001/api/infer/job-123');
  });

  test('loads recent prompts with links to their response pages', async () => {
    const fetchMock = jest.fn().mockImplementation(() => response({
      jobs: [{
        jobId: 'job-456',
        requestNumber: 8,
        prompt: 'Explain gravity.',
        status: 'completed',
        createdAt: Date.now(),
        resultPage: '/llm-job/job-456'
      }]
    }));

    loadSubmitPage(fetchMock);
    await flushAsync();

    expect(document.getElementById('recent-jobs').textContent).toContain('Explain gravity.');
    expect(document.getElementById('recent-jobs').textContent).toContain('Answer ready');
    expect(document.querySelector('#recent-jobs a').getAttribute('href')).toBe('/llm-job/job-456');
  });

  test('validates empty prompts before posting a request', async () => {
    const fetchMock = jest.fn().mockImplementation(() => response({ jobs: [] }));
    loadSubmitPage(fetchMock);
    await flushAsync();
    fetchMock.mockClear();

    submitPrompt('   ');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.getElementById('submit-status').textContent).toBe('Enter a prompt before submitting.');
  });

  test('shows request errors from the API', async () => {
    const fetchMock = jest.fn((url, options) => {
      if (options?.method === 'POST') {
        return response({ error: 'Inference queue is full', details: 'Queue currently at max capacity.' }, false);
      }
      return response({ jobs: [] });
    });

    loadSubmitPage(fetchMock);
    submitPrompt('Explain gravity.');
    await flushAsync();

    expect(document.getElementById('submit-status').textContent).toContain('Inference queue is full');
    expect(document.getElementById('submit-status').textContent).toContain('max capacity');
  });
});
