const params = new URLSearchParams(window.location.search);
// Supports both /llm-job/<id> and legacy /llm-job.html?id=<id>.
const jobIdFromPath = window.location.pathname.startsWith('/llm-job/')
  ? decodeURIComponent(window.location.pathname.replace('/llm-job/', '').trim())
  : '';
const jobId = jobIdFromPath || params.get('id');

const jobIdLabel = document.getElementById('job-id-label');
const jobStatus = document.getElementById('job-status');
const jobPrompt = document.getElementById('job-prompt');
const jobResponse = document.getElementById('job-response');
const jobQueue = document.getElementById('job-queue');

let pollTimer = null;
// Polling is intentionally lightweight; the server remains the source of truth.
const POLL_INTERVAL_MS = 2000;

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) {
    return 'n/a';
  }

  if (ms < 1000) {
    return `${ms}ms`;
  }

  return `${(ms / 1000).toFixed(1)}s`;
}

function renderQueueSnapshot(data) {
  const queue = data.queue || {};
  const lines = [
    `Request number: ${data.requestNumber ?? 'pending'}`,
    `Status: ${data.status || 'unknown'}`,
    `Timeout: ${formatDuration(data.timeoutMs)}`,
    `Queued jobs: ${queue.queued ?? 0}`,
    `Active jobs: ${queue.active ?? 0}`,
    `Completed jobs: ${queue.completed ?? 0}`
  ];

  if (data.timing) {
    lines.push(`Time in queue: ${formatDuration(data.timing.queuedMs)}`);
    lines.push(`Processing time: ${formatDuration(data.timing.processingMs)}`);
    lines.push(`Total time: ${formatDuration(data.timing.totalMs)}`);
  }

  if (data.status === 'processing' && data.startedAt && data.timeoutMs) {
    const elapsedMs = Math.max(0, Date.now() - data.startedAt);
    lines.push(`Timeout remaining: ${formatDuration(Math.max(0, data.timeoutMs - elapsedMs))}`);
  }

  return lines.join('\n');
}

function setStatus(text, type) {
  jobStatus.className = `job-status ${type}`;
  jobStatus.textContent = text;
}

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function scheduleNextPoll() {
  stopPolling();
  // Terminal states stop polling; queued and processing jobs keep checking.
  pollTimer = setTimeout(loadJob, POLL_INTERVAL_MS);
}

function renderJob(data) {
  const requestLabel = data.requestNumber ? `Prompt #${data.requestNumber}` : 'Prompt';
  jobPrompt.textContent = data.prompt ? `${requestLabel}\n${data.prompt}` : `${requestLabel}\nWaiting for prompt details...`;
  jobQueue.textContent = renderQueueSnapshot(data);

  if (data.status === 'queued') {
    jobResponse.textContent = 'Response\nWaiting in queue...';
    setStatus(`Prompt ${data.requestNumber ?? ''} is waiting in queue.`.trim(), 'queued');
    scheduleNextPoll();
    return;
  }

  if (data.status === 'processing') {
    jobResponse.textContent = 'Response\nGenerating response...';
    const elapsedMs = data.startedAt ? Math.max(0, Date.now() - data.startedAt) : 0;
    const remainingMs = data.timeoutMs ? Math.max(0, data.timeoutMs - elapsedMs) : null;
    const timeoutText = remainingMs === null ? '' : ` Timeout in ${formatDuration(remainingMs)}.`;
    setStatus(`Prompt ${data.requestNumber ?? ''} is being processed.${timeoutText}`.trim(), 'processing');
    scheduleNextPoll();
    return;
  }

  if (data.status === 'completed') {
    jobResponse.textContent = data.response ? `Response\n${data.response}` : 'Response\nNo text was returned.';
    setStatus('Response ready.', 'completed');
    stopPolling();
    return;
  }

  if (data.status === 'timed_out') {
    jobResponse.textContent = `Response\n${data.error || 'The request timed out.'}`;
    setStatus(`Request timed out after ${formatDuration(data.timeoutMs)}.`, 'timed_out');
    stopPolling();
    return;
  }

  jobResponse.textContent = `Response\n${data.error || 'Request failed.'}`;
  setStatus('Request failed.', 'failed');
  stopPolling();
}

async function loadJob() {
  if (!jobId) {
    setStatus('Missing job ID. Open this page from the queue confirmation link.', 'failed');
    jobPrompt.textContent = 'Prompt\nNo prompt was loaded.';
    jobResponse.textContent = 'Response\nUnable to load a response without a job ID.';
    jobQueue.textContent = 'Request number: n/a\nStatus: failed';
    return;
  }

  try {
    // The status endpoint eventually returns a terminal state and response/error.
    const response = await fetch(`/api/infer/${encodeURIComponent(jobId)}`);
    const payload = await response.json();

    if (!response.ok) {
      const errorText = payload.error ? `${payload.error}: ${payload.details || ''}` : 'Unable to load this job.';
      setStatus(errorText, 'failed');
      jobPrompt.textContent = 'Prompt\nUnable to load prompt details.';
      jobResponse.textContent = `Response\n${errorText}`;
      jobQueue.textContent = 'Request number: n/a\nStatus: failed';
      stopPolling();
      return;
    }

    renderJob(payload);
  } catch (error) {
    setStatus(`Network error: ${error.message}`, 'failed');
    jobResponse.textContent = `Response\nTemporary network problem: ${error.message}`;
    scheduleNextPoll();
  }
}

if (!jobId) {
  jobIdLabel.textContent = 'No job ID was provided.';
  setStatus('Missing job ID.', 'failed');
  jobPrompt.textContent = 'Prompt\nNo prompt was loaded.';
  jobResponse.textContent = 'Response\nUnable to load a response without a job ID.';
  jobQueue.textContent = 'Request number: n/a\nStatus: failed';
} else {
  jobIdLabel.textContent = `Tracking job: ${jobId}`;
  setStatus('Loading job status...', 'processing');
  loadJob();
}

window.__llmJob = {
  formatDuration,
  renderJob,
  renderQueueSnapshot,
  loadJob,
  stopPolling
};
