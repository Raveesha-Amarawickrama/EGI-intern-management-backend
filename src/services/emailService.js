// services/emailService.js
// Sends rich HTML email reminders for third-party renewal items.

const nodemailer = require("nodemailer");

// ── Lazy-initialise transporter so the server can still start if SMTP creds
// are not yet configured (they'll be filled in later). ─────────────────────────
let _transporter = null;

function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST   || "smtp.gmail.com",
      port:   parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true", // true only for port 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _transporter;
}

// ── Build a rich HTML body for the 3-day reminder ─────────────────────────────
function buildRenewalEmailHtml({ itemName, vendor, category, renewalDate, daysLeft, renewalCycle, cost, notes }) {
  const urgencyColor = daysLeft <= 0 ? "#dc2626" : daysLeft <= 1 ? "#ea580c" : "#d97706";
  const urgencyBg    = daysLeft <= 0 ? "#fef2f2" : daysLeft <= 1 ? "#fff7ed" : "#fffbeb";
  const urgencyText  = daysLeft < 0
    ? `⚠️ OVERDUE by ${Math.abs(daysLeft)} day(s)`
    : daysLeft === 0
    ? "⚠️ Due TODAY"
    : `⏰ Due in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`;

  const fromName = process.env.SMTP_FROM_NAME || "Eco Green International";
  const appUrl   = process.env.CLIENT_URL     || "http://localhost:3000";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Renewal Reminder – ${itemName}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- ── Header ── -->
        <tr>
          <td style="background:linear-gradient(135deg,#064e3b,#065f46);border-radius:16px 16px 0 0;padding:32px 36px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">🔔</div>
            <h1 style="color:#ffffff;font-size:22px;font-weight:800;margin:0;letter-spacing:-0.3px;">
              Renewal Reminder
            </h1>
            <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:6px 0 0;">
              ${fromName} — Intern Management System
            </p>
          </td>
        </tr>

        <!-- ── Urgency Banner ── -->
        <tr>
          <td style="background:${urgencyBg};border-left:4px solid ${urgencyColor};padding:14px 36px;">
            <p style="margin:0;font-size:15px;font-weight:700;color:${urgencyColor};">
              ${urgencyText}
            </p>
          </td>
        </tr>

        <!-- ── Body ── -->
        <tr>
          <td style="background:#ffffff;padding:32px 36px;">
            <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 24px;">
              This is an automated reminder that the following third-party item is 
              <strong style="color:${urgencyColor};">due for renewal${daysLeft <= 0 ? " (overdue)" : ` in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`}</strong>.
              Please take action before the renewal date to avoid service disruption.
            </p>

            <!-- Item details table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f1f5f9;">
                <td colspan="2" style="padding:12px 18px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;">
                  Renewal Item Details
                </td>
              </tr>
              ${[
                ["Item Name",     itemName],
                ["Vendor",        vendor],
                ["Category",      category      || "—"],
                ["Renewal Date",  renewalDate],
                ["Renewal Cycle", renewalCycle  ? renewalCycle.charAt(0).toUpperCase() + renewalCycle.slice(1) : "—"],
                ["Cost",          cost          ? `Rs. ${cost}` : "—"],
              ].map(([label, value], i) => `
              <tr style="border-top:1px solid #e2e8f0;background:${i % 2 === 0 ? "#ffffff" : "#f8fafc"};">
                <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#374151;width:40%;">${label}</td>
                <td style="padding:11px 18px;font-size:13px;color:#1e293b;font-weight:500;">${value}</td>
              </tr>`).join("")}
            </table>

            ${notes ? `
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
              <p style="margin:0;font-size:12px;font-weight:700;color:#166534;margin-bottom:4px;">📝 Notes</p>
              <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">${notes}</p>
            </div>` : ""}

            <!-- CTA Button -->
            <div style="text-align:center;margin:28px 0 16px;">
              <a href="${appUrl}"
                style="display:inline-block;background:linear-gradient(135deg,#059669,#047857);color:#ffffff;
                  text-decoration:none;font-size:14px;font-weight:700;padding:13px 32px;
                  border-radius:10px;letter-spacing:0.2px;box-shadow:0 4px 14px rgba(5,150,105,0.35);">
                🔗 Open Renewals Dashboard
              </a>
            </div>
          </td>
        </tr>

        <!-- ── Footer ── -->
        <tr>
          <td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
              This is an automated reminder from the <strong>${fromName}</strong> Intern Management System.<br/>
              You are receiving this because you are registered as a Senior Supervisor.<br/>
              Please do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`.trim();
}

// ── Plain-text fallback ────────────────────────────────────────────────────────
function buildRenewalEmailText({ itemName, vendor, renewalDate, daysLeft, notes }) {
  const urgency = daysLeft < 0
    ? `OVERDUE by ${Math.abs(daysLeft)} day(s)`
    : daysLeft === 0 ? "due TODAY" : `due in ${daysLeft} day(s)`;
  return [
    `RENEWAL REMINDER – ${itemName}`,
    ``,
    `${itemName} (${vendor}) is ${urgency}.`,
    `Renewal Date: ${renewalDate}`,
    notes ? `Notes: ${notes}` : "",
    ``,
    `Please log in to the Eco Green Intern Management System to take action.`,
    `${process.env.CLIENT_URL || "http://localhost:3000"}`,
  ].filter(Boolean).join("\n");
}

// ── Public API ─────────────────────────────────────────────────────────────────
async function sendRenewalEmail(to, subject, message, itemDetails = {}) {
  try {
    const transporter = getTransporter();
    const fromName    = process.env.SMTP_FROM_NAME || "Eco Green International";
    const fromAddr    = process.env.SMTP_USER;

    // Build the HTML body from item details if provided, otherwise fall back
    // to the plain message string (legacy path from old callers).
    const html = Object.keys(itemDetails).length > 0
      ? buildRenewalEmailHtml(itemDetails)
      : `<div style="font-family:sans-serif;font-size:14px;color:#374151;">
           <p>${message}</p>
           <p>Please review this in the Staff Management System.</p>
         </div>`;

    const text = Object.keys(itemDetails).length > 0
      ? buildRenewalEmailText(itemDetails)
      : message;

    await transporter.sendMail({
      from:    `"${fromName}" <${fromAddr}>`,
      to,
      subject,
      text,
      html,
    });

    console.log(`[emailService] Reminder sent to ${to} — "${subject}"`);
  } catch (err) {
    console.error(`[emailService] Failed to email ${to}:`, err.message);
    // Do NOT rethrow – a failed email must not crash the cron job or controller.
  }
}

module.exports = { sendRenewalEmail };