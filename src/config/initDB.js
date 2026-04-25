const User = require("../models/User");
const Project = require("../models/Project");

// ─────────────────────────────────────────────
// Default Users
// ─────────────────────────────────────────────
const DEFAULT_USERS = [
  // Interns
  {
    name: "Malith Rashmika",
    username: "malith",
    password: "intern123",
    role: "intern",
    supervisorLevel: null,
    email: "malithrashmika10@gmail.com",
    contact: "0769387193",
    position: "Intern Trainee Developer",
    department: "Software Development",
    startDate: "2026-03-03",
    endDate: "2026-09-03",
    avatar: "M",
    avatarColor: "#1a6640",
  },
  {
    name: "Imansa Gayathmi",
    username: "imansa",
    password: "intern123",
    role: "intern",
    supervisorLevel: null,
    email: "imansagayathmi@gmail.com",
    contact: "0702887535",
    position: "Intern Trainee Designer",
    department: "Software Development",
    startDate: "2026-03-03",
    endDate: "2026-09-03",
    avatar: "I",
    avatarColor: "#155030",
  },
  {
    name: "Methmini Munasinghe",
    username: "methmini",
    password: "intern123",
    role: "intern",
    supervisorLevel: null,
    email: "s.m.m.methmini@gmail.com",
    contact: "0717734377",
    position: "Intern Trainee Developer",
    department: "Software Development",
    startDate: "2026-03-03",
    endDate: "2026-09-03",
    avatar: "M",
    avatarColor: "#0f3d22",
  },

  // Senior Supervisors
  {
    name: "Mr. Prasanna",
    username: "prasanna",
    password: "admin123",
    role: "supervisor",
    supervisorLevel: "senior",
    email: "info@spandcompany.co.uk",
    contact: "+447941332938",
    position: "Senior Supervisor",
    department: "Management",
    avatar: "P",
    avatarColor: "#d4a843",
  },
  {
    name: "Mr. Chathuranga",
    username: "chathuranga",
    password: "admin123",
    role: "supervisor",
    supervisorLevel: "senior",
    email: "chathuzmaduz@gmail.com",
    contact: "0769136157",
    position: "Senior Supervisor",
    department: "Management",
    avatar: "C",
    avatarColor: "#b8860b",
  },

  // Plain Supervisors
  {
    name: "Mr. Uditha",
    username: "uditha",
    password: "admin123",
    role: "supervisor",
    supervisorLevel: "supervisor",
    email: "udithaindunil5@gmail.com",
    contact: "0719980449",
    position: "Supervisor",
    department: "Software Development",
    avatar: "U",
    avatarColor: "#1a6640",
  },
  {
    name: "Mr. Dilrukshan",
    username: "dilrukshan",
    password: "admin123",
    role: "supervisor",
    supervisorLevel: "supervisor",
    email: "dilrukshan@gmail.com",
    contact: "0783378585",
    position: "Supervisor",
    department: "Software Development",
    avatar: "D",
    avatarColor: "#22a05a",
  },
  {
    name: "Mr. Shanaka",
    username: "shanaka",
    password: "admin123",
    role: "supervisor",
    supervisorLevel: "supervisor",
    email: "shanaka@gmail.com",
    contact: "0716465932",
    position: "Supervisor",
    department: "Software Development",
    avatar: "S",
    avatarColor: "#1a6640",
  },
  {
    name: "Mr. Hashitha",
    username: "hashitha",
    password: "EGI123",
    role: "supervisor",
    supervisorLevel: "supervisor",
    email: "hdilshan52@gmail.com ",
    contact: "0704657873",
    position: "Supervisor",
    department: "Software Development",
    avatar: "H",
    avatarColor: "#1a6640",
  },

  // Junior Supervisor
  {
    name: "Miss. Raveesha",
    username: "raveesha",
    password: "admin123",
    role: "supervisor",
    supervisorLevel: "junior",
    email: "raveeshaamarawickrama200@gmail.com",
    contact: "0762219168",
    position: "Junior Supervisor",
    department: "Software Development",
    avatar: "R",
    avatarColor: "#1a6640",
  },
];

// ─────────────────────────────────────────────
// Default Projects
// ─────────────────────────────────────────────
const DEFAULT_PROJECTS = [
  { name: "EGI", fullName: "EGI Admin Portal", color: "#1a6640", icon: "🌿" },
  { name: "ERP", fullName: "Software Development", color: "#2563eb", icon: "💻" },
];

// ─────────────────────────────────────────────
// Force-correct all supervisor levels by username
// This runs every startup to fix any stale DB data
// ─────────────────────────────────────────────
const normalizeSupervisorLevels = async () => {
  // Senior supervisors
  await User.updateMany(
    { username: { $in: ["prasanna", "chathuranga"] } },
    { $set: { supervisorLevel: "senior" } }
  );

  // Plain supervisors
  await User.updateMany(
    { username: { $in: ["uditha", "dilrukshan", "shanaka"] } },
    { $set: { supervisorLevel: "supervisor" } }
  );

  // Junior supervisor
  await User.updateOne(
    { username: "raveesha" },
    { $set: { supervisorLevel: "junior" } }
  );

  // All interns should have null supervisorLevel
  await User.updateMany(
    { role: "intern" },
    { $set: { supervisorLevel: null } }
  );
};

// ─────────────────────────────────────────────
// Initialize Database
// ─────────────────────────────────────────────
const initDB = async () => {
  try {
    console.log("🚀 Initializing Database...");

    // ───── Users ─────
    const userCount = await User.countDocuments();

    if (userCount === 0) {
      console.log("⚡ Seeding default users...");
      await User.insertMany(DEFAULT_USERS);
      console.log(`✅ ${DEFAULT_USERS.length} users created`);
    } else {
      console.log("🔄 Normalizing existing supervisor levels...");
      await normalizeSupervisorLevels();
      console.log("✅ Supervisor levels corrected");
    }

    // ───── Projects ─────
    const projectCount = await Project.countDocuments();

    if (projectCount === 0) {
      console.log("⚡ Seeding default projects...");
      await Project.insertMany(DEFAULT_PROJECTS);
      console.log(`✅ ${DEFAULT_PROJECTS.length} projects created`);
    }

    console.log("🎉 Database initialization complete!");
  } catch (error) {
    console.error("❌ initDB error:", error.message);
  }
};

module.exports = initDB;