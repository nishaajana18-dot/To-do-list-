# To-Do List App

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

Then install server dependencies:

```bash
cd llm-server
npm install
```

## Run locally

### To-Do app only

You can open `index.html` directly in a browser, but serving via HTTP is preferred for consistent behavior.

### To-Do app + LLM server (recommended)

Run the Express server from `llm-server/`:

```bash
cd llm-server
npm run dev
```

The server will:

- Serve the to-do app at `http://localhost:3000/` (or the next free port)
- Expose LLM API endpoints under `/api`

## LLM server API

Base URL: `http://localhost:3000`

- `GET /api`
	- Returns server status, configured model name, and endpoint info.

- `POST /api/infer`
	- Sends a prompt to your local Ollama model.
	- Requests are handled through a FIFO queue to prevent overload.
	- Request body:

```json
{
	"prompt": "Explain quantum computing in one sentence."
}
```

Legacy alias still available:

- `POST /infer`

Queue status endpoint:

- `GET /api/queue`
	- Returns active workers, queued request count, concurrency, and queue max size.

### Quick test (PowerShell)

```powershell
$body = @{ prompt = "Say hello in one short sentence." } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/infer -ContentType "application/json" -Body $body
```

### Environment variables (LLM server)

Set these in `llm-server/.env` if needed:

- `PORT` (default: `3000`)
- `OLLAMA_MODEL` (default: `qwen3:8b`)
- `OLLAMA_URL` (default: `http://localhost:11434/api/generate`)
- `OLLAMA_TIMEOUT_MS` (default: `60000`)
- `OLLAMA_THINK` (`true` or `false`, default: `false`)
- `INFER_QUEUE_CONCURRENCY` (default: `1`)
- `INFER_QUEUE_MAX_SIZE` (default: `100` waiting requests)

## Example prompts

Use any of these with `POST /api/infer`.

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
		$result = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/infer -ContentType "application/json" -Body $body -TimeoutSec 90 -ErrorAction Stop
		Write-Host "OK: $p"
		Write-Host "-> $($result.response)"
	} catch {
		Write-Warning "FAILED: $p"
		Write-Warning $_.Exception.Message
	}
}
```

## Run tests

This project uses Jest.

```bash
npm test
```

## Project files

- `index.html` - App markup
- `style.css` - App styles
- `script.js` - App logic
- `script.test.js` - Jest tests
- `package.json` - npm scripts and dev dependencies
- `requirements.txt` - Local tool/version requirements
- `llm-server/server.js` - Express server for static hosting + LLM inference
- `llm-server/package.json` - LLM server scripts and dependencies
