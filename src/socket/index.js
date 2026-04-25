// socket/index.js
const { Server } = require("socket.io");
const jwt        = require("jsonwebtoken");
const Message    = require("../models/Message");
const User       = require("../models/User");

module.exports = function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  const onlineUsers = new Map(); // userId → socketId

  // ── Auth middleware ──────────────────────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");
      if (!token) return next(new Error("No token"));
      const decoded  = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId  = String(decoded.id || decoded._id);
      socket.role    = decoded.role;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`[socket] connected: ${socket.userId} (${socket.role})`);

    // ── Track online users ───────────────────────────────────────────────────
    onlineUsers.set(socket.userId, socket.id);
    io.emit("online_users", [...onlineUsers.keys()]);

    // ── Join personal rooms ──────────────────────────────────────────────────
    socket.join(`user:${socket.userId}`);
    socket.join(`user_room:${socket.userId}`);

    // ── Join group rooms on request ──────────────────────────────────────────
    socket.on("join_group", ({ groupType }) => {
      socket.join(`group:${groupType}`);
    });

    // ── Direct message ───────────────────────────────────────────────────────
    socket.on("send_message", async ({ receiverId, message: content }) => {
      try {
        const msg = await Message.create({
          sender:   socket.userId,
          receiver: receiverId,
          content:  content?.trim(),
        });
        const populated = await msg.populate("sender receiver", "name role avatar avatarColor");
        const sid = onlineUsers.get(String(receiverId));
        if (sid) io.to(sid).emit("new_message", populated);
        socket.emit("new_message", populated);
      } catch (e) {
        socket.emit("error", { message: e.message });
      }
    });

    // ── Group message (room-based + personal rooms + reply support) ──────────
    socket.on("send_group_message", async ({ groupType, members, content, replyTo }) => {
      try {
        if (!["interns", "supervisors"].includes(groupType)) return;

        // Interns cannot send to supervisors group
        if (groupType === "supervisors" && socket.role === "intern") return;

        const msgData = {
          sender:    socket.userId,
          receiver:  null,
          content:   content?.trim(),
          groupType,
          replyTo:   replyTo || null,
        };

        // Attach reply snapshot if provided
        if (replyTo?._id) {
          msgData.replyTo = {
            _id:        replyTo._id,
            content:    replyTo.content,
            senderName: replyTo.senderName,
          };
        }

        const msg       = await Message.create(msgData);
        const populated = await msg.populate("sender", "name role avatarColor avatar");
        const payload   = populated.toObject();

        // 1. Emit to group room (all sockets that joined this group)
        io.to(`group:${groupType}`).emit("new_group_message", payload);

        // 2. Emit to each member's personal room (sidebar preview updates)
        const allTargets = [...new Set([
          ...(Array.isArray(members) ? members.map(String) : []),
          socket.userId,
        ])];

        allTargets.forEach(uid => {
          io.to(`user:${uid}`).emit("new_group_message", payload);
        });

      } catch (e) {
        console.error("[socket] send_group_message error:", e.message);
        socket.emit("error", { message: e.message });
      }
    });

    // ── Typing indicators ────────────────────────────────────────────────────
    socket.on("typing", ({ receiverId }) => {
      const sid = onlineUsers.get(String(receiverId));
      if (sid) io.to(sid).emit("typing", { senderId: socket.userId });
    });

    socket.on("stop_typing", ({ receiverId }) => {
      const sid = onlineUsers.get(String(receiverId));
      if (sid) io.to(sid).emit("stop_typing", { senderId: socket.userId });
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      onlineUsers.delete(socket.userId);
      io.emit("online_users", [...onlineUsers.keys()]);
      console.log(`[socket] disconnected: ${socket.userId}`);
    });
  });

  return io;
};