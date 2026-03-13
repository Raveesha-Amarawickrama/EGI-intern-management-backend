
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

module.exports = router;