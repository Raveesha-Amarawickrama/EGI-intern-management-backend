const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const mongoose = require("mongoose");
const { sendRenewalEmail } = require("./src/services/emailService");

async function main() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("❌ SMTP_USER or SMTP_PASS is not configured in .env");
    process.exit(1);
  }

  console.log(`🔌 Connecting to MongoDB to fetch senior supervisors...`);
  await mongoose.connect(process.env.MONGO_URI);

  const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));
  
  // Fetch ONLY senior supervisors
  const seniorUsers = await User.find({
    role: { $regex: /^supervisor$/i },
    supervisorLevel: { $regex: /^senior$/i },
  });

  const recipients = [...new Set(
    seniorUsers.map(u => u.email && u.email.trim().toLowerCase()).filter(Boolean)
  )];

  console.log(`\n📧 Found ${recipients.length} Senior Supervisor(s) (NO regular supervisors, NO juniors):`);
  seniorUsers.forEach((u, i) => console.log(`   ${i + 1}. ${u.name} (${u.email}) [Level: ${u.supervisorLevel}]`));

  if (!recipients.length) {
    console.warn("⚠️ No senior supervisors found to email.");
    await mongoose.disconnect();
    return;
  }

  const dummyItem = {
    itemName:     "Test Renewal Item",
    vendor:       "Eco Green International",
    category:     "Software / Subscription",
    renewalDate:  new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
    renewalCycle: "yearly",
    cost:         25000,
    notes:        "This is a test notification confirming delivery strictly to senior supervisors.",
    daysLeft:     3,
  };

  console.log(`\n🚀 Sending test renewal emails to Senior Supervisors only...`);
  for (const toEmail of recipients) {
    console.log(`\n➡️  Sending to: ${toEmail}...`);
    const result = await sendRenewalEmail(
      toEmail,
      "⏰ 3-Day Renewal Reminder: Test Renewal Item (SENIOR SUPERVISOR TEST)",
      "This is a test reminder email to verify senior supervisor notification delivery.",
      dummyItem
    );

    if (result && result.success) {
      console.log(`   ✅ Successfully delivered to: ${toEmail} (ID: ${result.messageId})`);
    } else {
      console.error(`   ❌ Failed to deliver to: ${toEmail}: ${result?.error || "Unknown error"}`);
    }
  }

  await mongoose.disconnect();
  console.log("\n🎉 All senior supervisor test emails completed!");
}

main().catch(err => {
  console.error("❌ Fatal Error:", err.message);
  process.exit(1);
});
