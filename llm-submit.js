const submitForm = document.getElementById('llm-submit-form');
const promptInput = document.getElementById('prompt-input');
const timeoutInput = document.getElementById('timeout-input');
const submitButton = document.getElementById('submit-prompt-btn');
const statusBox = document.getElementById('submit-status');
const resultSection = document.getElementById('submit-result');
const resultDetails = document.getElementById('submit-result-details');
const resultLink = document.getElementById('result-link');
const statusLink = document.getElementById('status-link');

function setStatus(text, type) {
  statusBox.className = `job-status ${type}`;
  statusBox.textContent = text;
}

function buildRequestBody(prompt, timeoutValue) {
  const body = { prompt };
  const timeoutMs = Number(timeoutValue);

  if (Number.isInteger(timeoutMs) && timeoutMs > 0) {
    body.timeoutMs = timeoutMs;
  }

  return body;
}

function renderAcceptedJob(payload) {
  resultSection.hidden = false;

  const queue = payload.queue || {};
  resultDetails.textContent = [
    `Prompt number: ${payload.requestNumber ?? 'n/a'}`,
    `Job ID: ${payload.jobId ?? 'n/a'}`,
    `Status: queued`,
    `Timeout: ${payload.timeoutMs ?? 'n/a'}ms`,
    `Queued now: ${queue.queued ?? 0}`,
    `Active now: ${queue.active ?? 0}`
  ].join('\n');

  resultLink.href = payload.resultPage || '#';
  statusLink.href = payload.statusUrl || '#';
}

async function submitPrompt(event) {
  event.preventDefault();

  const prompt = promptInput.value.trim();
  if (!prompt) {
    setStatus('Prompt is required.', 'failed');
    return;
  }

  const requestBody = buildRequestBody(prompt, timeoutInput.value);

  submitButton.disabled = true;
  setStatus('Submitting prompt...', 'processing');

  try {
    const response = await fetch('/api/infer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const payload = await response.json();

    if (!response.ok) {
      const details = payload?.details ? ` ${payload.details}` : '';
      setStatus(`${payload?.error || 'Request failed.'}${details}`, 'failed');
      return;
    }

    setStatus('Prompt queued. You can submit another one right away.', 'queued');
    renderAcceptedJob(payload);
    promptInput.value = '';
  } catch (error) {
    setStatus(`Network error: ${error.message}`, 'failed');
  } finally {
    submitButton.disabled = false;
  }
}

submitForm.addEventListener('submit', submitPrompt);

window.__llmSubmit = {
  buildRequestBody,
  submitPrompt,
  renderAcceptedJob
};
