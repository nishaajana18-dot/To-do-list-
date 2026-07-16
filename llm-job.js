const params = new URLSearchParams(window.location.search);
// Supports both /llm-job/<id> and legacy /llm-job.html?id=<id>.
const jobIdFromPath = window.location.pathname.startsWith('/llm-job/')
  ? decodeURIComponent(window.location.pathname.replace('/llm-job/', '').trim())
  : '';
const jobId = jobIdFromPath || params.get('id');

const jobIdLabel = document.getElementById('job-id-label');
const jobStatus = document.getElementById('job-status');
const jobStatusText = document.getElementById('job-status-text') || jobStatus;
const jobPrompt = document.getElementById('job-prompt');
const jobResponse = document.getElementById('job-response');
const conversation = document.getElementById('conversation');
const jobQueue = document.getElementById('job-queue');
const refreshJobButton = document.getElementById('refresh-job-btn');
const followUpSection = document.getElementById('follow-up-section');
const followUpForm = document.getElementById('follow-up-form');
const followUpInput = document.getElementById('follow-up-input');
const followUpButton = document.getElementById('follow-up-btn');
const followUpStatus = document.getElementById('follow-up-status');

let pollTimer = null;
let refreshResetTimer = null;
let activeJobId = jobId;
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
  jobStatus.className = `response-status ${type}`;
  jobStatusText.textContent = text;
}

function setFollowUpAvailability(status) {
  if (followUpSection) {
    followUpSection.hidden = status !== 'completed';
  }
}

function getResponseText(job) {
  if (job.status === 'queued') return 'Waiting in queue...';
  if (job.status === 'processing') return 'Generating response...';
  if (job.status === 'completed') return job.response || 'No text was returned.';
  return job.error || (job.status === 'timed_out' ? 'The request timed out.' : 'Request failed.');
}

function renderFollowUps(jobs) {
  if (!conversation) return;
  conversation.querySelectorAll('.conversation-turn').forEach((turn) => turn.remove());
  jobs.forEach((job) => {
    const turn = document.createElement('div');
    turn.className = 'response-grid conversation-turn';
    turn.innerHTML = '<section class="response-panel prompt-panel"><p class="panel-label"></p><pre></pre></section><section class="response-panel answer-panel"><p class="panel-label">Answer</p><pre></pre></section>';
    turn.querySelector('.panel-label').textContent = `Prompt #${job.requestNumber}`;
    const fields = turn.querySelectorAll('pre');
    fields[0].textContent = job.prompt;
    fields[1].textContent = getResponseText(job);
    conversation.appendChild(turn);
  });
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
  const jobs = Array.isArray(data.conversation) && data.conversation.length ? data.conversation : [data];
  const originalJob = jobs[0];
  const currentJob = jobs[jobs.length - 1];
  activeJobId = currentJob.jobId || data.jobId;
  const requestLabel = originalJob.requestNumber ? `Prompt #${originalJob.requestNumber}` : 'Prompt';
  jobPrompt.textContent = originalJob.prompt ? `${requestLabel}\n${originalJob.prompt}` : `${requestLabel}\nWaiting for prompt details...`;
  jobResponse.textContent = `Response\n${getResponseText(originalJob)}`;
  renderFollowUps(jobs.slice(1));
  jobQueue.textContent = renderQueueSnapshot({ ...currentJob, queue: data.queue });
  setFollowUpAvailability(currentJob.status);
  data = currentJob;

  if (data.status === 'queued') {
    setStatus(`Prompt ${data.requestNumber ?? ''} is waiting in queue before the model starts thinking.`.trim(), 'queued');
    document.title = `Prompt #${data.requestNumber ?? ''} · Waiting`;
    scheduleNextPoll();
    return;
  }

  if (data.status === 'processing') {
    const elapsedMs = data.startedAt ? Math.max(0, Date.now() - data.startedAt) : 0;
    const remainingMs = data.timeoutMs ? Math.max(0, data.timeoutMs - elapsedMs) : null;
    const timeoutText = remainingMs === null ? '' : ` Timeout in ${formatDuration(remainingMs)}.`;
    setStatus(`Model is still thinking for prompt ${data.requestNumber ?? ''}.${timeoutText}`.trim(), 'processing');
    document.title = `Prompt #${data.requestNumber ?? ''} · Thinking`;
    scheduleNextPoll();
    return;
  }

  if (data.status === 'completed') {
    setStatus('Response ready.', 'completed');
    document.title = `Prompt #${data.requestNumber ?? ''} · Answer ready`;
    stopPolling();
    return;
  }

  if (data.status === 'timed_out') {
    setStatus(`Request timed out after ${formatDuration(data.timeoutMs)}.`, 'timed_out');
    document.title = `Prompt #${data.requestNumber ?? ''} · Timed out`;
    stopPolling();
    return;
  }

  setStatus('Request failed.', 'failed');
  document.title = `Prompt #${data.requestNumber ?? ''} · Failed`;
  stopPolling();
}

async function submitFollowUp(event) {
  event.preventDefault();
  const prompt = followUpInput.value.trim();

  if (!prompt) {
    followUpStatus.textContent = 'Enter a follow-up question.';
    return;
  }

  followUpButton.disabled = true;
  followUpStatus.textContent = 'Queueing follow-up...';

  try {
    // Keep this URL open and append the new turn beneath the original chat.
    const response = await fetch(`/api/infer/${encodeURIComponent(activeJobId)}/follow-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.details || payload.error || 'Unable to queue follow-up.');
    }

    followUpInput.value = '';
    followUpStatus.textContent = 'Follow-up queued below.';
    await loadJob();
  } catch (error) {
    followUpStatus.textContent = error.message;
  } finally {
    followUpButton.disabled = false;
  }
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

async function refreshJob() {
  if (!refreshJobButton) {
    return;
  }

  clearTimeout(refreshResetTimer);
  refreshJobButton.disabled = true;
  refreshJobButton.textContent = 'Refreshing...';

  await loadJob();

  refreshJobButton.disabled = false;
  refreshJobButton.textContent = 'Refreshed';
  refreshResetTimer = setTimeout(() => {
    refreshJobButton.textContent = 'Refresh status';
  }, 1200);
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

refreshJobButton?.addEventListener('click', refreshJob);
followUpForm?.addEventListener('submit', submitFollowUp);

window.__llmJob = {
  formatDuration,
  renderJob,
  renderQueueSnapshot,
  refreshJob,
  submitFollowUp,
  loadJob,
  stopPolling
};
