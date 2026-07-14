/** @jest-environment jsdom */

function setupDom() {
  document.body.innerHTML = `
    <main id="llm-submit-app" class="panel">
      <form id="llm-submit-form" class="prompt-form">
        <textarea id="prompt-input" rows="6" required></textarea>
        <button type="submit" id="submit-prompt-btn">Queue Prompt</button>
      </form>
      <section id="submit-status" class="job-status" aria-live="polite"></section>
      <section id="submit-result" class="job-block" hidden>
        <pre id="submit-result-details"></pre>
        <a id="result-link" href="#">Open result page</a>
        <a id="status-link" href="#">Open JSON status</a>
      </section>
    </main>
  `;
}

function loadSubmitPage(fetchImpl = jest.fn()) {
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
}

describe('llm submit page', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete window.__llmNavigateTo;
    document.body.innerHTML = '';
  });

  test('submits prompt, renders job links, and redirects to the live status page', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jobId: 'job-123',
        requestNumber: 3,
        timeoutMs: 45000,
        resultPage: '/llm-job/job-123',
        statusPageUrl: 'http://localhost:3001/llm-job/job-123',
        statusUrl: '/api/infer/job-123',
        statusApiUrl: 'http://localhost:3001/api/infer/job-123',
        queue: { queued: 1, active: 1 }
      })
    });
    const assignMock = jest.fn();
    window.__llmNavigateTo = assignMock;

    loadSubmitPage(fetchMock);
    submitPrompt('Write a short poem.');
    await flushAsync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/infer');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      prompt: 'Write a short poem.'
    });
    expect(document.getElementById('submit-status').textContent).toContain('Opening the live status page now');
    expect(document.getElementById('submit-result').hidden).toBe(false);
    expect(document.getElementById('submit-result-details').textContent).toContain('http://localhost:3001/llm-job/job-123');
    expect(document.getElementById('result-link').getAttribute('href')).toBe('http://localhost:3001/llm-job/job-123');
    expect(document.getElementById('status-link').getAttribute('href')).toBe('http://localhost:3001/api/infer/job-123');

    jest.advanceTimersByTime(1200);
    expect(assignMock).toHaveBeenCalledWith('http://localhost:3001/llm-job/job-123');
  });

  test('validates empty prompts before making a request', () => {
    const fetchMock = jest.fn();

    loadSubmitPage(fetchMock);
    submitPrompt('   ');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.getElementById('submit-status').textContent).toBe('Prompt is required.');
  });

  test('shows request errors from the API', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'Inference queue is full',
        details: 'Queue currently at max capacity.'
      })
    });

    loadSubmitPage(fetchMock);
    submitPrompt('Explain gravity.');
    await flushAsync();

    expect(document.getElementById('submit-status').textContent).toContain('Inference queue is full');
    expect(document.getElementById('submit-status').textContent).toContain('max capacity');
  });
});
