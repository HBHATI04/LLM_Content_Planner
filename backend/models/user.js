const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      // Not required — OAuth users have no password
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    // ── Admin flag ────────────────────────────────────────────────────────
    // Set true manually in DB or via ADMIN_EMAILS env variable on first login
    isAdmin: {
      type: Boolean,
      default: false,
    },
    provider: {
      type: String,
      enum: ["local", "google", "github"],
      default: "local",
    },
    googleId: String,
    githubId: String,
    verifyToken: String,
    verifyTokenExpiry: Date,
    resetToken: String,
    resetTokenExpiry: Date,
  },
  { timestamps: true }
);

// Hash password before save
// Note: async pre-hooks in Mongoose 6+ don't use next() — return a promise instead
userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);