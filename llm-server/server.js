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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Express server running at http://localhost:${PORT}`);
  console.log(`Using Ollama model: ${OLLAMA_MODEL}`);
});