// controllers/socialProjectController.js
const SocialProject = require("../models/SocialProject");
const User          = require("../models/User");

// Allow anyone who is NOT an intern (handles all supervisor role variations)
const isSupervisor = (user) => user.role !== "intern";

// ─── Create ───────────────────────────────────────────────────────────────────
exports.createSocialProject = async (req, res) => {
  try {
    if (!isSupervisor(req.user))
      return res.status(403).json({ success: false, message: "Supervisor access required" });

    const { name, description, assignedPersons = [], platformUrls = [] } = req.body;

    if (!name?.trim())
      return res.status(400).json({ success: false, message: "Project name is required" });

    const project = await SocialProject.create({
      name: name.trim(),
      description,
      assignedPersons,
      platformUrls,
      createdBy: req.user._id,
    });

    await project.populate("assignedPersons", "name email role");
    res.status(201).json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get all ──────────────────────────────────────────────────────────────────
exports.getAllSocialProjects = async (req, res) => {
  try {
    const filter = { isActive: true };

    if (!isSupervisor(req.user)) {
      filter.assignedPersons = req.user._id;
    }

    const projects = await SocialProject.find(filter)
      .populate("assignedPersons", "name email role")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get single ───────────────────────────────────────────────────────────────
exports.getSocialProject = async (req, res) => {
  try {
    const project = await SocialProject.findById(req.params.id)
      .populate("assignedPersons", "name email role")
      .populate("createdBy", "name email");

    if (!project)
      return res.status(404).json({ success: false, message: "Social project not found" });

    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Update ───────────────────────────────────────────────────────────────────
exports.updateSocialProject = async (req, res) => {
  try {
    if (!isSupervisor(req.user))
      return res.status(403).json({ success: false, message: "Supervisor access required" });

    const { name, description, assignedPersons, platformUrls, isActive } = req.body;

    const project = await SocialProject.findById(req.params.id);
    if (!project)
      return res.status(404).json({ success: false, message: "Social project not found" });

    if (name            !== undefined) project.name            = name.trim();
    if (description     !== undefined) project.description     = description;
    if (assignedPersons !== undefined) project.assignedPersons = assignedPersons;
    if (platformUrls    !== undefined) project.platformUrls    = platformUrls;
    if (isActive        !== undefined) project.isActive        = isActive;

    await project.save();
    await project.populate("assignedPersons", "name email role");

    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Delete ───────────────────────────────────────────────────────────────────
exports.deleteSocialProject = async (req, res) => {
  try {
    if (!isSupervisor(req.user))
      return res.status(403).json({ success: false, message: "Supervisor access required" });

    await SocialProject.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Social project deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get all assignable members ───────────────────────────────────────────────
exports.getMembers = async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ["intern", "supervisor"] } })
      .select("name role avatar avatarColor position")
      .sort({ role: 1, name: 1 });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};