// ─── server.js ─────────────────────────────────────────────────────────────
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const http       = require("http");
const express    = require("express");
const mongoose   = require("mongoose");
const cors       = require("cors");
const path       = require("path");
require("dotenv").config();

const app        = express();
const httpServer = http.createServer(app);
const startSocialCron = require("./jobs/socialCron");

// ── Middleware ───────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.options('*', cors());
app.use(express.json());

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",     require("./routes/auth"));
app.use("/api/tasks",    require("./routes/tasks"));
app.use("/api/users",    require("./routes/users"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/reports",  require("./routes/reports"));

app.use("/api/messages",        require("./routes/messages"));
app.use("/api/meetings",        require("./routes/meetings"));
app.use("/api/social-projects", require("./routes/socialProjects"));
app.use("/api/social",          require("./routes/social"));
app.use("/api/files",           require("./routes/files"));

// ── Socket.io ────────────────────────────────────────────────────────────
require("./socket")(httpServer);

// ── DB + Start ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      const io = require("./socket").getIO?.() || null;
      startSocialCron(io);
    });
  })
  .catch(err => {
    console.error("DB connection error:", err);
    process.exit(1); // fail fast instead of hanging in a half-started state
  });