
const express = require("express");
const router  = express.Router();
const {
  login, register, getMe, changePassword, resetPassword,
} = require("../controllers/authController");
const { protect, restrictTo } = require("../middleware/auth");

router.post("/login",                          login);
router.post("/register",   protect, restrictTo("supervisor"), register);
router.get( "/me",         protect, getMe);
router.patch("/change-password", protect,      changePassword);

router.patch("/reset-password/:userId", protect, restrictTo("supervisor"), resetPassword);

// Senior supervisors can register other supervisors
router.post("/register-supervisor", protect, restrictTo("supervisor"), async (req, res, next) => {
  try {
    const caller = req.user;
    if (caller.supervisorLevel !== "senior")
      return res.status(403).json({ success: false, message: "Only senior supervisors can add supervisors." });

    const { name, username, password, supervisorLevel, email, contact, position, department } = req.body;
    if (!name || !username || !password || !email)
      return res.status(400).json({ success: false, message: "Name, username, password and email are required." });

    if (!["supervisor", "junior"].includes(supervisorLevel))
      return res.status(400).json({ success: false, message: "supervisorLevel must be 'supervisor' or 'junior'." });

    const user = await require("../models/User").create({
      name, username, password,
      role: "supervisor",
      supervisorLevel,
      email, contact, position, department,
      avatar: name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      avatarColor: "#1a6640",
      mustChangePassword: true,
    });

    res.status(201).json({ success: true, user: user.toSafeObject() });
  } catch (err) { next(err); }
});

// Senior supervisors can delete supervisors
router.delete("/supervisor/:id", protect, restrictTo("supervisor"), async (req, res, next) => {
  try {
    if (req.user.supervisorLevel !== "senior")
      return res.status(403).json({ success: false, message: "Only senior supervisors can remove supervisors." });
    await require("../models/User").findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Supervisor removed." });
  } catch (err) { next(err); }
});
module.exports = router;