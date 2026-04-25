const express = require("express");
const router  = express.Router();
const Message = require("../models/Message");
const User    = require("../models/User");
const { protect } = require("../middleware/auth");

// ── GET all users ─────────────────────────────────────────────────────────────
router.get("/users", protect, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select("name role avatar avatarColor position");
    res.json(users);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET conversations list ────────────────────────────────────────────────────
router.get("/conversations", protect, async (req, res) => {
  try {
    const myId = req.user._id;
    const messages = await Message.find({
      receiver: { $ne: null },          // exclude group messages
      $or: [{ sender: myId }, { receiver: myId }],
    })
      .sort({ createdAt: -1 })
      .populate("sender receiver", "name role avatar avatarColor");

    const seen = new Map();
    for (const m of messages) {
      if (!m.receiver) continue;        // safety guard
      const partner = String(m.sender._id) === String(myId) ? m.receiver : m.sender;
      if (!partner?._id) continue;      // guard against unpopulated docs
      const key = String(partner._id);
      if (!seen.has(key)) {
        const unread = await Message.countDocuments({
          sender: partner._id, receiver: myId, read: false,
        });
        seen.set(key, { user: partner, lastMessage: m, unread });
      }
    }
    res.json([...seen.values()]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET group chat history  (must be before /:userId) ────────────────────────
router.get("/group/:groupType", protect, async (req, res) => {
  try {
    const { groupType } = req.params;
    if (!["interns", "supervisors"].includes(groupType))
      return res.status(400).json({ message: "Invalid groupType" });

    // Interns cannot see supervisors group
    if (groupType === "supervisors" && req.user.role === "intern")
      return res.status(403).json({ message: "Access denied" });

    const messages = await Message.find({ groupType })
      .sort({ createdAt: 1 })
      .populate("sender", "name role avatar avatarColor");

    res.json(messages);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST send group message ───────────────────────────────────────────────────
router.post("/group", protect, async (req, res) => {
  try {
    const { groupType, content, replyTo } = req.body;
    if (!["interns", "supervisors"].includes(groupType))
      return res.status(400).json({ message: "Invalid groupType" });
    if (!content?.trim())
      return res.status(400).json({ message: "content is required" });
    if (groupType === "supervisors" && req.user.role === "intern")
      return res.status(403).json({ message: "Access denied" });

    const message = await Message.create({
      sender:    req.user._id,
      receiver:  null,
      groupType,
      content:   content.trim(),
      replyTo:   replyTo?._id ? replyTo : null,
    });
    const populated = await message.populate("sender", "name role avatarColor avatar");
    res.status(201).json(populated);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── DELETE message (group or direct) ─────────────────────────────────────────
router.delete("/message/:messageId", protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (String(message.sender) !== String(req.user._id))
      return res.status(403).json({ message: "Not authorized" });

    await message.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET direct message thread ─────────────────────────────────────────────────
router.get("/:userId", protect, async (req, res) => {
  try {
    const myId    = req.user._id;
    const otherId = req.params.userId;
    await Message.updateMany(
      { sender: otherId, receiver: myId, read: false },
      { read: true }
    );
    const messages = await Message.find({
      $or: [
        { sender: myId,    receiver: otherId },
        { sender: otherId, receiver: myId    },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender receiver", "name role avatar avatarColor");
    res.json(messages);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST send direct message ──────────────────────────────────────────────────
router.post("/", protect, async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    if (!receiverId || !content?.trim())
      return res.status(400).json({ message: "receiverId and content are required" });
    const message   = await Message.create({
      sender: req.user._id, receiver: receiverId, content: content.trim(),
    });
    const populated = await message.populate("sender receiver", "name role avatar avatarColor");
    res.status(201).json(populated);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── PATCH mark read ───────────────────────────────────────────────────────────
router.patch("/:userId/read", protect, async (req, res) => {
  try {
    await Message.updateMany(
      { sender: req.params.userId, receiver: req.user._id, read: false },
      { read: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;