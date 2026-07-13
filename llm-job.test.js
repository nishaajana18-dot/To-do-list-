/** @jest-environment jsdom */

function setupDom() {
  document.body.innerHTML = `
    <main id="llm-job-app" class="panel">
      <p id="job-id-label"></p>
      <section id="job-status" class="job-status"></section>
      <pre id="job-prompt"></pre>
      <pre id="job-response"></pre>
      <pre id="job-queue"></pre>
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
    expect(document.getElementById('job-status').textContent).toContain('waiting in queue');

    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(document.getElementById('job-response').textContent).toContain('Soft rain on the glass.');
    expect(document.getElementById('job-status').textContent).toBe('Response ready.');
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
