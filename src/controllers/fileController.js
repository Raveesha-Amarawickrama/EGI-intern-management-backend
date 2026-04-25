// controllers/fileController.js
const path = require("path");
const fs   = require("fs");
const File = require("../models/File");

const UPLOAD_DIR = path.join(__dirname, "../uploads");

// GET /api/files
const getFiles = async (req, res) => {
  try {
    const { status } = req.query;
    const filter     = {};

    // Interns see only their own uploads; supervisors see all
    if (req.user.role === "intern") filter.uploadedBy = req.user._id;
    if (status) filter.status = status;

    const files = await File.find(filter)
      .sort({ createdAt: -1 })
      .populate("uploadedBy reviewedBy", "name role avatar avatarColor");

    res.json({ files });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// POST /api/files/upload   (multer attaches req.file)
const uploadFile = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: "No file provided" });

    const ext  = path.extname(req.file.originalname).replace(".", "").toLowerCase();

    const file = await File.create({
      originalName: req.file.originalname,
      storedName:   req.file.filename,
      filePath:     `/uploads/${req.file.filename}`,
      fileType:     ext,
      fileSize:     req.file.size,
      mimeType:     req.file.mimetype,
      uploadedBy:   req.user._id,
      uploaderRole: req.user.role,
    });

    const populated = await file.populate("uploadedBy", "name role avatar avatarColor");
    res.status(201).json({ file: populated });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// PATCH /api/files/:id/status   (supervisors only)
const changeFileStatus = async (req, res) => {
  try {
    if (req.user.role !== "supervisor")
      return res.status(403).json({ message: "Supervisors only" });

    const { status, reviewNote } = req.body;

    const file = await File.findByIdAndUpdate(
      req.params.id,
      { status, reviewNote: reviewNote || "", reviewedBy: req.user._id },
      { new: true }
    ).populate("uploadedBy reviewedBy", "name role avatar avatarColor");

    if (!file) return res.status(404).json({ message: "File not found" });

    res.json({ file });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// DELETE /api/files/:id
const deleteFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: "File not found" });

    // Only uploader or supervisor can delete
    if (
      String(file.uploadedBy._id || file.uploadedBy) !== String(req.user._id) &&
      req.user.role !== "supervisor"
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Remove file from disk
    const diskPath = path.join(UPLOAD_DIR, file.storedName);
    if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);

    await file.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// GET /api/files/:id/download
const downloadFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: "File not found" });

    const diskPath = path.join(UPLOAD_DIR, file.storedName);
    if (!fs.existsSync(diskPath))
      return res.status(404).json({ message: "File not found on disk" });

    res.download(diskPath, file.originalName);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { getFiles, uploadFile, changeFileStatus, deleteFile, downloadFile };