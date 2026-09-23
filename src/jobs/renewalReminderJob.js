// jobs/renewalReminderJob.js
// Runs daily at 08:00 (server time).
// Sends email + in-app notifications to senior supervisors for active
// renewal items within the reminder window (<= 3 days away or overdue).

const cron = require("node-cron");
const ThirdPartyItem      = require("../models/ThirdPartyItem");
const RenewalNotification = require("../models/RenewalNotification");
const User                = require("../models/User");
const { sendRenewalEmail } = require("../services/emailService");

// ── Config ────────────────────────────────────────────────────────────────────
const DAYS_WINDOW = 3;   // Send reminder when item is due within N days or overdue

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const clean = String(dateStr).trim().split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  return new Date(dateStr);
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseLocalDate(dateStr);
  if (!target || isNaN(target.getTime())) return 999;
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

// ── Core check function (exported so "Check Now" button can call it) ──────────
async function checkRenewals(io, force = false) {
  try {
    const todayStr   = todayISO();
    const activeItems = await ThirdPartyItem.find({
      status: { $regex: /^active$/i }
    });

    // Alert for items due within DAYS_WINDOW (3, 2, 1, 0 days) or overdue (< 0)
    // Sends once per calendar day unless force is true
    const dueItems = activeItems.filter(item => {
      const d = daysUntil(item.renewalDate);
      const shouldAlert = d <= DAYS_WINDOW;
      return shouldAlert && (force || item.lastNotifiedDate !== todayStr);
    });

    if (!dueItems.length) {
      console.log("[renewalReminderJob] No items due for a reminder today.");
      return { notified: 0 };
    }

    // Fetch ONLY senior supervisors (role: "supervisor", supervisorLevel: "senior")
    const seniorUsers = await User.find({
      role: { $regex: /^supervisor$/i },
      supervisorLevel: { $regex: /^senior$/i },
    });

    if (!seniorUsers.length) {
      console.warn("[renewalReminderJob] No senior supervisors found in database to notify.");
      return { notified: 0 };
    }

    // Collect ONLY senior supervisor emails (lowercased and trimmed)
    const recipientEmails = [...new Set(
      seniorUsers.map(u => u.email && u.email.trim().toLowerCase()).filter(Boolean)
    )];

    if (!recipientEmails.length) {
      console.warn("[renewalReminderJob] Senior supervisors found, but none have valid email addresses.");
      return { notified: 0 };
    }

    console.log(`[renewalReminderJob] Target recipient emails (${recipientEmails.length}) [Senior Supervisors Only]:`, recipientEmails);

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
      if (seniorUsers.length) {
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

      if (recipientEmails.length) {
        // Send sequentially to avoid SMTP rate-limiting or concurrency issues
        for (const toEmail of recipientEmails) {
          const res = await sendRenewalEmail(toEmail, emailSubject, inAppMessage, itemDetails);
          if (res && !res.success) {
            console.error(`[renewalReminderJob] Failed to send email to ${toEmail}: ${res.error}`);
          }
        }
      }

      // ── 3. Update guard to prevent double-send today ───────────────────────
      item.lastNotifiedDate = todayStr;
      await item.save();
    }

    console.log(
      `[renewalReminderJob] Sent reminders for ${dueItems.length} item(s) ` +
      `to ${recipientEmails.length} recipient(s).`
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
    checkRenewals(io, false);
  });

  console.log("[renewalReminderJob] Scheduled: daily at 08:00 | 3-day email reminder window.");

  // Run once on startup so items due today/soon get their first check
  checkRenewals(io, false);

  return { checkRenewals: (force = false) => checkRenewals(io, force) };
};