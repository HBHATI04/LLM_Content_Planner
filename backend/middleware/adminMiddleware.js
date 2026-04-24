const jwt = require("jsonwebtoken");
const User = require("../models/user");

/**
 * adminMiddleware
 * Two-layer admin check:
 *   Layer 1 — ADMIN_EMAILS in .env (fast, no DB hit, good for demo)
 *   Layer 2 — user.isAdmin flag in MongoDB (proper role-based access)
 *
 * A user is admin if EITHER condition is true.
 * This lets you bootstrap the first admin via .env without touching the DB.
 */
module.exports = async function adminMiddleware(req, res, next) {
  try {
    // 1. Verify JWT
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized — no token." });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Unauthorized — invalid token." });
    }

    // 2. Load user from DB
    const user = await User.findById(decoded.id).select("email isAdmin isVerified");
    if (!user) {
      return res.status(401).json({ message: "Unauthorized — user not found." });
    }

    // 3. Check env whitelist (Layer 1)
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const isEnvAdmin = adminEmails.includes(user.email.toLowerCase());

    // 4. Check DB flag (Layer 2)
    const isDbAdmin = user.isAdmin === true;

    // 5. Auto-promote: if in env whitelist but not yet DB admin, update DB
    if (isEnvAdmin && !isDbAdmin) {
      await User.findByIdAndUpdate(user._id, { isAdmin: true });
      console.log(`[Admin] Auto-promoted ${user.email} to admin via ADMIN_EMAILS env.`);
    }

    if (!isEnvAdmin && !isDbAdmin) {
      return res.status(403).json({
        message: "Forbidden — admin access required.",
        hint: "Ask the system administrator to grant you admin access.",
      });
    }

    // 6. Attach user to request
    req.user = { id: decoded.id, email: user.email, isAdmin: true };
    next();

  } catch (err) {
    console.error("[Admin Middleware Error]", err.message);
    res.status(500).json({ message: "Server error during admin auth." });
  }
};