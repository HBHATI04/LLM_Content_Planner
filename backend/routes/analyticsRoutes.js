const express = require("express");
const router = express.Router();
const Analytics = require("../models/Analytics");
const User = require("../models/user");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

// ── Ingest event from AI-ENGINE ───────────────────────────────────────────────
router.post("/event", async (req, res) => {
  const token = req.headers["x-internal-token"];
  if (token !== process.env.INTERNAL_TOKEN) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const {
      eventType, userId, expert, sessionId,
      responseTimeMs, tokensIn, tokensOut,
      errorType, errorMessage,
      generatedImage, generatedFile, fileType,
      promptLength, messageId, timestamp,
    } = req.body;

    let userEmail = null;
    if (userId && userId !== "anonymous") {
      try {
        const user = await User.findById(userId).select("email").lean();
        userEmail = user?.email || null;
      } catch (_) {}
    }

    const tIn  = tokensIn  || 0;
    const tOut = tokensOut || 0;

    await Analytics.create({
      eventType,
      userId:    userId !== "anonymous" ? userId : null,
      userEmail,
      expert,
      sessionId,
      responseTimeMs,
      tokensIn:    tIn,
      tokensOut:   tOut,
      totalTokens: tIn + tOut,
      errorType,
      errorMessage,
      generatedImage: !!generatedImage,
      generatedFile:  !!generatedFile,
      fileType,
      promptLength,
      messageId,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("Analytics ingest error:", err);
    return res.status(500).json({ error: "Failed to save event" });
  }
});

// ── All routes below: admin only ──────────────────────────────────────────────

// Overview stat cards
router.get("/overview", adminMiddleware, async (req, res) => {
  try {
    const now     = new Date();
    const last24h = new Date(now - 24 * 60 * 60 * 1000);
    const last7d  = new Date(now - 7  * 24 * 60 * 60 * 1000);

    const [
      totalMessages, totalTokens, avgResponseTime,
      errorRate, imagesGenerated, filesGenerated,
      activeUsers24h, messagesLast24h, messagesLast7d,
    ] = await Promise.all([
      Analytics.countDocuments({ eventType: "message" }),

      Analytics.aggregate([{ $group: { _id: null, total: { $sum: "$totalTokens" } } }])
        .then(r => r[0]?.total || 0),

      Analytics.aggregate([
        { $match: { eventType: "message", timestamp: { $gte: last7d }, responseTimeMs: { $ne: null } } },
        { $group: { _id: null, avg: { $avg: "$responseTimeMs" } } }
      ]).then(r => Math.round(r[0]?.avg || 0)),

      Analytics.aggregate([
        { $match: { timestamp: { $gte: last7d } } },
        { $group: { _id: null, total: { $sum: 1 }, errors: { $sum: { $cond: [{ $eq: ["$eventType", "error"] }, 1, 0] } } } }
      ]).then(r => {
        if (!r[0] || r[0].total === 0) return 0;
        return Math.round((r[0].errors / r[0].total) * 100 * 10) / 10;
      }),

      Analytics.countDocuments({ generatedImage: true }),
      Analytics.countDocuments({ generatedFile: true }),

      Analytics.distinct("userId", { userId: { $ne: null }, timestamp: { $gte: last24h } })
        .then(ids => ids.length),

      Analytics.countDocuments({ eventType: "message", timestamp: { $gte: last24h } }),
      Analytics.countDocuments({ eventType: "message", timestamp: { $gte: last7d } }),
    ]);

    return res.json({
      totalMessages, totalTokens, avgResponseTimeMs: avgResponseTime,
      errorRate, imagesGenerated, filesGenerated,
      activeUsers24h, messagesLast24h, messagesLast7d,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch overview" });
  }
});

// Time-series charts
router.get("/charts", adminMiddleware, async (req, res) => {
  try {
    const { period = "7d" } = req.query;
    const days  = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 }[period] || 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const bucket = {
      year:  { $year:  "$timestamp" },
      month: { $month: "$timestamp" },
      day:   { $dayOfMonth: "$timestamp" },
    };

    const [tokensByDay, responseTimeByDay, messagesByDay, errorsByDay] = await Promise.all([
      Analytics.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $group: { _id: bucket, tokensIn: { $sum: "$tokensIn" }, tokensOut: { $sum: "$tokensOut" } } },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]),
      Analytics.aggregate([
        { $match: { eventType: "message", timestamp: { $gte: since }, responseTimeMs: { $ne: null } } },
        { $group: { _id: bucket, avgMs: { $avg: "$responseTimeMs" }, count: { $sum: 1 } } },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]),
      Analytics.aggregate([
        { $match: { eventType: "message", timestamp: { $gte: since } } },
        { $group: { _id: bucket, count: { $sum: 1 } } },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]),
      Analytics.aggregate([
        { $match: { eventType: "error", timestamp: { $gte: since } } },
        { $group: { _id: bucket, count: { $sum: 1 } } },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]),
    ]);

    const fmt = id => `${id.year}-${String(id.month).padStart(2,"0")}-${String(id.day).padStart(2,"0")}`;

    return res.json({
      tokensByDay:      tokensByDay.map(d => ({ date: fmt(d._id), tokensIn: d.tokensIn, tokensOut: d.tokensOut, total: d.tokensIn + d.tokensOut })),
      responseTimeByDay:responseTimeByDay.map(d => ({ date: fmt(d._id), avgMs: Math.round(d.avgMs), count: d.count })),
      messagesByDay:    messagesByDay.map(d => ({ date: fmt(d._id), count: d.count })),
      errorsByDay:      errorsByDay.map(d => ({ date: fmt(d._id), count: d.count })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch charts" });
  }
});

// Per-agent breakdown
router.get("/agents", adminMiddleware, async (req, res) => {
  try {
    const days  = parseInt(req.query.period) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const data = await Analytics.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id:             "$expert",
          totalMessages:   { $sum: { $cond: [{ $eq: ["$eventType","message"] }, 1, 0] } },
          totalErrors:     { $sum: { $cond: [{ $eq: ["$eventType","error"]   }, 1, 0] } },
          totalTokensIn:   { $sum: "$tokensIn"   },
          totalTokensOut:  { $sum: "$tokensOut"  },
          avgResponseMs:   { $avg: "$responseTimeMs" },
          imagesGenerated: { $sum: { $cond: ["$generatedImage", 1, 0] } },
          filesGenerated:  { $sum: { $cond: ["$generatedFile",  1, 0] } },
        },
      },
      { $sort: { totalMessages: -1 } },
    ]);

    return res.json(data.map(a => ({
      expert:          a._id || "unknown",
      totalMessages:   a.totalMessages,
      totalErrors:     a.totalErrors,
      totalTokensIn:   a.totalTokensIn,
      totalTokensOut:  a.totalTokensOut,
      totalTokens:     a.totalTokensIn + a.totalTokensOut,
      avgResponseMs:   Math.round(a.avgResponseMs || 0),
      imagesGenerated: a.imagesGenerated,
      filesGenerated:  a.filesGenerated,
      errorRate:       a.totalMessages > 0 ? Math.round((a.totalErrors / (a.totalMessages + a.totalErrors)) * 1000) / 10 : 0,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch agent stats" });
  }
});

// Per-user breakdown
router.get("/users", adminMiddleware, async (req, res) => {
  try {
    const days  = parseInt(req.query.period) || 30;
    const limit = parseInt(req.query.limit)  || 20;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const data = await Analytics.aggregate([
      { $match: { userId: { $ne: null }, timestamp: { $gte: since } } },
      {
        $group: {
          _id:             "$userId",
          email:           { $last: "$userEmail" },
          totalMessages:   { $sum: { $cond: [{ $eq: ["$eventType","message"] }, 1, 0] } },
          totalErrors:     { $sum: { $cond: [{ $eq: ["$eventType","error"]   }, 1, 0] } },
          totalTokens:     { $sum: "$totalTokens" },
          avgResponseMs:   { $avg: "$responseTimeMs" },
          imagesGenerated: { $sum: { $cond: ["$generatedImage", 1, 0] } },
          filesGenerated:  { $sum: { $cond: ["$generatedFile",  1, 0] } },
          lastActive:      { $max: "$timestamp" },
          experts:         { $push: "$expert" },
        },
      },
      { $sort: { totalMessages: -1 } },
      { $limit: limit },
    ]);

    return res.json(data.map(u => {
      const counts = u.experts.reduce((acc, e) => { if (e) acc[e] = (acc[e]||0)+1; return acc; }, {});
      const favExpert = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
      return {
        userId: u._id, email: u.email || "Unknown",
        totalMessages: u.totalMessages, totalErrors: u.totalErrors,
        totalTokens: u.totalTokens, avgResponseMs: Math.round(u.avgResponseMs || 0),
        imagesGenerated: u.imagesGenerated, filesGenerated: u.filesGenerated,
        lastActive: u.lastActive, favExpert,
      };
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user analytics" });
  }
});

// Error breakdown
router.get("/errors", adminMiddleware, async (req, res) => {
  try {
    const days  = parseInt(req.query.period) || 7;
    const limit = parseInt(req.query.limit)  || 50;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [errorTypes, recentErrors] = await Promise.all([
      Analytics.aggregate([
        { $match: { eventType: "error", timestamp: { $gte: since } } },
        { $group: { _id: "$errorType", count: { $sum: 1 }, experts: { $addToSet: "$expert" } } },
        { $sort: { count: -1 } },
      ]),
      Analytics.find({ eventType: "error", timestamp: { $gte: since } })
        .sort({ timestamp: -1 }).limit(limit).lean(),
    ]);

    return res.json({ errorTypes, recentErrors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch errors" });
  }
});

module.exports = router;