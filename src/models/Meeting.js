// ─── models/Meeting.js ────────────────────────────────────────────────────────
const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema({
  title:        { type: String, required: true, trim: true },
  description:  { type: String, default: "" },
  date:         { type: Date,   required: true },
  startTime:    { type: String, required: true },
  endTime:      { type: String, required: true },
  location:     { type: String, default: "Online" },
  meetingLink:  { type: String, default: "" },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status:       { type: String, enum: ["scheduled","completed","cancelled"], default: "scheduled" },
  notes:        { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Meeting", meetingSchema);