// jobs/renewalReminderJob.js
// Runs daily at 08:00 (server time).
// Sends email + in-app notifications to senior supervisors for every active
// renewal item whose renewalDate is exactly 3 days away (or already past).
//
// ── Reminder window ───────────────────────────────────────────────────────────
//   • DAYS_EXACT: 3  → send the first time when exactly 3 days remain
//   • On-due-day  (d = 0) and overdue (d < 0) reminders continue daily until
//     the item is renewed / cancelled, so nothing falls through the cracks.
// ─────────────────────────────────────────────────────────────────────────────

const cron = require("node-cron");
const ThirdPartyItem      = require("../models/ThirdPartyItem");
const RenewalNotification = require("../models/RenewalNotification");
const User                = require("../models/User");
const { sendRenewalEmail } = require("../services/emailService");

// ── Config ────────────────────────────────────────────────────────────────────
const DAYS_EXACT = 3;   // Send reminder exactly N days before renewal

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

// ── Core check function (exported so "Check Now" button can call it) ──────────
async function checkRenewals(io) {
  try {
    const todayStr   = todayISO();
    const activeItems = await ThirdPartyItem.find({ status: "active" });

    // Fire a reminder when:
    //   d === DAYS_EXACT  → exactly 3 days away (first reminder)
    //   d <= 0            → due today or overdue (daily reminder until renewed)
    // In both cases only send once per calendar day (lastNotifiedDate guard).
    const dueItems = activeItems.filter(item => {
      const d = daysUntil(item.renewalDate);
      const shouldAlert = (d === DAYS_EXACT) || (d <= 0);
      return shouldAlert && item.lastNotifiedDate !== todayStr;
    });

    if (!dueItems.length) {
      console.log("[renewalReminderJob] No items due for a reminder today.");
      return { notified: 0 };
    }

    // Fetch all senior supervisors to notify
    const seniorUsers = await User.find({ role: "supervisor", supervisorLevel: "senior" });
    if (!seniorUsers.length) {
      console.warn("[renewalReminderJob] No senior supervisors found to notify.");
      return { notified: 0 };
    }

    for (const item of dueItems) {
      const d = daysUntil(item.renewalDate);

      const urgencyLabel =
        d < 0  ? `overdue by ${Math.abs(d)} day(s)` :
        d === 0 ? "due today" :
                  `due in ${d} day(s)`;

      const emailSubject = d < 0
        ? `🚨 Renewal OVERDUE: ${item.name}`
        : d === 0
        ? `🔴 Renewal due TODAY: ${item.name}`
        : `⏰ 3-Day Renewal Reminder: ${item.name}`;

      const inAppTitle   = `Renewal ${d < 0 ? "overdue" : "reminder"}: ${item.name}`;
      const inAppMessage = `${item.name} (${item.vendor}) is ${urgencyLabel} — renewal date ${item.renewalDate}. Mark it renewed once handled.`;

      // ── 1. Create in-app notifications ────────────────────────────────────
      const notifDocs = seniorUsers.map(u => ({
        recipient: u._id,
        item:      item._id,
        title:     inAppTitle,
        message:   inAppMessage,
      }));
      const created = await RenewalNotification.insertMany(notifDocs);

      // Emit socket events so the bell updates in real-time
      if (io) {
        created.forEach(n =>
          io.to(`user:${n.recipient}`).emit("new_renewal_notification", n)
        );
      }

      // ── 2. Send rich HTML emails ───────────────────────────────────────────
      const itemDetails = {
        itemName:     item.name,
        vendor:       item.vendor,
        category:     item.category     || "",
        renewalDate:  item.renewalDate,
        renewalCycle: item.renewalCycle || "yearly",
        cost:         item.cost         || 0,
        notes:        item.notes        || "",
        daysLeft:     d,
      };

      await Promise.all(
        seniorUsers.map(u =>
          sendRenewalEmail(u.email, emailSubject, inAppMessage, itemDetails)
        )
      );

      // ── 3. Update guard to prevent double-send today ───────────────────────
      item.lastNotifiedDate = todayStr;
      await item.save();
    }

    console.log(
      `[renewalReminderJob] Sent reminders for ${dueItems.length} item(s) ` +
      `to ${seniorUsers.length} senior supervisor(s).`
    );
    return { notified: dueItems.length };

  } catch (err) {
    console.error("[renewalReminderJob] Error:", err.message);
    return { notified: 0, error: err.message };
  }
}

// ── Schedule ──────────────────────────────────────────────────────────────────
module.exports = function startRenewalReminderJob(io) {
  // Run every day at 08:00 server time
  cron.schedule("0 8 * * *", () => {
    console.log("[renewalReminderJob] Running scheduled check…");
    checkRenewals(io);
  });

  console.log("[renewalReminderJob] Scheduled: daily at 08:00 | 3-day email reminder window.");

  // Run once on startup so items due today/soon get their first check
  // without waiting until tomorrow's 08:00.
  checkRenewals(io);

  return { checkRenewals: () => checkRenewals(io) };
};