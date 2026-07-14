const submitForm = document.getElementById('llm-submit-form');
const promptInput = document.getElementById('prompt-input');
const submitButton = document.getElementById('submit-prompt-btn');
const statusBox = document.getElementById('submit-status');
const resultSection = document.getElementById('submit-result');
const activeRequestHeading = document.getElementById('active-request-heading');
const resultDetails = document.getElementById('submit-result-details');
const activePrompt = document.getElementById('active-prompt');
const activeResponseText = document.getElementById('active-response-text');
const resultLink = document.getElementById('result-link');
const recentJobs = document.getElementById('recent-jobs');
const refreshJobsButton = document.getElementById('refresh-jobs-btn');

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'timed_out']);
let jobsPollTimer = null;
let activeJobPollTimer = null;
let activeJobStatusUrl = null;

function setStatus(text, type = '') {
  statusBox.className = `submit-notice ${type}`.trim();
  statusBox.textContent = text;
}

function buildRequestBody(prompt) {
  return { prompt };
}

function formatStatus(status) {
  const labels = {
    queued: 'Waiting in queue',
    processing: 'Model is thinking',
    completed: 'Answer ready',
    timed_out: 'Request timed out',
    failed: 'Request failed'
  };
  return labels[status] || 'Status unavailable';
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

function renderAcceptedJob(payload, prompt) {
  const resultUrl = payload.statusPageUrl || payload.resultPage || '#';

  resultSection.hidden = false;
  activeRequestHeading.textContent = 'Waiting in queue';
  activePrompt.textContent = prompt;
  activeResponseText.textContent = 'Waiting for the model...';
  resultDetails.textContent = `Prompt ${payload.requestNumber ?? 'pending'} - ${formatStatus('queued')} - ${formatDate(Date.now())}`;
  resultLink.href = resultUrl;
  resultSection.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
}

function renderActiveJob(job) {
  const status = job.status || 'failed';
  activeRequestHeading.textContent = formatStatus(status);
  resultDetails.textContent = `Prompt ${job.requestNumber ?? 'pending'} - ${formatStatus(status)} - ${formatDate(job.createdAt)}`;

  if (status === 'queued') {
    activeResponseText.textContent = 'Waiting for the model...';
    setStatus('Your prompt is waiting in the queue.', 'queued');
    return false;
  }

  if (status === 'processing') {
    activeResponseText.textContent = 'The model is thinking...';
    setStatus('The model is thinking...', 'processing');
    return false;
  }

  if (status === 'completed') {
    activeResponseText.textContent = job.response || 'No answer was returned.';
    setStatus('Answer ready.', 'completed');
    return true;
  }

  if (status === 'timed_out') {
    activeResponseText.textContent = job.error || 'The request timed out.';
    setStatus('The request timed out.', 'timed_out');
    return true;
  }

  activeResponseText.textContent = job.error || 'The request failed.';
  setStatus('The request failed.', 'failed');
  return true;
}

function scheduleActiveJobPoll() {
  clearTimeout(activeJobPollTimer);
  activeJobPollTimer = setTimeout(trackActiveJob, 2000);
}

async function trackActiveJob() {
  if (!activeJobStatusUrl) {
    return;
  }

  try {
    const response = await fetch(activeJobStatusUrl);
    const job = await response.json();
    if (!response.ok) {
      throw new Error(job.error || 'Unable to load the response.');
    }

    const finished = renderActiveJob(job);
    if (finished) {
      activeJobStatusUrl = null;
      await loadRecentJobs();
      return;
    }
    scheduleActiveJobPoll();
  } catch (error) {
    setStatus(`Unable to refresh the response: ${error.message}`, 'failed');
    scheduleActiveJobPoll();
  }
}

function createJobCard(job) {
  const article = document.createElement('article');
  article.className = 'job-card';

  const top = document.createElement('div');
  top.className = 'job-card-top';

  const number = document.createElement('span');
  number.className = 'job-number';
  number.textContent = `#${job.requestNumber ?? '-'}`;

  const status = document.createElement('span');
  status.className = `status-pill ${job.status || 'unknown'}`;
  status.textContent = formatStatus(job.status);

  const prompt = document.createElement('p');
  prompt.className = 'job-card-prompt';
  prompt.textContent = job.prompt || 'Prompt unavailable';

  const bottom = document.createElement('div');
  bottom.className = 'job-card-bottom';

  const date = document.createElement('span');
  date.textContent = formatDate(job.createdAt);

  const link = document.createElement('a');
  link.href = job.resultPage;
  link.textContent = job.status === 'completed' ? 'Read answer' : 'View status';

  top.append(number, status);
  bottom.append(date, link);
  article.append(top, prompt, bottom);
  return article;
}

function renderJobs(jobs) {
  recentJobs.replaceChildren();

  if (!jobs.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No prompts yet.';
    recentJobs.append(empty);
    return;
  }

  jobs.slice(0, 8).forEach((job) => recentJobs.append(createJobCard(job)));
}

function scheduleJobsRefresh(jobs) {
  clearTimeout(jobsPollTimer);
  if (jobs.some((job) => !TERMINAL_STATUSES.has(job.status))) {
    jobsPollTimer = setTimeout(loadRecentJobs, 2500);
  }
}

async function loadRecentJobs() {
  try {
    const response = await fetch('/api/jobs');
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to load prompt history.');
    }
    const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
    renderJobs(jobs);
    scheduleJobsRefresh(jobs);
  } catch (error) {
    recentJobs.replaceChildren();
    const message = document.createElement('p');
    message.className = 'empty-state error';
    message.textContent = error.message;
    recentJobs.append(message);
  }
}

async function submitPrompt(event) {
  event.preventDefault();
  const prompt = promptInput.value.trim();

  if (!prompt) {
    setStatus('Enter a prompt before submitting.', 'failed');
    promptInput.focus();
    return;
  }

  submitButton.disabled = true;
  setStatus('Submitting...', 'processing');

  try {
    const response = await fetch('/api/infer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildRequestBody(prompt))
    });
    const payload = await response.json();

    if (!response.ok) {
      const details = payload?.details ? ` ${payload.details}` : '';
      setStatus(`${payload?.error || 'Request failed.'}${details}`, 'failed');
      return;
    }

    clearTimeout(activeJobPollTimer);
    activeJobStatusUrl = payload.statusUrl || `/api/infer/${encodeURIComponent(payload.jobId)}`;
    renderAcceptedJob(payload, prompt);
    setStatus('Prompt accepted. Waiting for the model...', 'queued');
    promptInput.value = '';
    await loadRecentJobs();
    await trackActiveJob();
  } catch (error) {
    setStatus(`Could not reach the server: ${error.message}`, 'failed');
  } finally {
    submitButton.disabled = false;
  }
}

submitForm.addEventListener('submit', submitPrompt);
refreshJobsButton.addEventListener('click', loadRecentJobs);
loadRecentJobs();

window.__llmSubmit = {
  buildRequestBody,
  createJobCard,
  formatStatus,
  loadRecentJobs,
  renderAcceptedJob,
  renderActiveJob,
  renderJobs,
  submitPrompt,
  trackActiveJob
};
