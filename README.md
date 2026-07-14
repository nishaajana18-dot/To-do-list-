# To-Do App and Local LLM Server

A simple browser-based to-do list app built with HTML, CSS, and Vanilla JavaScript.

This repository also includes an Express-based local LLM inference server in `llm-server/`.

## Prerequisites

- Node.js and npm
- Optional: [Ollama](https://ollama.com/) if you want to use the LLM API

## Install dependencies

From the project root, install packages:

```bash
npm install
```

No second install is needed. All dependencies are managed from the root `package.json`.

## Run locally

### To-Do app only

You can open `index.html` directly in a browser, but serving via HTTP is preferred for consistent behavior.

### To-Do app + LLM server (recommended)

Run the Express server from the project root:

```bash
npm run dev
```

The server will:

- Serve API information at `http://localhost:3001/api`
- Serve the to-do app at `http://localhost:3001/index.html`
- Serve a browser submit view at `http://localhost:3001/llm-submit`
- Expose LLM API endpoints under `/api`

The root URL redirects to `/api`; it does not open the to-do app.

## LLM server API

Base URL: `http://localhost:3001`

- `GET /api`
	- Returns server status, configured model name, and endpoint info.

- `POST /api/infer`
	- Queues a prompt job and immediately returns a job ID, sequential prompt number, timeout, and result page link.
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
	- Returns all tracked jobs with each job's unique status URL and unique result page URL.

Job status endpoint:

- `GET /api/infer/:jobId`
	- Returns one job status: `queued`, `processing`, `completed`, `timed_out`, or `failed`.
	- Includes `requestNumber`, `timeoutMs`, queue/timing info, and response text when completed.
	- Request numbers restart at `1` whenever the server restarts; use `jobId` to identify a job for the life of that server process.

### Quick test (PowerShell)

```powershell
$body = @{ prompt = "Say hello in one short sentence." } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/infer -ContentType "application/json" -Body $body
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

The local `.env` currently sets `OLLAMA_TIMEOUT_MS=60000` and `PORT_RETRY_COUNT=0`. With the current timeout policy, server timeout still resolves to at least 3 minutes unless you explicitly lower `MIN_REQUEST_TIMEOUT_MS`.

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

Browser-first submission flow:

- `/llm-submit`
	- Submit prompts directly from the browser.
	- Automatically opens the unique result page (`/llm-job/<jobId>`) after queueing.

Find every queued/completed/timed-out job in one place:

```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:3001/api/jobs
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

This project uses Jest. The suite covers to-do behavior, prompt result-page rendering and polling, plus server integration tests for validation, request numbering, completed responses, timeout limits, and timed-out jobs.

```bash
npm test
```

## Project files

- `index.html` - App markup
- `style.css` - App styles
- `script.js` - App logic
- `script.test.js` - Jest tests
- `llm-job.test.js` - Prompt result-page rendering and polling tests
- `llm-server.test.js` - LLM API integration and timeout tests using a fake local Ollama server
- `package.json` - npm scripts and dev dependencies
- `requirements.txt` - Local tool/version requirements
- `llm-server/server.js` - Express server for static hosting + LLM inference
- `llm-queue.ps1` - Interactive PowerShell queue client
