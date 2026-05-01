const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../utils/gmailMailer");
const axios = require("axios");
const passport = require("passport");

const { verificationEmail } = require("../utils/emailTemplates");
const User = require("../models/user");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// ================= CAPTCHA =================
const verifyCaptcha = async (token) => {
  try {
    const res = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: token,
        },
      },
    );
    return res.data.success;
  } catch (err) {
    console.log("Captcha error:", err.message);
    return false;
  }
};

// ================= SIGNUP =================
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, captcha, profession } = req.body;

    // ✅ Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // ✅ Profession validation
    const allowedProfessions = [
      "student",
      "teacher",
      "engineer",
      "doctor",
      "researcher",
    ];

    if (!profession || !allowedProfessions.includes(profession)) {
      return res.status(400).json({ message: "Invalid profession selected" });
    }

    // ✅ CAPTCHA
    const isHuman = await verifyCaptcha(captcha);
    if (!isHuman) return res.status(400).json({ message: "Captcha failed" });

    // ✅ Existing user check
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Email verification token
    const verificationToken = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    // ✅ Create user
    await User.create({
      name,
      email,
      password: password, // plain password, hook handles hashing
      profession,
      verifyToken: verificationToken,
      isVerified: false,
    });

    // ✅ Send email via Gmail API (HTTPS / port 443 — works on Render)
    const verificationLink = `${process.env.FRONTEND_URL}/verify/${verificationToken}`;

    await sendEmail({
      to: email,
      subject: "Verify Your Email",
      html: verificationEmail(name, verificationLink),
    });

    res.json({ message: "Verification email sent" });
  } catch (err) {
    console.log("Signup error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= VERIFY EMAIL =================
router.get("/verify/:token", async (req, res) => {
  try {
    const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET);

    const user = await User.findOne({ email: decoded.email });
    if (!user) return res.status(400).json({ message: "Invalid token" });

    user.isVerified = true;
    user.verificationToken = null;
    await user.save();

    res.json({ message: "Account verified successfully" });
  } catch (err) {
    res.status(400).json({ message: "Invalid or expired token" });
  }
});

// ================= LOGIN =================
router.post("/login", async (req, res) => {
  try {
    const { email, password, captcha } = req.body;

    const isHuman = await verifyCaptcha(captcha);
    if (!isHuman) return res.status(400).json({ message: "Captcha failed" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    if (!user.isVerified)
      return res.status(403).json({ message: "Verify your email first" });

    const token = jwt.sign(
      { id: user._id, role: user.role, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
        profession: user.profession,
      },
    });
  } catch (err) {
    console.log("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= GOOGLE LOGIN =================
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  async (req, res) => {
    // ✅ ensure profession exists
    if (!req.user.profession) {
      req.user.profession = "student";
      await req.user.save();
    }

    const token = jwt.sign(
      { id: req.user._id, role: req.user.role, isAdmin: req.user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.redirect(
      `${process.env.FRONTEND_URL}/oauth-success?token=${token}&isAdmin=${req.user.isAdmin ? "true" : "false"}`,
    );
  },
);

// ================= ME =================
router.get("/me", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json({ user });
});

module.exports = router;
