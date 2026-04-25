// src/models/SocialProject.js
// NOTE: This is separate from the existing Project model used elsewhere in the app.
const mongoose = require("mongoose");

const platformUrlSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["Instagram", "Facebook", "Twitter", "LinkedIn", "TikTok", "YouTube", "Other"],
      required: true,
    },
    url: { type: String, default: "" },
  },
  { _id: false }
);

const socialProjectSchema = new mongoose.Schema(
  {
    name:            { type: String, required: true, trim: true },
    description:     { type: String },
    assignedPersons: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    platformUrls:    [platformUrlSchema],  // per-platform URLs for this social project
    createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isActive:        { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SocialProject", socialProjectSchema);