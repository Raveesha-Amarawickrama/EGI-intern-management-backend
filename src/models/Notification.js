// src/models/Notification.js
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    type: {
      type: String,
      enum: [
        "post",
        "comment",
        "like",
        "mention",
        "system",
        "performance",
        "content_assigned",       // sent to intern when new content is assigned
        "performance_submitted",  // sent to supervisors when intern submits metrics
      ],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    // relatedId + relatedModel allow linking to any collection (SocialContent, Task, etc.)
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    relatedModel: {
      type: String,
      enum: ["SocialContent", "Task", "User", "Post"],
    },
    // kept for backward compatibility with any existing notifications
    relatedContent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SocialContent",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);