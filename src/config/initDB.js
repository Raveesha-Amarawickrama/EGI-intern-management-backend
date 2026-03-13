
const User    = require("../models/User");
const Project = require("../models/Project");

const DEFAULT_USERS = [
  // ── Interns ──
  {
    name:"Malith Rashmika",     username:"malith",      password:"intern123",
    role:"intern",              supervisorLevel: null,
    email:"malithrashmika10@gmail.com",
    contact:"076 9387193",      position:"Intern Trainee Developer",
    department:"Software Development",
    startDate:"03 Mar 2026",    endDate:"03 Sep 2026",
    avatar:"M",                 avatarColor:"#1a6640",
  },
  {
    name:"Imansa Gayathmi",     username:"imansa",      password:"intern123",
    role:"intern",              supervisorLevel: null,
    email:"imansagayathmi@gmail.com",
    contact:"070 2887535",      position:"Intern Trainee Designer",
    department:"Software Development",
    startDate:"03 Mar 2026",    endDate:"03 Sep 2026",
    avatar:"I",                 avatarColor:"#155030",
  },
  {
    name:"Methmini Munasinghe", username:"methmini",    password:"intern123",
    role:"intern",              supervisorLevel: null,
    email:"s.m.m.methmini@gmail.com",
    contact:"071 773 4377",     position:"Intern Trainee Developer",
    department:"Software Development",
    startDate:"03 Mar 2026",    endDate:"03 Sep 2026",
    avatar:"M",                 avatarColor:"#0f3d22",
  },

  // ── Senior Supervisors ──
  {
    name:"Mr. Prasanna",        username:"prasanna",    password:"admin123",
    role:"supervisor",          supervisorLevel:"senior",
    email:"info@spandcompany.co.uk",
    contact:"+44 7941 332938",  position:"Senior Supervisor",
    department:"Management",    avatar:"P", avatarColor:"#d4a843",
  },
  {
    name:"Mr. Chathuranga",     username:"chathuranga", password:"admin123",
    role:"supervisor",          supervisorLevel:"senior",
    email:"chathuzmaduz@gmail.com",
    contact:"076 9136157",      position:"Senior Supervisor",
    department:"Management",    avatar:"C", avatarColor:"#b8860b",
  },
  {
    name:"Mr. Uditha",          username:"uditha",      password:"admin123",
    role:"supervisor",          supervisorLevel:"senior",
    email:"udithaindunil5@gmail.com",
    contact:"071 998 0449",     position:"Senior Supervisor",
    department:"Software Development", avatar:"U", avatarColor:"#1a6640",
  },
  {
    name:"Mr. Dilrukshan",      username:"dilrukshan",  password:"admin123",
    role:"supervisor",          supervisorLevel:"senior",
    email:"dilrukshan@gmail.com",
    contact:"078 3378585",      position:"Senior Supervisor",
    department:"Software Development", avatar:"D", avatarColor:"#22a05a",
  },
  {
    name:"Mr. Shanaka",         username:"shanaka",     password:"admin123",
    role:"supervisor",          supervisorLevel:"senior",
    email:"shanaka@gmail.com",
    contact:"071 6465932",      position:"Senior Supervisor",
    department:"Software Development", avatar:"S", avatarColor:"#1a6640",
  },

  // ── Junior Supervisor ──
  {
    name:"Miss. Raveesha",      username:"raveesha",    password:"admin123",
    role:"supervisor",          supervisorLevel:"junior",
    email:"raveeshaamarawickrama200@gmail.com",
    contact:"076 2219168",      position:"Junior Supervisor",
    department:"Software Development", avatar:"R", avatarColor:"#1a6640",
  },
];

const DEFAULT_PROJECTS = [
  { name:"EGI", fullName:"EGI Admin Portal",     color:"#1a6640", icon:"🌿" },
  { name:"ERP", fullName:"Software Development", color:"#2563eb", icon:"💻" },
];

const initDB = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log(" No users found — seeding default users...");
      for (const u of DEFAULT_USERS) {
        await User.create(u);
      }
      console.log(`Created ${DEFAULT_USERS.length} default users`);
    } else {
     
      await User.updateMany(
        { role: "supervisor", supervisorLevel: { $exists: false } },
        { $set: { supervisorLevel: "senior" } }
      );

     
      await User.updateMany(
        { supervisorLevel: { $in: ["junior Supervisor", "Junior Supervisor"] } },
        { $set: { supervisorLevel: "junior" } }
      );
      await User.updateMany(
        { supervisorLevel: { $in: ["senior Supervisor", "Senior Supervisor"] } },
        { $set: { supervisorLevel: "senior" } }
      );

   
      await User.updateOne(
        { username: "raveesha" },
        { $set: { supervisorLevel: "junior" } }
      );

      console.log(" DB corrections applied");
    }

    const projectCount = await Project.countDocuments();
    if (projectCount === 0) {
      await Project.insertMany(DEFAULT_PROJECTS);
      console.log(`Created ${DEFAULT_PROJECTS.length} default projects`);
    }
  } catch (err) {
    console.error("initDB error:", err.message);
  }
};

module.exports = initDB;