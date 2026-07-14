/** @jest-environment jsdom */

function setupDom() {
  document.body.innerHTML = `
    <main id="llm-queue-app">
      <p id="queue-summary"></p>
      <button id="refresh-queue-btn" type="button">Refresh</button>
      <section id="queue-status"></section>
      <section id="queue-list"></section>
    </main>
  `;
}

function response(body, ok = true) {
  return Promise.resolve({ ok, json: async () => body });
}

async function loadQueuePage(fetchImpl) {
  jest.resetModules();
  setupDom();
  window.fetch = fetchImpl;
  require('./llm-queue.js');
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('queue inspector', () => {
  afterEach(() => {
    window.__llmQueue?.stopPolling();
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  test('shows every queue state with a response link', async () => {
    const statuses = ['queued', 'processing', 'timed_out', 'failed', 'completed'];
    const fetchMock = jest.fn().mockImplementation(() => response({
      queue: { queued: 1, active: 1 },
      jobs: statuses.map((status, index) => ({
        jobId: `job-${index}`,
        requestNumber: index + 1,
        prompt: `Prompt ${index + 1}`,
        status,
        createdAt: Date.now(),
        resultPage: `/llm-job/job-${index}`
      }))
    }));

    await loadQueuePage(fetchMock);

    const text = document.getElementById('queue-list').textContent;
    expect(text).toContain('Waiting in Queue');
    expect(text).toContain('Waiting for model response');
    expect(text).toContain('Timeout');
    expect(text).toContain('Error');
    expect(text).toContain('Done');
    expect(document.querySelectorAll('.queue-row')).toHaveLength(5);
    expect(document.querySelector('.queue-row a').getAttribute('href')).toBe('/llm-job/job-0');
    expect(document.getElementById('queue-summary').textContent).toContain('1 waiting - 1 active');
  });

  test('shows an empty queue clearly', async () => {
    await loadQueuePage(jest.fn().mockImplementation(() => response({
      queue: { queued: 0, active: 0 },
      jobs: []
    })));

    expect(document.getElementById('queue-list').textContent).toContain('The queue is empty.');
    expect(document.getElementById('queue-status').textContent).toBe('Queue is up to date.');
  });
});
