// routes/files.js  – all uploads go to Cloudinary via multer-storage-cloudinary
const express    = require("express");
const router     = express.Router();
const File       = require("../models/File");
const Project    = require("../models/Project");
const { protect } = require("../middleware/auth");
const cloudinary  = require("../config/cloudinary");
const { generalUpload } = require("../middleware/uploadCloudinary");

const safeDestroy = async (publicId) => {
  if (!publicId) return;
  try { await cloudinary.uploader.destroy(publicId, { resource_type: "auto" }); }
  catch (_) { /* ignore */ }
};

// ── GET /api/files/project/:projectId ────────────────────────────────────────
router.get("/project/:projectId", protect, async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (
      req.user.role !== "supervisor" &&
      !project.members.includes(req.user._id) &&
      String(project.createdBy) !== String(req.user._id)
    ) {
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

// ── GET /api/files ────────────────────────────────────────────────────────────
router.get("/", protect, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (req.user.role === "intern") filter.uploadedBy = req.user._id;
    if (status) filter.status = status;

    const files = await File.find(filter)
      .sort({ createdAt: -1 })
      .populate("uploadedBy reviewedBy", "name role avatar avatarColor");

    res.json({ files });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/files/upload/:projectId ────────────────────────────────────────
router.post("/upload/:projectId", protect, generalUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file provided" });

    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      await safeDestroy(req.file.filename);
      return res.status(404).json({ message: "Project not found" });
    }

    if (
      req.user.role !== "supervisor" &&
      !project.members.includes(req.user._id) &&
      String(project.createdBy) !== String(req.user._id)
    ) {
      await safeDestroy(req.file.filename);
      return res.status(403).json({ message: "Access denied" });
    }

    const ext = (req.file.originalname.split(".").pop() || "").toLowerCase();

    const file = await File.create({
      originalName:  req.file.originalname,
      storedName:    req.file.filename,   // Cloudinary public_id
      filePath:      req.file.path,       // Cloudinary secure URL
      cloudPublicId: req.file.filename,
      fileType:      ext,
      fileSize:      req.file.size || 0,
      mimeType:      req.file.mimetype,
      projectId,
      uploadedBy:    req.user._id,
      uploaderRole:  req.user.role,
    });

    const populated = await file.populate("uploadedBy", "name role avatar avatarColor");
    res.status(201).json({ file: populated });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/files/upload  (general – no project) ───────────────────────────
router.post("/upload", protect, generalUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file provided" });

    const ext = (req.file.originalname.split(".").pop() || "").toLowerCase();

    const file = await File.create({
      originalName:  req.file.originalname,
      storedName:    req.file.filename,
      filePath:      req.file.path,
      cloudPublicId: req.file.filename,
      fileType:      ext,
      fileSize:      req.file.size || 0,
      mimeType:      req.file.mimetype,
      uploadedBy:    req.user._id,
      uploaderRole:  req.user.role,
    });

    const populated = await file.populate("uploadedBy", "name role avatar avatarColor");
    res.status(201).json({ file: populated });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── PATCH /api/files/:id/status ───────────────────────────────────────────────
router.patch("/:id/status", protect, async (req, res) => {
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
});

// ── DELETE /api/files/:id ─────────────────────────────────────────────────────
router.delete("/:id", protect, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: "File not found" });

    if (
      String(file.uploadedBy._id || file.uploadedBy) !== String(req.user._id) &&
      req.user.role !== "supervisor"
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await safeDestroy(file.cloudPublicId || file.storedName);
    await file.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET /api/files/:id/download ───────────────────────────────────────────────
router.get("/:id/download", protect, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: "File not found" });

    // Redirect to Cloudinary URL directly (browser handles download)
    if (file.filePath && /^https?:\/\//i.test(file.filePath)) {
      return res.redirect(file.filePath);
    }

    // Legacy: serve from disk for old local uploads
    const path = require("path");
    const fs   = require("fs");
    const diskPath = path.join(__dirname, "../uploads", file.storedName);
    if (!fs.existsSync(diskPath))
      return res.status(404).json({ message: "File not found" });

    res.download(diskPath, file.originalName);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;