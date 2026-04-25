const express = require("express");
const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const File = require("../models/File");
const Project = require("../models/Project");
const { protect } = require("../middleware/auth");

// ── Multer setup ──────────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, "../uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).replace(".", "").toLowerCase();
    const allowed = /^(pdf|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|zip|txt)$/;
    cb(null, allowed.test(ext));
  },
});

// GET /api/files/project/:projectId
router.get("/project/:projectId", protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Verify user has access to this project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    if (req.user.role !== "supervisor" && 
        !project.members.includes(req.user._id) && 
        String(project.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const files = await File.find({ projectId })
      .sort({ createdAt: -1 })
      .populate("uploadedBy", "name role avatar avatarColor")
      .populate("projectId", "name");
    
    res.json({ files });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/files/upload/:projectId
router.post("/upload/:projectId", protect, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file provided" });
    }
    
    const { projectId } = req.params;
    
    // Verify user has access to this project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    if (req.user.role !== "supervisor" && 
        !project.members.includes(req.user._id) && 
        String(project.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const ext = path.extname(req.file.originalname).replace(".", "").toLowerCase();
    const file = await File.create({
      originalName: req.file.originalname,
      storedName: req.file.filename,
      filePath: `/uploads/${req.file.filename}`,
      fileType: ext,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      projectId,
      uploadedBy: req.user._id,
      uploaderRole: req.user.role,
    });
    
    const populated = await file.populate("uploadedBy", "name role avatar avatarColor");
    res.status(201).json({ file: populated });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE /api/files/:id
router.delete("/:id", protect, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }
    
    // Verify user has access to delete
    const project = await Project.findById(file.projectId);
    if (req.user.role !== "supervisor" && 
        String(file.uploadedBy) !== String(req.user._id) &&
        String(project.createdBy) !== String(req.user._id)) {
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
});

// GET /api/files/:id/download
router.get("/:id/download", protect, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }
    
    // Verify user has access
    const project = await Project.findById(file.projectId);
    if (req.user.role !== "supervisor" && 
        !project.members.includes(req.user._id) && 
        String(project.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const diskPath = path.join(UPLOAD_DIR, file.storedName);
    if (!fs.existsSync(diskPath)) {
      return res.status(404).json({ message: "File not found on disk" });
    }
    
    res.download(diskPath, file.originalName);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;