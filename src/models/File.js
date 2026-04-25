const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  storedName:   { type: String, required: true },
  filePath:     { type: String, required: true },
  fileType:     { type: String, required: true },
  fileSize:     { type: Number, required: true },
  mimeType:     { type: String },
  projectId:    { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
  uploadedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  uploaderRole: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("File", fileSchema);