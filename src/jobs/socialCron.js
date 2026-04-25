// src/jobs/socialCron.js
const cron        = require("node-cron");
const SocialContent = require("../models/SocialContent");
const Notification  = require("../models/Notification");

module.exports = function startSocialCron(io) {

  // ── Every hour: mark missed posts ─────────────────────────────────────────
  cron.schedule("0 * * * *", async () => {
    try {
      const now     = new Date();
      const missed  = await SocialContent.find({
        status:          "Planned",
        plannedPostDate: { $lt: now },
      });

      for (const content of missed) {
        content.status = "Missed";
        await content.save();

        await Notification.create({
          recipient:    content.assignedTo,
          type:         "missed_post",
          message:      `Your post "${content.title}" on ${content.platform} was not posted on time.`,
          relatedId:    content._id,
          relatedModel: "SocialContent",
        });

        if (io) {
          io.to(content.assignedTo.toString()).emit("notification", {
            type:    "missed_post",
            message: `Missed post: "${content.title}"`,
          });
        }
      }

      if (missed.length > 0) {
        console.log(`[SocialCron] Marked ${missed.length} post(s) as Missed`);
      }
    } catch (err) {
      console.error("[SocialCron] Missed post check error:", err.message);
    }
  });

  // ── Daily at 9am: 7-day performance reminders ─────────────────────────────
  cron.schedule("0 9 * * *", async () => {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const due = await SocialContent.find({
        status:          "Posted",
        actualPostDate:  { $lte: sevenDaysAgo },
        performanceCheckedAt: { $exists: false },
      });

      for (const content of due) {
        await Notification.create({
          recipient:    content.assignedTo,
          type:         "performance_due",
          message:      `7 days have passed since "${content.title}" was posted. Please add performance data.`,
          relatedId:    content._id,
          relatedModel: "SocialContent",
        });

        if (io) {
          io.to(content.assignedTo.toString()).emit("notification", {
            type:    "performance_due",
            message: `Performance data due: "${content.title}"`,
          });
        }
      }

      if (due.length > 0) {
        console.log(`[SocialCron] Sent ${due.length} 7-day reminder(s)`);
      }
    } catch (err) {
      console.error("[SocialCron] 7-day reminder error:", err.message);
    }
  });

  console.log("[SocialCron] Social media cron jobs started");
};