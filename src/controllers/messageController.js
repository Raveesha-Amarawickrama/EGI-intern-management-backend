// controllers/messageController.js
const Message = require("../models/Message");
const User    = require("../models/User");

// GET /api/messages/users
const getUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select("name role avatar avatarColor position");
    res.json(users);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// GET /api/messages/conversations
const getConversations = async (req, res) => {
  try {
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [{ sender: myId }, { receiver: myId }],
    })
      .sort({ createdAt: -1 })
      .populate("sender receiver", "name role avatar avatarColor");

    const seen = new Map();
    for (const m of messages) {
      const partner = String(m.sender._id) === String(myId) ? m.receiver : m.sender;
      const key     = String(partner._id);
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
};

// GET /api/messages/:userId
const getMessages = async (req, res) => {
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
};

// POST /api/messages
const sendMessage = async (req, res) => {
  try {
    const { receiverId, content } = req.body;

    if (!receiverId || !content?.trim())
      return res.status(400).json({ message: "receiverId and content are required" });

    const message   = await Message.create({
      sender:   req.user._id,
      receiver: receiverId,
      content:  content.trim(),
    });
    const populated = await message.populate("sender receiver", "name role avatar avatarColor");

    res.status(201).json(populated);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// PATCH /api/messages/:userId/read
const markRead = async (req, res) => {
  try {
    await Message.updateMany(
      { sender: req.params.userId, receiver: req.user._id, read: false },
      { read: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { getUsers, getConversations, getMessages, sendMessage, markRead };