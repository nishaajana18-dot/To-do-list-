const submitForm = document.getElementById('llm-submit-form');
const promptInput = document.getElementById('prompt-input');
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

function buildRequestBody(prompt) {
  return { prompt };
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

function navigateToResult(resultPage) {
  if (!resultPage) {
    return;
  }

  // JSDOM does not implement full navigation; store intended target for tests.
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '')) {
    window.__llmSubmitLastRedirect = resultPage;
    return;
  }

  window.location.assign(resultPage);
}

async function submitPrompt(event) {
  event.preventDefault();

  const prompt = promptInput.value.trim();
  if (!prompt) {
    setStatus('Prompt is required.', 'failed');
    return;
  }

  const requestBody = buildRequestBody(prompt);

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

    setStatus('Prompt queued. Opening response page...', 'queued');
    renderAcceptedJob(payload);
    promptInput.value = '';

    if (payload.resultPage) {
      setTimeout(() => {
        navigateToResult(payload.resultPage);
      }, 400);
    }
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
  renderAcceptedJob,
  navigateToResult
};
