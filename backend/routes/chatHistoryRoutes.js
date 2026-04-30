const express = require("express");
const axios = require("axios");
const authMiddleware = require("../middleware/authMiddleware");
const Chat = require("../models/chat");

const router = express.Router();

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || "http://localhost:8000";

// Proxy: download a generated doc from AI-Engine
async function proxyDocDownload(req, res) {
  const filePath = req.query.path;
  if (!filePath || !filePath.startsWith("/generated_docs/")) {
    return res.status(400).json({ message: "Invalid file path." });
  }
  try {
    const fileRes = await axios.get(`${AI_ENGINE_URL}${filePath}`, {
      responseType: "stream",
      timeout: 30_000,
    });
    res.setHeader("Content-Type", fileRes.headers["content-type"] || "application/octet-stream");
    res.setHeader("Content-Disposition", fileRes.headers["content-disposition"] || `attachment; filename="document"`);
    fileRes.data.pipe(res);
  } catch (err) {
    console.error("[Doc Download Error]", err.message);
    res.status(500).json({ message: "Failed to download document." });
  }
}

// Proxy: serve a generated image from AI-Engine
async function proxyImageServe(req, res) {
  const filePath = req.query.path;
  if (!filePath || !filePath.startsWith("/generated_images/")) {
    return res.status(400).json({ message: "Invalid image path." });
  }
  try {
    const fileRes = await axios.get(`${AI_ENGINE_URL}${filePath}`, {
      responseType: "stream",
      timeout: 30_000,
    });
    res.setHeader("Content-Type", fileRes.headers["content-type"] || "image/png");
    fileRes.data.pipe(res);
  } catch (err) {
    console.error("[Image Serve Error]", err.message);
    res.status(500).json({ message: "Failed to load image." });
  }
}

// ─── Doc Download Proxy ──────────────────────────────────────────────────────
router.get("/doc-download", authMiddleware, proxyDocDownload);

// ─── Image Serve Proxy ────────────────────────────────────────────────────────
router.get("/image", authMiddleware, proxyImageServe);

async function checkAIEngine() {
  try {
    await axios.get(`${AI_ENGINE_URL}/health`, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

// ─── Voice Transcription Proxy ────────────────────────────────────────────────
router.post(
  "/transcribe",
  authMiddleware,
  express.raw({ type: "*/*", limit: "25mb" }),
  async (req, res) => {
    try {
      const audioBuffer = req.body;
      if (!audioBuffer || !audioBuffer.length) {
        return res.status(400).json({ message: "No audio data received." });
      }
      const aiResponse = await axios.post(
        `${AI_ENGINE_URL}/transcribe`,
        audioBuffer,
        {
          headers: {
            "Content-Type": "audio/webm",
            "Content-Length": audioBuffer.length,
          },
          timeout: 30_000,
        }
      );
      res.json({ transcript: aiResponse.data.transcript });
    } catch (err) {
      console.error("[Transcribe Error]", err.response?.data || err.message);
      const detail = err.response?.data?.detail || "Transcription failed.";
      res.status(500).json({ message: detail });
    }
  }
);

// ─── Create New Chat ──────────────────────────────────────────────────────────
router.post("/", authMiddleware, async (req, res) => {
  try {
    const chat = await Chat.create({ user: req.user.id, title: "New Chat", messages: [] });
    res.json(chat);
  } catch (err) {
    console.error("[Create Chat Error]", err.message);
    res.status(500).json({ message: "Error creating chat" });
  }
});

// ─── Get All User Chats ───────────────────────────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
  try {
    const chats = await Chat.find({ user: req.user.id }).sort({ updatedAt: -1 });
    res.json(chats);
  } catch (err) {
    console.error("[Fetch Chats Error]", err.message);
    res.status(500).json({ message: "Error fetching chats" });
  }
});

// ─── STREAMING: Send Message ──────────────────────────────────────────────────
router.post("/:chatId/stream", authMiddleware, async (req, res) => {
  const { content, expert = "strategist" } = req.body;

  // ── FIX 1: always resolve userId from JWT, not just request body ──
  const resolvedUserId = req.user?.id || "anonymous";

  if (!content?.trim()) {
    return res.status(400).json({ message: "Message content cannot be empty." });
  }

  const chat = await Chat.findOne({ _id: req.params.chatId, user: req.user.id });
  if (!chat) return res.status(404).json({ message: "Chat not found." });

  const aiEngineAvailable = await checkAIEngine();
  if (!aiEngineAvailable) {
    return res.status(503).json({ message: "AI service is currently unavailable." });
  }

  // Save user message to DB immediately
  chat.messages.push({ role: "user", content: content.trim() });
  if (chat.title === "New Chat") chat.title = content.substring(0, 40).trim();
  await chat.save();

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let fullText = "";
  let imageUrl = null;
  let fileUrl = null;
  let fileName = null;
  let expertKey = expert;
  let expertLabel = null;
  let expertEmoji = null;

  try {
    // ── FIX 2: forward userId and expert to AI-ENGINE ──
    const aiStream = await axios.post(
      `${AI_ENGINE_URL}/chat/stream`,
      {
        prompt: content,
        history: chat.messages,
        expert,
        userId: resolvedUserId,   // ← was missing before
      },
      {
        responseType: "stream",
        timeout: 0,
      }
    );

    let buffer = "";

    aiStream.data.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        try {
          const event = JSON.parse(trimmedLine);
          if (res.writableEnded) continue;

          if (event.type === "token") {
            fullText += event.value;
            res.write(`data: ${JSON.stringify(event)}\n\n`);

          } else if (event.type === "image") {
            imageUrl = event.value;
            res.write(`data: ${JSON.stringify(event)}\n\n`);

          } else if (event.type === "file") {
            fileUrl = event.fileUrl;
            fileName = event.fileName || "document";
            res.write(`data: ${JSON.stringify(event)}\n\n`);

          } else if (event.type === "expert_meta") {
            // ── FIX 3: capture the real expert key from AI-ENGINE response ──
            expertKey = event.expert || expertKey;
            expertLabel = event.expertLabel || expertLabel;
            expertEmoji = event.expertEmoji || expertEmoji;
            res.write(`data: ${JSON.stringify(event)}\n\n`);

          } else if (event.type === "done") {
            chat.messages.push({
              role: "ai",
              content: fullText || "Here is your generated image:",
              ...(imageUrl && { imageUrl }),
              ...(fileUrl && { fileUrl }),
              ...(fileName && { fileName }),
              ...(expertKey && { expert: expertKey }),
              ...(expertLabel && { expertLabel }),
              ...(expertEmoji && { expertEmoji }),
            });
            chat.save().catch(console.error);

            res.write(`data: ${JSON.stringify({ type: "done", chatId: chat._id })}\n\n`);
            res.end();

          } else if (event.type === "error") {
            res.write(`data: ${JSON.stringify({ type: "error", value: event.value })}\n\n`);
            res.end();
          }
        } catch (e) {
          // Malformed JSON chunk — skip
        }
      }
    });

    aiStream.data.on("error", (err) => {
      if (err.message !== "Premature close") {
        console.error("[Stream pipe error]", err.message);
      }
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: "error", value: "Stream connection lost." })}\n\n`);
        res.end();
      }
    });

    aiStream.data.on("end", () => {
      if (!res.writableEnded) res.end();
    });

    req.on("close", () => {
      aiStream.data.destroy();
    });

  } catch (err) {
    console.error("[Stream Error]", err.message);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: "error", value: "AI processing error." })}\n\n`);
      res.end();
    }
  }
});

// ─── Non-streaming fallback ───────────────────────────────────────────────────
router.post("/:chatId/message", authMiddleware, async (req, res) => {
  try {
    const { content, expert = "strategist" } = req.body;
    const resolvedUserId = req.user?.id || "anonymous";

    if (!content?.trim()) return res.status(400).json({ message: "Message content cannot be empty." });

    const chat = await Chat.findOne({ _id: req.params.chatId, user: req.user.id });
    if (!chat) return res.status(404).json({ message: "Chat not found." });

    const aiEngineAvailable = await checkAIEngine();
    if (!aiEngineAvailable) return res.status(503).json({ message: "AI service is currently unavailable." });

    chat.messages.push({ role: "user", content: content.trim() });
    if (chat.title === "New Chat") chat.title = content.substring(0, 40).trim();

    const aiResponse = await axios.post(
      `${AI_ENGINE_URL}/chat`,
      { prompt: content, history: chat.messages, expert, userId: resolvedUserId },
      { timeout: 0 }
    );

    const aiText = aiResponse.data?.text || "I was unable to generate a response.";
    const aiImageUrl = aiResponse.data?.imageUrl || null;

    chat.messages.push({ role: "ai", content: aiText, ...(aiImageUrl && { imageUrl: aiImageUrl }) });
    await chat.save();
    res.json(chat);

  } catch (err) {
    console.error("[Message Error]", err.message);
    if (err.code === "ECONNABORTED") return res.status(504).json({ message: "AI took too long to respond." });
    res.status(500).json({ message: "AI processing error." });
  }
});

// ─── Delete Chat ──────────────────────────────────────────────────────────────
router.delete("/:chatId", authMiddleware, async (req, res) => {
  try {
    const chat = await Chat.findOneAndDelete({ _id: req.params.chatId, user: req.user.id });
    if (!chat) return res.status(404).json({ message: "Chat not found." });
    res.json({ message: "Chat deleted." });
  } catch (err) {
    console.error("[Delete Chat Error]", err.message);
    res.status(500).json({ message: "Error deleting chat." });
  }
});

module.exports = router;
