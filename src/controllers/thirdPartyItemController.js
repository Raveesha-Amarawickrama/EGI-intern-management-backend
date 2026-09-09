const ThirdPartyItem = require("../models/ThirdPartyItem");
const RenewalNotification = require("../models/RenewalNotification");

exports.getAllItems = async (req, res, next) => {
  try {
    const items = await ThirdPartyItem.find()
      .populate("createdBy", "name")
      .sort({ renewalDate: 1 });
    res.json({ success: true, count: items.length, items });
  } catch (err) { next(err); }
};

exports.getOneItem = async (req, res, next) => {
  try {
    const item = await ThirdPartyItem.findById(req.params.id).populate("createdBy", "name");
    if (!item) return res.status(404).json({ success: false, message: "Item not found." });
    res.json({ success: true, item });
  } catch (err) { next(err); }
};

exports.createItem = async (req, res, next) => {
  try {
    if (req.user.supervisorLevel !== "senior")
      return res.status(403).json({ success: false, message: "Only senior supervisors can add renewal items." });

    const { name, vendor, category, renewalDate, renewalCycle, cost, notes, status } = req.body;
    if (!name || !vendor || !renewalDate)
      return res.status(400).json({ success: false, message: "name, vendor and renewalDate are required." });

    const item = await ThirdPartyItem.create({
      name, vendor, category, renewalDate, renewalCycle, cost, notes, status,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, item });
  } catch (err) { next(err); }
};

exports.updateItem = async (req, res, next) => {
  try {
    if (req.user.supervisorLevel !== "senior")
      return res.status(403).json({ success: false, message: "Only senior supervisors can edit renewal items." });

    const allowed = ["name", "vendor", "category", "renewalDate", "renewalCycle", "cost", "notes", "status"];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    // If the renewal date changes, let the reminder window recalculate from scratch,
    // and clear old notifications so stale text (old name/date) doesn't linger in the bell.
    if (updates.renewalDate) {
      updates.lastNotifiedDate = null;
      await RenewalNotification.deleteMany({ item: req.params.id });
    }

    const item = await ThirdPartyItem.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: "Item not found." });

    res.json({ success: true, item });
  } catch (err) { next(err); }
};

exports.deleteItem = async (req, res, next) => {
  try {
    if (req.user.supervisorLevel !== "senior")
      return res.status(403).json({ success: false, message: "Only senior supervisors can remove renewal items." });

    // ── NEW: cascade-delete any notifications tied to this item, so deleting
    // or replacing an item doesn't leave a stale/orphaned reminder in the bell ──
    await RenewalNotification.deleteMany({ item: req.params.id });

    await ThirdPartyItem.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Item removed." });
  } catch (err) { next(err); }
};

exports.markRenewed = async (req, res, next) => {
  try {
    if (req.user.supervisorLevel !== "senior")
      return res.status(403).json({ success: false, message: "Only senior supervisors can mark items as renewed." });

    const item = await ThirdPartyItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Item not found." });

    if (item.renewalCycle === "one-time") {
      item.status = "completed";
    } else {
      const next = new Date(item.renewalDate);
      if (item.renewalCycle === "monthly")   next.setMonth(next.getMonth() + 1);
      if (item.renewalCycle === "quarterly") next.setMonth(next.getMonth() + 3);
      if (item.renewalCycle === "yearly")    next.setFullYear(next.getFullYear() + 1);
      item.renewalDate = next.toISOString().split("T")[0];
      item.status = "active";
    }

    item.lastNotifiedDate = null;
    item.lastRenewedAt = new Date();
    await item.save();

    // ── CHANGED: delete outstanding notifications for this item instead of
    // just marking them read, so the bell doesn't keep an old entry around ──
    await RenewalNotification.deleteMany({ item: item._id });

    res.json({ success: true, item });
  } catch (err) { next(err); }
};

// ── Manually trigger the reminder check (senior only) ──────────────────────
exports.checkRemindersNow = async (req, res, next) => {
  try {
    if (req.user.supervisorLevel !== "senior")
      return res.status(403).json({ success: false, message: "Only senior supervisors can do this." });

    const job = req.app.get("renewalReminderJob");
    if (!job) {
      return res.status(500).json({ success: false, message: "Reminder job is not available. Restart the server." });
    }

    const result = await job.checkRenewals();
    res.json({ success: true, message: `Check complete. ${result.notified || 0} item(s) notified.` });
  } catch (err) { next(err); }
};