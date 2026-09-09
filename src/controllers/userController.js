// controllers/userController.js
const User      = require("../models/User");
const Task      = require("../models/Task");
const cloudinary = require("../config/cloudinary");

// ── helpers ───────────────────────────────────────────────────────────────────
const safeDestroy = async (publicId, resourceType = "image") => {
  if (!publicId) return;
  try { await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }); }
  catch (_) { /* ignore – asset may already be gone */ }
};

// ── GET /api/users ────────────────────────────────────────────────────────────
exports.getAllUsers = async (req, res, next) => {
  try {
    const { role } = req.query;
    let filter = role ? { role } : {};

    if (req.user.supervisorLevel === "junior") {
      if (!role || role === "intern") {
        filter = { role: "intern" };
      } else if (role === "supervisor") {
        filter = { _id: req.user._id };
      } else {
        filter = { $or: [{ role: "intern" }, { _id: req.user._id }] };
      }
    }

    const users = await User.find(filter).select("-password").sort({ name: 1 });
    res.json({ success: true, count: users.length, users });
  } catch (err) { next(err); }
};

// ── GET /api/users/:id ────────────────────────────────────────────────────────
exports.getUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.role === "intern" && String(req.user._id) !== id)
      return res.status(403).json({ success: false, message: "Access denied." });

    if (req.user.supervisorLevel === "junior") {
      const target = await User.findById(id).select("-password");
      if (!target) return res.status(404).json({ success: false, message: "User not found." });
      if (target.role === "supervisor" && target.supervisorLevel === "senior" && String(target._id) !== String(req.user._id))
        return res.status(403).json({ success: false, message: "Access denied." });
      return res.json({ success: true, user: target });
    }

    const user = await User.findById(id).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    res.json({ success: true, user });
  } catch (err) { next(err); }
};

// ── PATCH /api/users/:id ──────────────────────────────────────────────────────
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.role === "intern" && String(req.user._id) !== id)
      return res.status(403).json({ success: false, message: "Access denied." });

    const editingOther = String(req.user._id) !== id;
    if (editingOther && req.user.role !== "supervisor")
      return res.status(403).json({ success: false, message: "Access denied." });

    const allowed = [
      "name", "email", "contact", "position", "department", "startDate", "endDate",
      "avatar", "avatarColor",
      "gender", "dateOfBirth", "nic", "address",
      "emergencyContactName", "emergencyContactPhone",
    ];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (req.body.bankDetails !== undefined) {
      updates.bankDetails = {
        bankName:          req.body.bankDetails.bankName          || "",
        accountHolderName: req.body.bankDetails.accountHolderName || "",
        accountNumber:     req.body.bankDetails.accountNumber     || "",
        branchName:        req.body.bankDetails.branchName        || "",
        ifscOrSwift:       req.body.bankDetails.ifscOrSwift       || "",
      };
    }

    // ── Family details ─────────────────────────────────────────────────────
    if (req.body.familyDetails !== undefined) {
      const fd = req.body.familyDetails;
      updates.familyDetails = {
        spouse: {
          name:       fd.spouse?.name       || "",
          nic:        fd.spouse?.nic        || "",
          occupation: fd.spouse?.occupation || "",
          contact:    fd.spouse?.contact    || "",
        },
        father: {
          name:       fd.father?.name       || "",
          nic:        fd.father?.nic        || "",
          occupation: fd.father?.occupation || "",
          contact:    fd.father?.contact    || "",
        },
        mother: {
          name:       fd.mother?.name       || "",
          nic:        fd.mother?.nic        || "",
          occupation: fd.mother?.occupation || "",
          contact:    fd.mother?.contact    || "",
        },
        children: Array.isArray(fd.children)
          ? fd.children.map(c => ({
              name:        c.name        || "",
              dateOfBirth: c.dateOfBirth || "",
              nic:         c.nic         || "",
            }))
          : [],
      };
    }

    if (req.body.supervisorLevel !== undefined && req.user.supervisorLevel === "senior")
      updates.supervisorLevel = req.body.supervisorLevel;

    const user = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).select("-password");
    res.json({ success: true, user });
  } catch (err) { next(err); }
};

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────
exports.deleteUser = async (req, res, next) => {
  try {
    if (req.user.supervisorLevel !== "senior")
      return res.status(403).json({ success: false, message: "Senior supervisors only." });

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "User deleted." });
  } catch (err) { next(err); }
};

// ── GET /api/users/:id/stats ──────────────────────────────────────────────────
exports.getUserStats = async (req, res, next) => {
  try {
    const allTasks   = await Task.find({ assignedTo: req.params.id });

    const realTasks  = allTasks.filter(t => t.isLeave !== true);
    const leaveDays  = allTasks.filter(t => t.isLeave === true).length;

    const total      = realTasks.length;
    const done       = realTasks.filter(t => t.status === "Done").length;
    const inProgress = realTasks.filter(t => t.status === "In Progress").length;
    const hold       = realTasks.filter(t => t.status === "Hold").length;
    const todo       = realTasks.filter(t => t.status === "To Do").length;

    const totalMins  = realTasks.reduce((s, t) => {
      const p   = t.totalMinutes || 0;
      const sub = (t.subTasks || []).reduce((ss, st) => ss + (st.totalMinutes || 0), 0);
      return s + (p > 0 ? p : sub);
    }, 0);

    const pct = total ? Math.round((done / total) * 100) : 0;

    res.json({ success: true, stats: { total, done, inProgress, hold, todo, leaveDays, totalMins, pct } });
  } catch (err) { next(err); }
};

// ── POST /api/users/:id/profile-picture ──────────────────────────────────────
exports.uploadProfilePicture = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (String(req.user._id) !== id && req.user.role !== "supervisor")
      return res.status(403).json({ success: false, message: "Access denied." });

    if (!req.file)
      return res.status(400).json({ success: false, message: "No image file uploaded." });

    const user = await User.findById(id);
    if (!user) {
      // Clean up the just-uploaded Cloudinary asset
      await safeDestroy(req.file.filename, "image");
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Delete the old profile picture from Cloudinary (if any)
    await safeDestroy(user.profilePictureId, "image");

    // req.file.path   = Cloudinary secure URL
    // req.file.filename = Cloudinary public_id
    user.profilePicture   = req.file.path;
    user.profilePictureId = req.file.filename;
    await user.save();

    res.json({ success: true, user: user.toSafeObject() });
  } catch (err) { next(err); }
};

// ── DELETE /api/users/:id/profile-picture ────────────────────────────────────
exports.deleteProfilePicture = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (String(req.user._id) !== id && req.user.role !== "supervisor")
      return res.status(403).json({ success: false, message: "Access denied." });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    await safeDestroy(user.profilePictureId, "image");
    user.profilePicture   = "";
    user.profilePictureId = "";
    await user.save();

    res.json({ success: true, user: user.toSafeObject() });
  } catch (err) { next(err); }
};

// ── POST /api/users/:id/documents/:docType ────────────────────────────────────
// docType: "cv" | "policeReport" | "gramaNiladhari"
exports.uploadUserDocument = async (req, res, next) => {
  try {
    const { id, docType } = req.params;
    const VALID_TYPES = ["cv", "policeReport", "gramaNiladhari"];

    if (!VALID_TYPES.includes(docType))
      return res.status(400).json({ success: false, message: `Invalid docType. Must be one of: ${VALID_TYPES.join(", ")}` });

    // Owner or supervisor can upload
    if (String(req.user._id) !== id && req.user.role !== "supervisor")
      return res.status(403).json({ success: false, message: "Access denied." });

    if (!req.file)
      return res.status(400).json({ success: false, message: "No file uploaded." });

    const user = await User.findById(id);
    if (!user) {
      await safeDestroy(req.file.filename, "raw");
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Remove old Cloudinary asset
    const oldDoc = user.documents?.[docType];
    if (oldDoc?.publicId) await safeDestroy(oldDoc.publicId, "raw");

    user.documents = user.documents || {};
    user.documents[docType] = {
      url:        req.file.path,     // Cloudinary secure URL
      publicId:   req.file.filename, // Cloudinary public_id
      uploadedAt: new Date(),
    };

    await user.save();
    res.json({ success: true, user: user.toSafeObject() });
  } catch (err) { next(err); }
};

// ── DELETE /api/users/:id/documents/:docType ──────────────────────────────────
exports.deleteUserDocument = async (req, res, next) => {
  try {
    const { id, docType } = req.params;
    const VALID_TYPES = ["cv", "policeReport", "gramaNiladhari"];

    if (!VALID_TYPES.includes(docType))
      return res.status(400).json({ success: false, message: "Invalid docType." });

    if (String(req.user._id) !== id && req.user.role !== "supervisor")
      return res.status(403).json({ success: false, message: "Access denied." });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const doc = user.documents?.[docType];
    if (doc?.publicId) await safeDestroy(doc.publicId, "raw");

    user.documents[docType] = { url: "", publicId: "", uploadedAt: null };
    await user.save();

    res.json({ success: true, user: user.toSafeObject() });
  } catch (err) { next(err); }
};