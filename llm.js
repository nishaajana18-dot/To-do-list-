const llmForm = document.getElementById('llm-form');
const promptInput = document.getElementById('prompt-input');
const submitResult = document.getElementById('submit-result');

function renderSubmitMessage(html, type) {
  submitResult.className = `submit-result ${type}`;
  submitResult.innerHTML = html;
}

llmForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const prompt = promptInput.value.trim();
  if (!prompt) {
    renderSubmitMessage('Please enter a prompt before queuing.', 'error');
    return;
  }

  renderSubmitMessage('Submitting your prompt to the queue...', 'pending');

  try {
    const response = await fetch('/api/infer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt })
    });

    const payload = await response.json();
    if (!response.ok) {
      const details = payload.details ? `<p>${payload.details}</p>` : '';
      renderSubmitMessage(`<h2>Request failed</h2><p>${payload.error || 'Unknown error'}</p>${details}`, 'error');
      return;
    }

    promptInput.value = '';

    renderSubmitMessage(
      `<h2>Prompt queued</h2>
      <p>${payload.message}</p>
      <p><strong>Job ID:</strong> ${payload.jobId}</p>
      <p><a href="${payload.resultPage}">Open response page</a></p>`,
      'success'
    );
  } catch (error) {
    renderSubmitMessage(`<h2>Network error</h2><p>${error.message}</p>`, 'error');
  }
});