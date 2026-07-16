/** @jest-environment jsdom */

function setupDom() {
  document.body.innerHTML = `
    <main id="llm-job-app" class="panel">
      <p id="job-id-label"></p>
      <button id="refresh-job-btn" type="button">Refresh status</button>
      <section id="job-status" class="job-status"></section>
      <div id="conversation">
        <pre id="job-prompt"></pre>
        <pre id="job-response"></pre>
      </div>
      <pre id="job-queue"></pre>
      <section id="follow-up-section" hidden>
        <form id="follow-up-form">
          <textarea id="follow-up-input"></textarea>
          <button id="follow-up-btn" type="submit">Ask follow-up</button>
        </form>
        <p id="follow-up-status"></p>
        <a id="follow-up-link" href="#" hidden>View follow-up</a>
      </section>
    </main>
  `;
}

function setLocation(pathname = '/llm-job/job-123', search = '') {
  window.history.replaceState({}, '', `${pathname}${search}`);
}

async function loadJobPage(fetchImpl = jest.fn()) {
  jest.resetModules();
  setupDom();
  setLocation();
  window.fetch = fetchImpl;
  require('./llm-job.js');
  await Promise.resolve();
}

describe('llm job page', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  test('renders completed responses with the prompt number', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jobId: 'job-123',
        requestNumber: 7,
        status: 'completed',
        prompt: 'Say hello.',
        response: 'Hello there.',
        timeoutMs: 30000,
        queue: { queued: 0, active: 0, completed: 1 },
        timing: { queuedMs: 100, processingMs: 1200, totalMs: 1300 }
      })
    });

    await loadJobPage(fetchMock);

    expect(document.getElementById('job-prompt').textContent).toContain('Prompt #7');
    expect(document.getElementById('job-prompt').textContent).toContain('Say hello.');
    expect(document.getElementById('job-response').textContent).toContain('Response');
    expect(document.getElementById('job-response').textContent).toContain('Hello there.');
    expect(document.getElementById('job-status').textContent).toBe('Response ready.');
    expect(document.getElementById('job-queue').textContent).toContain('Request number: 7');
    expect(document.getElementById('follow-up-section').hidden).toBe(false);
  });

  test('queues a follow-up from a completed response', async () => {
    const fetchMock = jest.fn((url) => {
      if (url === '/api/infer/job-123/follow-up') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            jobId: 'job-456',
            resultPage: '/llm-job/job-456',
            statusPageUrl: 'http://localhost:3001/llm-job/job-456'
          })
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          jobId: 'job-123',
          requestNumber: 7,
          status: 'completed',
          prompt: 'Say hello.',
          response: 'Hello there.',
          timeoutMs: 30000,
          queue: { queued: 0, active: 0, completed: 1 },
          timing: { queuedMs: 100, processingMs: 1200, totalMs: 1300 }
        })
      });
    });

    await loadJobPage(fetchMock);
    document.getElementById('follow-up-input').value = 'Can you make that friendlier?';
    document.getElementById('follow-up-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const followUpCall = fetchMock.mock.calls.find(([url]) => url === '/api/infer/job-123/follow-up');
    expect(followUpCall[1].method).toBe('POST');
    expect(JSON.parse(followUpCall[1].body)).toEqual({ prompt: 'Can you make that friendlier?' });
    expect(document.getElementById('follow-up-status').textContent).toBe('Follow-up queued below.');
    expect(fetchMock).toHaveBeenCalledWith('/api/infer/job-123');
  });

  test('shows the original request and follow-up on the same page', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jobId: 'job-123', requestNumber: 7, status: 'completed', prompt: 'Say hello.', response: 'Hello there.',
        timeoutMs: 30000, queue: { queued: 0, active: 0, completed: 2 }, timing: {},
        conversation: [
          { jobId: 'job-123', requestNumber: 7, status: 'completed', prompt: 'Say hello.', response: 'Hello there.', timeoutMs: 30000, timing: {} },
          { jobId: 'job-456', requestNumber: 8, status: 'completed', prompt: 'Make it friendlier.', response: 'Hi, nice to see you!', timeoutMs: 30000, timing: {} }
        ]
      })
    });

    await loadJobPage(fetchMock);

    expect(document.body.textContent).toContain('Say hello.');
    expect(document.body.textContent).toContain('Hello there.');
    expect(document.body.textContent).toContain('Make it friendlier.');
    expect(document.body.textContent).toContain('Hi, nice to see you!');
  });

  test('refresh button fetches again and shows visible feedback', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jobId: 'job-123',
        requestNumber: 7,
        status: 'completed',
        prompt: 'Say hello.',
        response: 'Hello there.',
        timeoutMs: 30000,
        queue: { queued: 0, active: 0, completed: 1 },
        timing: { queuedMs: 100, processingMs: 1200, totalMs: 1300 }
      })
    });

    await loadJobPage(fetchMock);
    document.getElementById('refresh-job-btn').click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(document.getElementById('refresh-job-btn').textContent).toBe('Refreshed');

    jest.advanceTimersByTime(1200);
    expect(document.getElementById('refresh-job-btn').textContent).toBe('Refresh status');
  });

  test('keeps polling while queued and eventually shows the response', async () => {
    const payloads = [
      {
        jobId: 'job-123',
        requestNumber: 9,
        status: 'queued',
        prompt: 'Write a haiku.',
        response: null,
        timeoutMs: 45000,
        queue: { queued: 2, active: 1, completed: 0 },
        timing: { queuedMs: null, processingMs: null, totalMs: null }
      },
      {
        jobId: 'job-123',
        requestNumber: 9,
        status: 'completed',
        prompt: 'Write a haiku.',
        response: 'Soft rain on the glass.',
        timeoutMs: 45000,
        queue: { queued: 0, active: 0, completed: 1 },
        timing: { queuedMs: 200, processingMs: 1500, totalMs: 1700 }
      }
    ];

    const fetchMock = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => payloads.shift()
      })
    );

    await loadJobPage(fetchMock);

    expect(document.getElementById('job-response').textContent).toContain('Waiting in queue');
    expect(document.getElementById('job-status').textContent).toContain('waiting in queue before the model starts thinking');

    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(document.getElementById('job-response').textContent).toContain('Soft rain on the glass.');
    expect(document.getElementById('job-status').textContent).toBe('Response ready.');
  });

  test('shows that the model is still thinking while processing', async () => {
    const startedAt = Date.now() - 2000;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jobId: 'job-123',
        requestNumber: 10,
        status: 'processing',
        prompt: 'Explain inertia.',
        response: null,
        timeoutMs: 10000,
        startedAt,
        queue: { queued: 0, active: 1, completed: 0 },
        timing: { queuedMs: 100, processingMs: null, totalMs: null }
      })
    });

    await loadJobPage(fetchMock);

    expect(document.getElementById('job-status').textContent).toContain('Model is still thinking for prompt 10.');
    expect(document.getElementById('job-status').textContent).toContain('Timeout in');
    expect(document.getElementById('job-response').textContent).toContain('Generating response');
  });

  test('shows a clear timed out message', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jobId: 'job-123',
        requestNumber: 11,
        status: 'timed_out',
        prompt: 'Summarize this report.',
        response: null,
        error: 'Ollama request timed out after 10000ms',
        timeoutMs: 10000,
        queue: { queued: 0, active: 0, completed: 1 },
        timing: { queuedMs: 0, processingMs: 10000, totalMs: 10000 }
      })
    });

    await loadJobPage(fetchMock);

    expect(document.getElementById('job-status').textContent).toBe('Request timed out after 10.0s.');
    expect(document.getElementById('job-response').textContent).toContain('timed out');
    expect(document.getElementById('job-queue').textContent).toContain('Timeout: 10.0s');
  });
});
