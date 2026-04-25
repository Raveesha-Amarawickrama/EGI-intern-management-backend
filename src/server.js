// ─── server.js (additions / full example) ────────────────────────────────────
// Add these lines to your existing server.js

const http       = require("http");
const express    = require("express");
const mongoose   = require("mongoose");
const cors       = require("cors");
const path       = require("path");
require("dotenv").config();

const app        = express();
const httpServer = http.createServer(app);
const startSocialCron = require("./jobs/socialCron");


// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],  // ← added PATCH
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.options('*', cors());  // ← add this line for preflight
app.use(express.json());

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Existing routes (keep yours) ──────────────────────────────────────────────
app.use("/api/auth",     require("./routes/auth"));
app.use("/api/tasks",    require("./routes/tasks"));
app.use("/api/users",    require("./routes/users"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/reports",  require("./routes/reports"));


// ── NEW routes ────────────────────────────────────────────────────────────────
app.use("/api/messages",        require("./routes/messages"));
app.use("/api/meetings",        require("./routes/meetings"));
app.use("/api/social-projects", require("./routes/socialProjects")); // ← before social
app.use("/api/social",          require("./routes/social"));
app.use("/api/files",           require("./routes/files"));


// ── Socket.io ─────────────────────────────────────────────────────────────────
require("./socket")(httpServer);

// ── DB + Start ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      const io = require("./socket").getIO?.() || null;
      startSocialCron(io);  // ← start cron jobs
    });
  })
  .catch(err => console.error("DB connection error:", err));