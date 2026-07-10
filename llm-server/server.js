require("dotenv").config();

const { randomUUID } = require("crypto");
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
// Each job gets a unique URL path so users can track prompts separately.
app.get("/llm-job/:jobId", (req, res) => {
  res.sendFile(path.join(WEB_ROOT, "llm-job.html"));
});

// Change this if your model has a different name.
// Run `ollama list` in PowerShell to see your exact model name.
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3:8b";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 60000;
// If true, Ollama may include model "thinking" traces depending on model support.
const OLLAMA_THINK = (process.env.OLLAMA_THINK || "false").toLowerCase() === "true";

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

const INFER_QUEUE_CONCURRENCY = parsePositiveInt(process.env.INFER_QUEUE_CONCURRENCY, 1);
const INFER_QUEUE_MAX_SIZE = parsePositiveInt(process.env.INFER_QUEUE_MAX_SIZE, 100);
const INFER_JOB_RETENTION_MS = parsePositiveInt(process.env.INFER_JOB_RETENTION_MS, 3600000);

const inferQueue = [];
const inferJobs = new Map();
let activeInferRequests = 0;

function getQueueStatus() {
  const queued = inferQueue.length;
  const processing = activeInferRequests;
  const completed = Array.from(inferJobs.values()).filter((job) =>
    ["completed", "failed", "timed_out"].includes(job.status)
  ).length;

  return {
    active: processing,
    queued,
    completed,
    totalJobsTracked: inferJobs.size,
    concurrency: INFER_QUEUE_CONCURRENCY,
    maxSize: INFER_QUEUE_MAX_SIZE
  };
}

function cleanupExpiredJobs() {
  const now = Date.now();
  for (const [id, job] of inferJobs.entries()) {
    if (!["completed", "failed", "timed_out"].includes(job.status)) {
      continue;
    }
    if (!job.completedAt) {
      continue;
    }
    if (now - job.completedAt > INFER_JOB_RETENTION_MS) {
      inferJobs.delete(id);
    }
  }
}

function classifyJobFailure(error) {
  if (typeof error?.message === "string" && error.message.toLowerCase().includes("timed out")) {
    return "timed_out";
  }
  return "failed";
}

function createInferenceJob(prompt) {
  cleanupExpiredJobs();

  if (inferQueue.length >= INFER_QUEUE_MAX_SIZE) {
    const queueError = new Error("Inference queue is full");
    queueError.code = "QUEUE_FULL";
    throw queueError;
  }

  const jobId = randomUUID();
  const createdAt = Date.now();
  const job = {
    id: jobId,
    prompt,
    status: "queued",
    createdAt,
    startedAt: null,
    completedAt: null,
    response: null,
    error: null
  };

  inferJobs.set(jobId, job);
  // FIFO: jobs are processed in insertion order.
  inferQueue.push(jobId);
  processInferQueue();
  return job;
}

function processInferQueue() {
  while (activeInferRequests < INFER_QUEUE_CONCURRENCY && inferQueue.length > 0) {
    const nextJobId = inferQueue.shift();
    const nextJob = inferJobs.get(nextJobId);
    if (!nextJob) {
      continue;
    }

    activeInferRequests += 1;

    // Worker loop for one queued job.
    (async () => {
      nextJob.status = "processing";
      nextJob.startedAt = Date.now();

      try {
        const llmResponse = await queryOllama(nextJob.prompt);
        nextJob.status = "completed";
        nextJob.response = llmResponse;
      } catch (error) {
        nextJob.status = classifyJobFailure(error);
        nextJob.error = error.message;
      } finally {
        nextJob.completedAt = Date.now();
        activeInferRequests -= 1;
        processInferQueue();
      }
    })();
  }
}

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
    queue: getQueueStatus(),
    endpoints: {
      "POST /api/infer": "Create an async prompt job and return a job URL",
      "POST /infer": "Legacy alias for /api/infer",
      "GET /api/infer/:jobId": "Get status/result for one prompt job",
      "GET /api/queue": "Get inference queue status"
    },
    exampleBody: {
      prompt: "Explain quantum computing in one sentence."
    }
  });
});

app.get("/api/queue", (req, res) => {
  res.json({
    queue: getQueueStatus()
  });
});

app.get("/api/infer/:jobId", (req, res) => {
  const job = inferJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      error: "Job not found",
      details: "The requested job ID does not exist or has expired."
    });
  }

  const queuedMs = job.startedAt ? job.startedAt - job.createdAt : null;
  const processingMs = job.completedAt && job.startedAt ? job.completedAt - job.startedAt : null;

  return res.json({
    jobId: job.id,
    status: job.status,
    prompt: job.prompt,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    timing: {
      queuedMs,
      processingMs,
      totalMs: job.completedAt ? job.completedAt - job.createdAt : null
    },
    response: job.response,
    error: job.error,
    queue: getQueueStatus()
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
    const trimmedPrompt = prompt.trim();
    const job = createInferenceJob(trimmedPrompt);
    const statusUrl = `/api/infer/${job.id}`;
    const resultPage = `/llm-job/${encodeURIComponent(job.id)}`;

    res.status(202).json({
      message: "Your prompt is being generated. You can submit another prompt right away.",
      jobId: job.id,
      model: OLLAMA_MODEL,
      prompt: trimmedPrompt,
      statusUrl,
      resultPage,
      queue: {
        queueDepthAtAccept: inferQueue.length,
        ...getQueueStatus()
      }
    });
  } catch (error) {
    if (error.code === "QUEUE_FULL") {
      return res.status(503).json({
        error: "Inference queue is full",
        details: `The queue can hold up to ${INFER_QUEUE_MAX_SIZE} waiting requests.`,
        queue: getQueueStatus()
      });
    }

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

const DEFAULT_PORT = 3001;
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
    console.log(
      `Inference queue: concurrency=${INFER_QUEUE_CONCURRENCY}, maxSize=${INFER_QUEUE_MAX_SIZE}, retentionMs=${INFER_JOB_RETENTION_MS}`
    );
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