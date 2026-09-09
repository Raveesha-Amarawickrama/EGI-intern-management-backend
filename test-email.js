

require("dotenv").config();
const { sendRenewalEmail } = require("./src/services/emailService");

async function main() {
  const to = process.env.SMTP_USER;
  if (!to) {
    console.error(" SMTP_USER is not set in .env");
    process.exit(1);
  }

  console.log(`📧  Sending test email to: ${to} ...`);

  await sendRenewalEmail(
    to,
    " 3-Day Renewal Reminder: Test Item (TEST EMAIL)",
    "This is a test reminder email.",
    {
      itemName:     "Microsoft 365 License",
      vendor:       "Microsoft",
      category:     "Software",
      renewalDate:  "2026-09-12",
      renewalCycle: "yearly",
      cost:         45000,
      notes:        "This is a test email sent from the backend script.",
      daysLeft:     3,
    }
  );

  console.log(" Done! Check your inbox (and spam folder).");
}

main().catch(err => {
  console.error(" Error:", err.message);
  process.exit(1);
});
