
const File      = require("../models/File");
const cloudinary = require("../config/cloudinary");

const safeDestroy = async (publicId, resourceType = "auto") => {
  if (!publicId) return;
  try { await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }); }
  catch (_) { }
};


const getFiles = async (req, res) => {
  try {
    const { status } = req.query;
    const filter     = {};

  
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


const uploadFile = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: "No file provided" });

    const originalName = req.file.originalname;
    const ext  = (originalName.split(".").pop() || "").toLowerCase();

    const file = await File.create({
      originalName,
      storedName:   req.file.filename,       
      filePath:     req.file.path,              
      cloudPublicId: req.file.filename,
      fileType:     ext,
      fileSize:     req.file.size || 0,
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


const deleteFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: "File not found" });

    if (
      String(file.uploadedBy._id || file.uploadedBy) !== String(req.user._id) &&
      req.user.role !== "supervisor"
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

  
    await safeDestroy(file.cloudPublicId || file.storedName, "auto");

    await file.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};


const downloadFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: "File not found" });

  
    if (file.filePath && /^https?:\/\//i.test(file.filePath)) {
      return res.redirect(file.filePath);
    }

   
    const path = require("path");
    const fs   = require("fs");
    const UPLOAD_DIR = path.join(__dirname, "../uploads");
    const diskPath   = path.join(UPLOAD_DIR, file.storedName);
    if (!fs.existsSync(diskPath))
      return res.status(404).json({ message: "File not found on disk" });

    res.download(diskPath, file.originalName);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { getFiles, uploadFile, changeFileStatus, deleteFile, downloadFile };