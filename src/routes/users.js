
const express = require("express");
const router  = express.Router();
const { getAllUsers, getUser, updateUser, deleteUser, getUserStats } = require("../controllers/userController");
const { protect, restrictTo } = require("../middleware/auth");

router.use(protect);
router.get("/",          restrictTo("supervisor"), getAllUsers);
router.get("/:id",       getUser);
router.patch("/:id",     updateUser);
router.delete("/:id",    restrictTo("supervisor"), deleteUser);
router.get("/:id/stats", getUserStats);

module.exports = router;