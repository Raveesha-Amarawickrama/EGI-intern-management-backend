// src/models/SocialContent.js
const mongoose = require("mongoose");

const socialContentSchema = new mongoose.Schema(
  {
    // References SocialProject (NOT the existing Project model)
    socialProject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SocialProject",
      required: true,
    },

    // Kept for backward compat / display — synced from socialProject.name on create
    title: { type: String },

    platform: {
      type: String,
      enum: ["Instagram", "Facebook", "Twitter", "LinkedIn", "TikTok", "YouTube", "Other"],
      required: true,
    },
    contentDescription:   { type: String },
    plannedPostDate:      { type: Date, required: true },
    actualPostDate:       { type: Date },
    performanceCheckedAt: { type: Date },
    postUrl:              { type: String },
    status: {
      type: String,
      enum: ["Planned", "Posted", "Missed", "Reviewed"],
      default: "Planned",
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    metrics: {
      views:            { type: Number, default: 0 },
      likes:            { type: Number, default: 0 },
      comments:         { type: Number, default: 0 },
      shares:           { type: Number, default: 0 },
      engagementRate:   { type: Number, default: 0 },
      performanceScore: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// Engagement Rate = (Likes + Comments + Shares) / Views × 100
// Performance Score = Views + (Likes × 2) + (Comments × 3)
socialContentSchema.methods.calculateMetrics = function ({ views, likes, comments, shares }) {
  const v = views    || 0;
  const l = likes    || 0;
  const c = comments || 0;
  const s = shares   || 0;

  const engagementRate   = v > 0 ? ((l + c + s) / v) * 100 : 0;
  const performanceScore = v + (l * 2) + (c * 3);

  return {
    views: v, likes: l, comments: c, shares: s,
    engagementRate:   Math.round(engagementRate * 100) / 100,
    performanceScore,
  };
};

module.exports = mongoose.model("SocialContent", socialContentSchema);