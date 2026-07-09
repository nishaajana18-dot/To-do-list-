require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());

// This Express app has two jobs:
// 1) Serve the front-end to-do list files (index.html, script.js, style.css).
// 2) Provide LLM API endpoints that proxy prompts to Ollama.

// Serve the root to-do app files from this same server process.
// This lets http://localhost:<port>/ load index.html, script.js, and style.css.
const WEB_ROOT = path.resolve(__dirname, "..");
app.use(express.static(WEB_ROOT));

// Change this if your model has a different name.
// Run `ollama list` in PowerShell to see your exact model name.
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3:8b";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 60000;
// If true, Ollama may include model "thinking" traces depending on model support.
const OLLAMA_THINK = (process.env.OLLAMA_THINK || "false").toLowerCase() === "true";

async function queryOllama(prompt) {
  // Abort slow upstream calls so this API does not hang forever.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        think: OLLAMA_THINK
      }),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Ollama request timed out after ${OLLAMA_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }

  const data = await response.json();

  return data.response;
}

app.get("/api", (req, res) => {
  res.json({
    name: "Local LLM Inference Server",
    status: "ok",
    model: OLLAMA_MODEL,
    endpoints: {
      "POST /api/infer": "Send a prompt to the local Ollama model",
      "POST /infer": "Legacy alias for /api/infer"
    },
    exampleBody: {
      prompt: "Explain quantum computing in one sentence."
    }
  });
});

// Shared request handler used by both /api/infer and the legacy /infer route.
// This is the LLM side: it validates the prompt and forwards it to Ollama.
async function handleInfer(req, res) {
  const prompt = req.body.prompt;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({
      error: "prompt is required and must be a non-empty string"
    });
  }

  try {
    const llmResponse = await queryOllama(prompt.trim());

    res.json({
      model: OLLAMA_MODEL,
      prompt: prompt.trim(),
      response: llmResponse
    });
  } catch (error) {
    res.status(502).json({
      error: "Failed to get response from Ollama",
      details: error.message
    });
  }
}

// Preferred endpoint for inference requests.
app.get("/api/infer", (req, res) => {
  res.status(405).json({
    error: "Method not allowed",
    message: "Use POST /api/infer with a JSON body.",
    exampleBody: {
      prompt: "Say hello in one short sentence."
    }
  });
});
app.post("/api/infer", handleInfer);
// Backward-compatible endpoint to avoid breaking older clients.
app.get("/infer", (req, res) => {
  res.status(405).json({
    error: "Method not allowed",
    message: "Use POST /infer with a JSON body (or POST /api/infer).",
    exampleBody: {
      prompt: "Say hello in one short sentence."
    }
  });
});
app.post("/infer", handleInfer);

// Return a clear JSON error when request bodies contain invalid JSON.
app.use((error, req, res, next) => {
  if (error && error.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "Invalid JSON in request body",
      example: {
        prompt: "Say hello in one short sentence."
      },
      powerShellTip:
        "Use Invoke-RestMethod with ConvertTo-Json, or curl.exe with --% to avoid quote-escaping issues in PowerShell."
    });
  }

  return next(error);
});

const DEFAULT_PORT = 3000;
const MAX_PORT_ATTEMPTS = 10;

function parsePreferredPort(rawPort) {
  const parsed = Number(rawPort);
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
    return parsed;
  }
  return DEFAULT_PORT;
}

function startServer(port, attemptsRemaining) {
  const server = app.listen(port, () => {
    console.log(`Express server running at http://localhost:${port}`);
    console.log(`Using Ollama model: ${OLLAMA_MODEL}`);
    console.log(`Ollama think mode: ${OLLAMA_THINK}`);
  });

  server.on("error", (error) => {
    // If the port is taken, automatically try the next one a few times.
    if (error.code === "EADDRINUSE" && attemptsRemaining > 0) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is already in use. Retrying on port ${nextPort}...`);
      startServer(nextPort, attemptsRemaining - 1);
      return;
    }

    console.error("Failed to start server:", error.message);
    process.exit(1);
  });
}

const preferredPort = parsePreferredPort(process.env.PORT);
startServer(preferredPort, MAX_PORT_ATTEMPTS);