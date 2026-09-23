const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const http       = require("http");
const express    = require("express");
const mongoose   = require("mongoose");
const cors       = require("cors");

const helmet        = require("helmet");
const rateLimit     = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");


const app        = express();
const httpServer = http.createServer(app);
const startSocialCron = require("./jobs/socialCron");
const startRenewalReminderJob = require("./jobs/renewalReminderJob"); 

// ── 1. Security Headers ────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));

// ── 2. CORS ───────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.options('*', cors());

// ── 3. Body Parser with Size Limits ───────────────────────────────────────────
app.use(express.json({ limit: "25kb" }));
app.use(express.urlencoded({ extended: true, limit: "25kb" }));

// ── 4. NoSQL Injection Prevention ─────────────────────────────────────────────
app.use(mongoSanitize());

// ── 5. Rate Limiting ──────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again after 15 minutes." },
});
app.use("/api", generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login/auth attempts. Please try again after 15 minutes." },
});
app.use("/api/auth/login", authLimiter);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
app.use("/api/third-party-items",     require("./routes/thirdPartyItems"));    
app.use("/api/renewal-notifications", require("./routes/renewalNotifications")); 

// ── 6. Centralized Safe Error Handling ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[ServerError] ${req.method} ${req.originalUrl}:`, err.message);

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(400).json({
      success: false,
      message: `A record with that ${field} already exists.`,
    });
  }

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: messages.join(", "),
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal server error." : (err.message || "Internal server error."),
  });
});

require("./socket")(httpServer);

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      const io = require("./socket").getIO?.() || null;
      startSocialCron(io);

    
      const renewalJob = startRenewalReminderJob(io);
      app.set("renewalReminderJob", renewalJob);
    });
  })
  .catch(err => {
    console.error("DB connection error:", err);
    process.exit(1);
  });