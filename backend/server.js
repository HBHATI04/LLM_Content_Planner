const passport = require("passport");
const session = require("express-session");
const express = require("express");
const path = require("path");
const chatRoutes = require("./routes/chatRoutes");
const mongoose = require("mongoose");
const cors = require("cors");
const chatHistoryRoutes = require("./routes/chatHistoryRoutes");
require("dotenv").config();
require("./config/passport");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type'],
}));

app.use(express.json());

app.use((req, res, next) => {
  if (req.path.includes('/stream')) {
    req.setTimeout(0);
    res.setTimeout(0);
  }
  next();
});

app.use((req, res, next) => {
  res.on('close', () => {
    if (!res.writableEnded) {
      console.log(`[PIPE ABORT] ${req.method} ${req.path} — client disconnected early`);
    }
  });
  next();
});

app.use(session({
  secret: "keyboard cat",
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());



app.use("/api/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/chats", chatHistoryRoutes);

// Serve AI-generated images from the AI-ENGINE service folder
// AI-ENGINE saves to: AI-ENGINE/generated_images/
// This makes them available at: GET /generated_images/filename.png
app.use(
  "/generated_images",
  express.static(path.join(__dirname, "../AI-ENGINE/generated_images"))
);

app.use("/analytics", analyticsRoutes);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    app.listen(process.env.PORT, () =>
      console.log(`Server running on port ${process.env.PORT}`)
    );
  })
  .catch(err => console.log(err));