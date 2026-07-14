const queueList = document.getElementById('queue-list');
const queueSummary = document.getElementById('queue-summary');
const queueStatus = document.getElementById('queue-status');
const refreshQueueButton = document.getElementById('refresh-queue-btn');

const STATUS_LABELS = {
  queued: 'Waiting in Queue',
  processing: 'Waiting for model response',
  timed_out: 'Timeout',
  failed: 'Error',
  completed: 'Done'
};

let queuePollTimer = null;

function getStatusLabel(status) {
  return STATUS_LABELS[status] || 'Error';
}

function formatDate(timestamp) {
  if (!timestamp) {
    return 'Just now';
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric'
  }).format(new Date(timestamp));
}

function createQueueRow(job) {
  const article = document.createElement('article');
  article.className = 'queue-row';

  const status = document.createElement('span');
  status.className = `queue-state ${job.status || 'failed'}`;
  status.textContent = getStatusLabel(job.status);

  const content = document.createElement('div');
  content.className = 'queue-prompt';

  const prompt = document.createElement('p');
  prompt.textContent = job.prompt || 'Prompt unavailable';

  const meta = document.createElement('span');
  meta.textContent = `Prompt ${job.requestNumber ?? '-'} - ${formatDate(job.createdAt)}`;

  const link = document.createElement('a');
  link.href = job.resultPage;
  link.textContent = 'View';

  content.append(prompt, meta);
  article.append(status, content, link);
  return article;
}

function renderQueue(payload) {
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  const queue = payload.queue || {};

  queueList.replaceChildren();
  queueSummary.textContent = `${jobs.length} prompt${jobs.length === 1 ? '' : 's'} - ${queue.queued ?? 0} waiting - ${queue.active ?? 0} active`;

  if (!jobs.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'The queue is empty.';
    queueList.append(empty);
    return;
  }

  jobs.forEach((job) => queueList.append(createQueueRow(job)));
}

function scheduleRefresh() {
  clearTimeout(queuePollTimer);
  queuePollTimer = setTimeout(loadQueue, 2000);
}

function stopPolling() {
  clearTimeout(queuePollTimer);
  queuePollTimer = null;
}

async function loadQueue() {
  try {
    const response = await fetch('/api/jobs');
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to load the queue.');
    }

    renderQueue(payload);
    queueStatus.className = 'submit-notice completed';
    queueStatus.textContent = 'Queue is up to date.';
  } catch (error) {
    queueStatus.className = 'submit-notice failed';
    queueStatus.textContent = error.message;
  } finally {
    scheduleRefresh();
  }
}

refreshQueueButton.addEventListener('click', loadQueue);
loadQueue();

window.__llmQueue = {
  createQueueRow,
  getStatusLabel,
  loadQueue,
  renderQueue,
  stopPolling
};
