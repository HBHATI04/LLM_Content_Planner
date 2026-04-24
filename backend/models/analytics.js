const mongoose = require("mongoose");

const analyticsSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: ["message", "error", "image", "file"],
      required: true,
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    userEmail: { type: String, index: true },
    expert: { type: String, index: true },
    sessionId: { type: String },

    // Performance
    responseTimeMs: { type: Number, default: null },

    // Token usage
    tokensIn: { type: Number, default: 0 },
    tokensOut: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },

    // Content
    promptLength: { type: Number, default: 0 },
    messageId: { type: String, default: null },

    // Generation flags
    generatedImage: { type: Boolean, default: false },
    generatedFile: { type: Boolean, default: false },
    fileType: { type: String, default: null }, // "pdf" | "docx"

    // Errors
    errorType: { type: String, default: null },
    errorMessage: { type: String, default: null },

    // Timestamp (from AI-ENGINE, not DB insert time)
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: true, // createdAt, updatedAt
    collection: "analytics",
  }
);

// Compound indexes for common aggregation queries
analyticsSchema.index({ timestamp: -1, eventType: 1 });
analyticsSchema.index({ userId: 1, timestamp: -1 });
analyticsSchema.index({ expert: 1, timestamp: -1 });

module.exports = mongoose.model("Analytics", analyticsSchema);