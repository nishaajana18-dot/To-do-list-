const queueList = document.getElementById('queue-list');
const clearCompletedButton = document.getElementById('clear-completed-btn');

const STATUS_LABELS = {
  queued: 'Waiting in Queue',
  processing: 'Waiting for model response',
  timed_out: 'Timeout',
  failed: 'Error',
  completed: 'Done'
};
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'timed_out']);

let queuePollTimer = null;
let clearButtonResetTimer = null;

function getStatusLabel(status) {
  return STATUS_LABELS[status] || 'Error';
}

function createQueueRow(job) {
  const article = document.createElement('article');
  article.className = 'queue-row';

  const number = document.createElement('a');
  number.className = 'queue-number';
  number.href = job.resultPage;
  number.textContent = `Prompt ${job.requestNumber ?? '-'}`;

  const status = document.createElement('span');
  status.className = `queue-state ${job.status || 'failed'}`;
  status.textContent = getStatusLabel(job.status);

  article.append(number, status);
  return article;
}

function updateClearButton(jobs) {
  const terminalCount = jobs.filter((job) => TERMINAL_STATUSES.has(job.status)).length;
  clearCompletedButton.disabled = terminalCount === 0;
}

function renderQueue(payload) {
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  queueList.replaceChildren();
  updateClearButton(jobs);

  if (!jobs.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Queue is empty.';
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
  clearTimeout(clearButtonResetTimer);
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
  } catch (error) {
    queueList.replaceChildren();
    const message = document.createElement('p');
    message.className = 'empty-state error';
    message.textContent = 'Error';
    queueList.append(message);
  } finally {
    scheduleRefresh();
  }
}

async function clearCompletedJobs() {
  clearTimeout(clearButtonResetTimer);
  clearCompletedButton.disabled = true;
  clearCompletedButton.textContent = 'Clearing...';

  try {
    const response = await fetch('/api/jobs/completed', { method: 'DELETE' });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to clear completed requests.');
    }

    clearCompletedButton.textContent = `Cleared ${payload.cleared}`;
    await loadQueue();
    clearButtonResetTimer = setTimeout(() => {
      clearCompletedButton.textContent = 'Clear completed';
    }, 1200);
  } catch (error) {
    clearCompletedButton.textContent = 'Clear failed';
    clearButtonResetTimer = setTimeout(() => {
      clearCompletedButton.textContent = 'Clear completed';
    }, 1200);
  }
}

clearCompletedButton.addEventListener('click', clearCompletedJobs);
loadQueue();

window.__llmQueue = {
  clearCompletedJobs,
  createQueueRow,
  getStatusLabel,
  loadQueue,
  renderQueue,
  stopPolling,
  updateClearButton
};
