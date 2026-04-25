const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiver:  { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  content:   { type: String, required: true, trim: true },
  read:      { type: Boolean, default: false },
  groupType: { type: String, enum: ["interns", "supervisors"], default: null },
  // ── Reply support ──────────────────────────────────────────────────────────
  replyTo: {
    _id:        { type: mongoose.Schema.Types.ObjectId, default: null },
    content:    { type: String, default: '' },
    senderName: { type: String, default: '' },
  },
}, { timestamps: true });

messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ groupType: 1 });

module.exports = mongoose.model("Message", messageSchema);