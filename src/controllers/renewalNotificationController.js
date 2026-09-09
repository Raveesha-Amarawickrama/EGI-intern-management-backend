const RenewalNotification = require("../models/RenewalNotification");

// GET /api/renewal-notifications
exports.getMyNotifications = async (req, res, next) => {
  try {
    const notifications = await RenewalNotification.find({ recipient: req.user._id })
      .populate("item", "name vendor renewalDate status")
      .sort({ createdAt: -1 })
      .limit(50);

    // ── NEW: defensively filter out any notification whose item no longer
    // exists (covers old data from before the cascade-delete fix above) ─────
    const valid = notifications.filter(n => n.item);

    res.json({ success: true, notifications: valid });
  } catch (err) { next(err); }
};

// PATCH /api/renewal-notifications/:id/read
exports.markRead = async (req, res, next) => {
  try {
    const notif = await RenewalNotification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ success: false, message: "Notification not found." });
    res.json({ success: true, notification: notif });
  } catch (err) { next(err); }
};

// PATCH /api/renewal-notifications/read-all
exports.markAllRead = async (req, res, next) => {
  try {
    await RenewalNotification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
    res.json({ success: true, message: "All notifications marked as read." });
  } catch (err) { next(err); }
};