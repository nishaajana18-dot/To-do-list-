const submitForm = document.getElementById('llm-submit-form');
const promptInput = document.getElementById('prompt-input');
const submitButton = document.getElementById('submit-prompt-btn');
const characterCount = document.getElementById('character-count');
const statusBox = document.getElementById('submit-status');
const resultSection = document.getElementById('submit-result');
const resultDetails = document.getElementById('submit-result-details');
const activePrompt = document.getElementById('active-prompt');
const resultLink = document.getElementById('result-link');
const statusLink = document.getElementById('status-link');
const recentJobs = document.getElementById('recent-jobs');
const refreshJobsButton = document.getElementById('refresh-jobs-btn');

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'timed_out']);
let jobsPollTimer = null;

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
  const apiStatusUrl = payload.statusApiUrl || payload.statusUrl || '#';

  resultSection.hidden = false;
  activePrompt.textContent = prompt;
  resultDetails.textContent = `Prompt #${payload.requestNumber ?? 'pending'} · ${formatStatus('queued')} · ${formatDate(Date.now())}`;
  resultLink.href = resultUrl;
  statusLink.href = apiStatusUrl;
  resultSection.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
}

function createJobCard(job) {
  const article = document.createElement('article');
  article.className = 'job-card';

  const top = document.createElement('div');
  top.className = 'job-card-top';

  const number = document.createElement('span');
  number.className = 'job-number';
  number.textContent = `#${job.requestNumber ?? '—'}`;

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
  link.textContent = job.status === 'completed' ? 'Read answer' : 'View live status';

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
    empty.textContent = 'No prompts yet. Your submitted prompts will appear here.';
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
  setStatus('Sending your prompt to the queue...', 'processing');

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

    renderAcceptedJob(payload, prompt);
    setStatus('Prompt accepted. Use the live response link below while the model works.', 'queued');
    promptInput.value = '';
    characterCount.textContent = '0 characters';
    await loadRecentJobs();
  } catch (error) {
    setStatus(`Could not reach the server: ${error.message}`, 'failed');
  } finally {
    submitButton.disabled = false;
  }
}

promptInput.addEventListener('input', () => {
  const count = promptInput.value.length;
  characterCount.textContent = `${count} character${count === 1 ? '' : 's'}`;
});
submitForm.addEventListener('submit', submitPrompt);
refreshJobsButton.addEventListener('click', loadRecentJobs);
loadRecentJobs();

window.__llmSubmit = {
  buildRequestBody,
  createJobCard,
  formatStatus,
  loadRecentJobs,
  renderAcceptedJob,
  renderJobs,
  submitPrompt
};
