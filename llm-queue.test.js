/** @jest-environment jsdom */

function setupDom() {
  document.body.innerHTML = `
    <main id="llm-queue-app">
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

  test('shows only each request number and queue state', async () => {
    const statuses = ['queued', 'processing', 'timed_out', 'failed', 'completed'];
    const fetchMock = jest.fn().mockImplementation(() => response({
      queue: { queued: 1, active: 1 },
      jobs: statuses.map((status, index) => ({
        jobId: `job-${index}`,
        requestNumber: index + 1,
        prompt: `This body must stay hidden ${index + 1}`,
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
    expect(text).not.toContain('This body must stay hidden');
    expect(text).not.toContain('View');
    expect(document.querySelectorAll('.queue-row')).toHaveLength(5);
    expect(document.querySelector('.queue-row a')).toBeNull();
  });

  test('shows an empty queue clearly', async () => {
    await loadQueuePage(jest.fn().mockImplementation(() => response({
      queue: { queued: 0, active: 0 },
      jobs: []
    })));

    expect(document.getElementById('queue-list').textContent).toContain('Queue is empty.');
  });
});
