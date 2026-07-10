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
  // Keep polling asynchronously until terminal status is reached.
  pollTimer = setTimeout(loadJob, 2000);
}

function renderJob(data) {
  jobPrompt.textContent = data.prompt || '';
  jobQueue.textContent = JSON.stringify(data.queue || {}, null, 2);

  if (data.status === 'queued') {
    jobResponse.textContent = 'Waiting in queue...';
    setStatus('Your request is waiting in queue.', 'queued');
    scheduleNextPoll();
    return;
  }

  if (data.status === 'processing') {
    jobResponse.textContent = 'Generating response...';
    setStatus('Your prompt is being processed right now.', 'processing');
    scheduleNextPoll();
    return;
  }

  if (data.status === 'completed') {
    jobResponse.textContent = data.response || '';
    setStatus('Response ready.', 'completed');
    stopPolling();
    return;
  }

  if (data.status === 'timed_out') {
    jobResponse.textContent = data.error || 'The request timed out.';
    setStatus('Request timed out.', 'timed_out');
    stopPolling();
    return;
  }

  jobResponse.textContent = data.error || 'Request failed.';
  setStatus('Request failed.', 'failed');
  stopPolling();
}

async function loadJob() {
  if (!jobId) {
    setStatus('Missing job ID. Open this page from the queue confirmation link.', 'failed');
    jobResponse.textContent = '';
    return;
  }

  try {
    const response = await fetch(`/api/infer/${encodeURIComponent(jobId)}`);
    const payload = await response.json();

    if (!response.ok) {
      const errorText = payload.error ? `${payload.error}: ${payload.details || ''}` : 'Unable to load this job.';
      setStatus(errorText, 'failed');
      jobResponse.textContent = '';
      stopPolling();
      return;
    }

    renderJob(payload);
  } catch (error) {
    setStatus(`Network error: ${error.message}`, 'failed');
    jobResponse.textContent = '';
    scheduleNextPoll();
  }
}

if (!jobId) {
  jobIdLabel.textContent = 'No job ID was provided.';
  setStatus('Missing job ID.', 'failed');
} else {
  jobIdLabel.textContent = `Tracking job: ${jobId}`;
  setStatus('Loading job status...', 'processing');
  loadJob();
}