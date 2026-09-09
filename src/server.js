
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
const startRenewalReminderJob = require("./jobs/renewalReminderJob"); 

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.options('*', cors());
app.use(express.json());

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