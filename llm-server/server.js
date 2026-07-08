require("dotenv").config();

const express = require("express");

const app = express();

app.use(express.json());

// Change this if your model has a different name.
// Run `ollama list` in PowerShell to see your exact model name.
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3:8b";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";

async function queryOllama(prompt) {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }

  const data = await response.json();

  return data.response;
}

app.get("/", (req, res) => {
  res.json({
    name: "Local LLM Inference Server",
    status: "ok",
    model: OLLAMA_MODEL,
    endpoints: {
      "POST /infer": "Send a prompt to the local Ollama model"
    },
    exampleBody: {
      prompt: "Explain quantum computing in one sentence."
    }
  });
});

app.post("/infer", async (req, res) => {
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
  });

  server.on("error", (error) => {
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