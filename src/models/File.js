const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  originalName:   { type: String, required: true },
  storedName:     { type: String, required: true }, 
  filePath:       { type: String, required: true }, 
  cloudPublicId:  { type: String, default: "" },    
  fileType:       { type: String, required: true },
  fileSize:       { type: Number, required: true },
  mimeType:       { type: String },
  projectId:      { type: mongoose.Schema.Types.ObjectId, ref: "Project" }, 
  uploadedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  uploaderRole:   { type: String },
  status:         { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  reviewNote:     { type: String, default: "" },
  reviewedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

module.exports = mongoose.model("File", fileSchema);