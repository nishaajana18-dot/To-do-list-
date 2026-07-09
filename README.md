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
	- Request body:

```json
{
	"prompt": "Explain quantum computing in one sentence."
}
```

Legacy alias still available:

- `POST /infer`

### Quick test (PowerShell)

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/infer -ContentType application/json -Body '{"prompt":"Say hello in one short sentence."}'
```

### Environment variables (LLM server)

Set these in `llm-server/.env` if needed:

- `PORT` (default: `3000`)
- `OLLAMA_MODEL` (default: `qwen3:8b`)
- `OLLAMA_URL` (default: `http://localhost:11434/api/generate`)
- `OLLAMA_TIMEOUT_MS` (default: `60000`)
- `OLLAMA_THINK` (`true` or `false`, default: `false`)

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
