const express = require("express");
const Chat = require("../models/chat");
const User = require("../models/user");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

// ── GET /admin/stats ──────────────────────────────────────────────────────────
router.get("/stats", adminMiddleware, async (req, res) => {
  try {
    const [totalUsers, allChats] = await Promise.all([
      User.countDocuments(),
      Chat.find({}, { messages: 1 }),
    ]);

    const expertCounts = { strategist: 0, copywriter: 0, seo: 0, social: 0, analyst: 0 };
    let totalRuns = 0;

    allChats.forEach((chat) => {
      chat.messages.forEach((msg) => {
        if (msg.role === "ai" && msg.expert) {
          expertCounts[msg.expert] = (expertCounts[msg.expert] || 0) + 1;
          totalRuns++;
        }
      });
    });

    res.json({ total_users: totalUsers, total_runs: totalRuns, avg_time: 4.2, ...expertCounts });
  } catch (err) {
    console.error("[Admin Stats Error]", err.message);
    res.status(500).json({ message: "Error fetching stats" });
  }
});

// ── GET /admin/logs ───────────────────────────────────────────────────────────
router.get("/logs", adminMiddleware, async (req, res) => {
  try {
    const chats = await Chat.find({})
      .populate("user", "email name")
      .sort({ updatedAt: -1 })
      .limit(100);

    const logs = [];
    chats.forEach((chat) => {
      chat.messages.forEach((msg) => {
        if (msg.role === "ai") {
          logs.push({
            user: chat.user?.email || chat.user?.name || "unknown",
            agent: msg.expert || "unknown",
            prompt: msg.content?.substring(0, 120) || "",
            execution_time: 0,
            date: msg.createdAt || chat.updatedAt,
          });
        }
      });
    });

    logs.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(logs.slice(0, 50));
  } catch (err) {
    console.error("[Admin Logs Error]", err.message);
    res.status(500).json({ message: "Error fetching logs" });
  }
});

// ── GET /admin/users ──────────────────────────────────────────────────────────
router.get("/users", adminMiddleware, async (req, res) => {
  try {
    const users = await User.find({})
      .select("name email isAdmin isVerified provider createdAt")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Error fetching users" });
  }
});

// ── PATCH /admin/users/:id/promote ───────────────────────────────────────────
router.patch("/users/:id/promote", adminMiddleware, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isAdmin: true }, { new: true })
      .select("name email isAdmin");
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json({ message: `${user.email} promoted to admin.`, user });
  } catch (err) {
    res.status(500).json({ message: "Error promoting user" });
  }
});

// ── PATCH /admin/users/:id/demote ────────────────────────────────────────────
router.patch("/users/:id/demote", adminMiddleware, async (req, res) => {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ message: "You cannot demote yourself." });
    const user = await User.findByIdAndUpdate(req.params.id, { isAdmin: false }, { new: true })
      .select("name email isAdmin");
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json({ message: `${user.email} demoted.`, user });
  } catch (err) {
    res.status(500).json({ message: "Error demoting user" });
  }
});

module.exports = router;