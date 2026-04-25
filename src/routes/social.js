// routes/social.js
const express = require("express");
const router = express.Router();
const {
  createContent,
  getAllContent,
  getContent,
  updateContent,
  markAsPosted,
  submitPerformance,
  deleteContent,
  getDashboardStats,
} = require("../controllers/socialController");
const { protect, adminOnly } = require("../middleware/auth"); // your existing middleware

// All routes require authentication
router.use(protect);

// Dashboard stats
router.get("/dashboard", getDashboardStats);

// Content CRUD
router.route("/")
  .get(getAllContent)
  .post(adminOnly, createContent);

router.route("/:id")
  .get(getContent)
  .put(updateContent)
  .delete(adminOnly, deleteContent);

// Status actions
router.patch("/:id/mark-posted", markAsPosted);
router.patch("/:id/performance", submitPerformance);

module.exports = router;