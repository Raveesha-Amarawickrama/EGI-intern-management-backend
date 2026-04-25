// controllers/socialController.js
const SocialContent  = require("../models/SocialContent");
const Notification   = require("../models/Notification");
const User           = require("../models/User");
const SocialProject  = require("../models/SocialProject");

const isSupervisor = (user) =>
  user.role === "admin" || user.role === "supervisor";

exports.createContent = async (req, res) => {
  try {
    const { socialProject: socialProjectId, platform, plannedPostDate, assignedTo, contentDescription, postUrl } = req.body;

    const socialProject = await SocialProject.findById(socialProjectId);
    if (!socialProject) return res.status(404).json({ success: false, message: "Social project not found" });

    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser) return res.status(404).json({ success: false, message: "Assigned user not found" });

    let resolvedPostUrl = postUrl;
    if (!resolvedPostUrl && platform) {
      const entry = socialProject.platformUrls.find(p => p.platform === platform);
      if (entry?.url) resolvedPostUrl = entry.url;
    }

    const content = await SocialContent.create({
      socialProject: socialProjectId,
      title:         socialProject.name,
      platform,
      plannedPostDate,
      assignedTo,
      assignedBy:    req.user._id,
      contentDescription,
      postUrl:       resolvedPostUrl || "",
    });

    await content.populate("socialProject", "name platformUrls");
    await content.populate("assignedTo",    "name email");
    await content.populate("assignedBy",    "name email");

    await Notification.create({
      recipient:    assignedTo,
      type:         "content_assigned",
      message:      `New content assigned: "${socialProject.name}" for ${platform} — due ${new Date(plannedPostDate).toLocaleDateString()}`,
      relatedId:    content._id,
      relatedModel: "SocialContent",
    });

    const io = req.app.get("io");
    if (io) io.to(assignedTo.toString()).emit("notification", {
      type: "content_assigned",
      message: `New content assigned: "${socialProject.name}"`,
    });

    res.status(201).json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllContent = async (req, res) => {
  try {
    const { status, platform, page = 1, limit = 100 } = req.query;
    const filter = {};

    if (!isSupervisor(req.user)) filter.assignedTo = req.user._id;
    if (status)   filter.status   = status;
    if (platform) filter.platform = platform;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [contents, total] = await Promise.all([
      SocialContent.find(filter)
        .populate("socialProject", "name platformUrls assignedPersons")
        .populate("assignedTo",    "name email")
        .populate("assignedBy",    "name email")
        .sort({ plannedPostDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      SocialContent.countDocuments(filter),
    ]);

    res.json({
      success: true, data: contents,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getContent = async (req, res) => {
  try {
    const content = await SocialContent.findById(req.params.id)
      .populate("socialProject", "name platformUrls")
      .populate("assignedTo",    "name email")
      .populate("assignedBy",    "name email");

    if (!content) return res.status(404).json({ success: false, message: "Content not found" });

    if (!isSupervisor(req.user) && content.assignedTo._id.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: "Access denied" });

    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateContent = async (req, res) => {
  try {
    const content = await SocialContent.findById(req.params.id);
    if (!content) return res.status(404).json({ success: false, message: "Content not found" });

    if (!isSupervisor(req.user)) {
      if (content.assignedTo.toString() !== req.user._id.toString())
        return res.status(403).json({ success: false, message: "Access denied" });
      const { status, postUrl } = req.body;
      if (status) content.status = status;
      if (status === "Posted" && !content.actualPostDate) content.actualPostDate = new Date();
      if (postUrl !== undefined) content.postUrl = postUrl;
    } else {
      const { socialProject: spId, ...rest } = req.body;
      if (spId) {
        const sp = await SocialProject.findById(spId);
        if (sp) { content.socialProject = spId; content.title = sp.name; }
      }
      Object.assign(content, rest);
    }

    await content.save();
    await content.populate("socialProject", "name platformUrls");
    await content.populate("assignedTo",    "name email");
    await content.populate("assignedBy",    "name email");

    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAsPosted = async (req, res) => {
  try {
    const { postUrl } = req.body;
    const content = await SocialContent.findById(req.params.id);

    if (!content) return res.status(404).json({ success: false, message: "Content not found" });

    if (!isSupervisor(req.user) && content.assignedTo.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: "Access denied" });

    content.status         = "Posted";
    content.actualPostDate = new Date();
    if (postUrl) content.postUrl = postUrl;
    await content.save();

    res.json({ success: true, data: content, message: "Content marked as posted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.submitPerformance = async (req, res) => {
  try {
    const { views, likes, comments, shares } = req.body;
    const content = await SocialContent.findById(req.params.id);

    if (!content) return res.status(404).json({ success: false, message: "Content not found" });

    if (!isSupervisor(req.user) && content.assignedTo.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: "Access denied" });

    if (content.status !== "Posted" && content.status !== "Pending Review")
      return res.status(400).json({ success: false, message: "Can only add metrics to posted content" });

    const v  = parseInt(views)    || 0;
    const l  = parseInt(likes)    || 0;
    const cm = parseInt(comments) || 0;
    const s  = parseInt(shares)   || 0;

    content.metrics = {
      views: v,
      likes: l,
      comments: cm,
      shares: s,
      engagementRate:   v > 0 ? parseFloat((((l + cm + s) / v) * 100).toFixed(2)) : 0,
      performanceScore: v + (l * 2) + (cm * 3),
    };
    content.performanceCheckedAt = new Date();
    content.status               = "Reviewed";
    await content.save();

    const admins = await User.find({ role: { $in: ["admin", "supervisor"] } }).select("_id");
    await Promise.all(admins.map(a =>
      Notification.create({
        recipient:    a._id,
        type:         "performance_submitted",
        message:      `Performance data submitted for: "${content.title}"`,
        relatedId:    content._id,
        relatedModel: "SocialContent",
      })
    ));

    await content.populate("assignedTo", "name email");
    res.json({ success: true, data: content, message: "Performance metrics recorded" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteContent = async (req, res) => {
  try {
    if (!isSupervisor(req.user))
      return res.status(403).json({ success: false, message: "Supervisor access required" });

    await SocialContent.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Content deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const filter = !isSupervisor(req.user) ? { assignedTo: req.user._id } : {};

    const [total, missed, pendingReview, posted, planned] = await Promise.all([
      SocialContent.countDocuments(filter),
      SocialContent.countDocuments({ ...filter, status: "Missed"         }),
      SocialContent.countDocuments({ ...filter, status: "Reviewed" }),
      SocialContent.countDocuments({ ...filter, status: "Posted"         }),
      SocialContent.countDocuments({ ...filter, status: "Planned"        }),
    ]);

    const topPerformers = await SocialContent.find({
      ...filter,
      status: "Posted",
      "metrics.performanceScore": { $exists: true, $gt: 0 },
      actualPostDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    })
      .sort({ "metrics.performanceScore": -1 })
      .limit(5)
      .populate("assignedTo",    "name")
      .populate("socialProject", "name");

    const platformBreakdown = await SocialContent.aggregate([
      { $match: filter },
      { $group: {
          _id:    "$platform",
          count:  { $sum: 1 },
          missed: { $sum: { $cond: [{ $eq: ["$status", "Missed"] }, 1, 0] } },
      }},
    ]);

    res.json({
      success: true,
      data: { overview: { total, missed, pendingReview, posted, planned }, topPerformers, platformBreakdown },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};