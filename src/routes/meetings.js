const express = require("express");
const router  = express.Router();
const Meeting = require("../models/Meeting");
const { protect } = require("../middleware/auth");

const POPULATE = { path: "participants createdBy", select: "name role avatar avatarColor" };

router.get("/", protect, async (req, res) => {
  try {
    const query = req.user.role === "intern"
      ? { participants: req.user._id }
      : {};

    const meetings = await Meeting.find(query)
      .sort({ date: 1 })
      .populate(POPULATE);

    res.json({ meetings });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/", protect, async (req, res) => {
  try {
    if (req.user.role !== "supervisor")
      return res.status(403).json({ message: "Supervisors only" });

    const meeting   = await Meeting.create({ ...req.body, createdBy: req.user._id });
    const populated = await meeting.populate(POPULATE);
    res.status(201).json({ meeting: populated });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// NOTE: specific routes must come BEFORE /:id
router.patch("/:id/status", protect, async (req, res) => {
  try {
    const { status } = req.body;
    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate(POPULATE);

    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    res.json({ meeting });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.patch("/:id", protect, async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate(POPULATE);

    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    res.json({ meeting });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    await meeting.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;