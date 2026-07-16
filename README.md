# To-Do App and Local LLM Server

A simple browser-based to-do list app built with HTML, CSS, and Vanilla JavaScript.

This repository also includes an Express-based local LLM inference server in `llm-server/`.

## Prerequisites

- Node.js and npm
- Optional: [Ollama](https://ollama.com/) if you want to use the LLM API

## Install dependencies

From the project root in PowerShell, install packages:

```powershell
npm install
```

No second install is needed. All dependencies are managed from the root `package.json`.

## Run locally

### To-Do app only

You can open `index.html` directly in a browser, but serving via HTTP is preferred for consistent behavior.

### To-Do app + LLM server (recommended)

Run the Express server from the project root in PowerShell:

```powershell
npm run dev
```

The server will:

- Serve API information at `http://localhost:3001/api`
- Serve the to-do app at `http://localhost:3001/index.html`
- Serve a browser submit view at `http://localhost:3001/llm-submit`
- Serve a live queue inspector at `http://localhost:3001/llm-queue`
- Expose LLM API endpoints under `/api`

The root URL redirects to `/api`; it does not open the to-do app.

## LLM server API

Base URL: `http://localhost:3001`

- `GET /api`
	- Returns server status, configured model name, and endpoint info.

- `POST /api/infer`
	- Queues a prompt job and immediately returns a job ID, sequential prompt number, timeout, plus relative and absolute links for status/response pages.
	- Requests are handled through a FIFO queue to prevent overload.
	- Exact request format:
		- Header: `Content-Type: application/json`
		- Body must be a JSON object with a non-empty string `prompt`.
		- Timeout is controlled by server policy (not client request body).
		- The timeout starts when Ollama begins processing, not while the job waits in the queue.
		- Default effective timeout is at least 3 minutes.
	- `prompt` is trimmed by the server, so whitespace-only prompts are rejected.
	- Valid request body:

```json
{
	"prompt": "Explain quantum computing in one sentence."
}
```

	- Invalid bodies (will return 400):

```json
{}
```

```json
{"prompt":""}
```

```json
{"prompt":"   "}
```

```json
{"prompt":123}
```

Legacy alias still available:

- `POST /infer`

Queue status endpoint:

- `GET /api/queue`
	- Returns active workers, queued request count, concurrency, and queue max size.

All jobs endpoint:

- `GET /api/jobs`
	- Returns one queue entry per original prompt. Follow-ups remain inside that parent chat rather than appearing as separate prompts.

Job status endpoint:

- `GET /api/infer/:jobId`
	- Returns one job status: `queued`, `processing`, `completed`, `timed_out`, or `failed`.
	- Includes `requestNumber`, `timeoutMs`, queue/timing info, and response text when completed.
	- Request numbers restart at `1` whenever the server restarts; use `jobId` to identify a job for the life of that server process.

Follow-up endpoint:

- `POST /api/infer/:jobId/follow-up`
	- Queues a follow-up for a completed job.
	- Uses the earlier prompt and answer as context for the model; the original request page stays open and appends the new prompt and answer to the chat.
	- Accepts the same JSON body as `POST /api/infer` and returns the same request links.
	- Returns `409` until the parent request has completed.

Accepted response fields from `POST /api/infer` include:

- `jobId`
- `requestNumber`
- `timeoutMs`
- `statusUrl` (relative API path)
- `statusApiUrl` (absolute API URL)
- `resultPage` (relative browser page path)
- `statusPageUrl` (absolute browser URL)

### Quick test (PowerShell)

```powershell
$body = @{ prompt = "Say hello in one short sentence." } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/infer -ContentType "application/json" -Body $body
```

Open the browser submit view from PowerShell:

```powershell
Start-Process "http://localhost:3001/llm-submit"
```

### Environment variables (LLM server)

Set these in `llm-server/.env` if needed:

- `PORT` (default: `3001`)
- `OLLAMA_MODEL` (default: `qwen3:8b`)
- `OLLAMA_URL` (default: `http://localhost:11434/api/generate`)
- `OLLAMA_TIMEOUT_MS` (default: `180000`)
- `MIN_REQUEST_TIMEOUT_MS` (default: `180000`)
- `MAX_REQUEST_TIMEOUT_MS` (default: `300000`)
- `OLLAMA_THINK` (`true` or `false`, default: `false`)
- `INFER_QUEUE_CONCURRENCY` (default: `1`)
- `INFER_QUEUE_MAX_SIZE` (default: `100` waiting requests)
- `INFER_JOB_RETENTION_MS` (default: `3600000`)
- `PORT_RETRY_COUNT` (default: `10`)
	- Default is `10` in code, so if `3001` is busy it will try `3002`, `3003`, and so on.

If you set `OLLAMA_TIMEOUT_MS` lower than `MIN_REQUEST_TIMEOUT_MS`, the effective timeout still resolves to at least `MIN_REQUEST_TIMEOUT_MS`.

PowerShell's `-TimeoutSec` controls how long its HTTP call waits; this is separate from server-side model timeout.

## Terminal-first prompt queue

Use PowerShell to queue prompts and keep submitting more while earlier ones run:

```powershell
Set-Location "C:\Users\nisha\OneDrive\Documents\GitHub\draft"
.\llm-queue.ps1 -BaseUrl "http://localhost:3001" -Interactive
```

In interactive mode, type prompts directly in terminal.

- After each submit it prints: response is being created + the job result URL.
- You can submit another prompt immediately.
- Commands: `/status`, `/wait`, `/open <jobId>`, `/exit`

Result page still exists for tracking individual jobs, with a unique URL per prompt:

- `/llm-job/<jobId>`
	- Shows waiting/processing/completed/timed out/failed states.
	- Polls every two seconds and displays the configured timeout and remaining processing time.
	- Once a response is ready, provides a follow-up field that appends the next prompt and response to the same page using the completed chat as context.

Browser-first submission flow:

- `/llm-submit`
	- Submit prompts directly from the browser.
	- Shows the accepted prompt and a live response link immediately.
	- Shows a recent prompt list with status pills and links to each job page.
	- Includes a manual Refresh button for recent jobs.
	- Active jobs refresh automatically while the model is queued or thinking.
	- Open a completed request to ask a follow-up and receive a link to that new request.

Queue inspector:

- `/llm-queue`
	- Lists each prompt number and status without repeating prompt or response text.
	- Prompt numbers link directly to their individual request pages.
	- Refreshes automatically and shows Waiting in Queue, Waiting for model response, Timeout, Error, or Done.

Find every queued/completed/timed-out job in one place:

```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:3001/api/jobs
```

## PowerShell workflow (recommended)

1. Install dependencies:

```powershell
npm install
```

2. Start the server:

```powershell
npm run start
```

3. Open the submit page:

```powershell
Start-Process "http://localhost:3001/llm-submit"
```

## Example prompts

Use any of these with `POST /api/infer`.
Each line below is the string value for `prompt` only. Send each one in this exact shape:

```json
{ "prompt": "<your prompt text>" }
```

Tip: If responses time out, keep prompts short and request very small outputs (for example, "in one sentence" or "in 3 bullets").

1. `Say hello in one short sentence.`
2. `Give 3 tips for staying organized.`
3. `Rewrite this politely: "Send the file now".`
4. `Summarize this in one line: I need to buy milk, eggs, and bread.`
5. `List 3 quick dinner ideas.`
6. `What is JavaScript in one sentence?`
7. `Give a one-line motivational quote.`

### PowerShell examples with prompts

```powershell
$prompts = @(
	"Say hello in one short sentence.",
	"Give 3 tips for staying organized.",
	"Rewrite this politely: Send the file now.",
	"What is JavaScript in one sentence?",
	"List 3 quick dinner ideas.",
	"Give a one-line motivational quote."
)

foreach ($p in $prompts) {
	try {
		$body = @{ prompt = $p } | ConvertTo-Json -Compress
		$result = Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/infer -ContentType "application/json" -Body $body -TimeoutSec 90 -ErrorAction Stop
		Write-Host "QUEUED: $p"
		Write-Host "Track at: http://localhost:3001$($result.resultPage)"
	} catch {
		Write-Warning "FAILED: $p"
		Write-Warning $_.Exception.Message
	}
}
```

## Run tests

This project uses Jest. The suite covers to-do behavior, browser submission and queue views, prompt result-page rendering and polling, follow-up requests with conversation context, plus server validation, request numbering, completed responses, timeout limits, and timed-out jobs.

```powershell
npm test
```

## Project files

- `index.html` - App markup
- `style.css` - App styles
- `script.js` - App logic
- `script.test.js` - Jest tests
- `llm-submit.html` - Browser prompt submission view
- `llm-submit.js` - Browser prompt submission logic and recent job list
- `llm-submit.test.js` - Browser submit-page behavior tests
- `llm-job.html` - Prompt response tracking page
- `llm-job.js` - Prompt response polling/render logic
- `llm-job.test.js` - Prompt result-page rendering, polling, and follow-up tests
- `llm-server.test.js` - LLM API integration and timeout tests using a fake local Ollama server
- `package.json` - npm scripts and dev dependencies
- `requirements.txt` - Local tool/version requirements
- `llm-server/server.js` - Express server for static hosting + LLM inference
- `llm-queue.html` / `llm-queue.js` - Queue inspector page and its client logic
- `llm-queue.ps1` - Interactive PowerShell queue client
