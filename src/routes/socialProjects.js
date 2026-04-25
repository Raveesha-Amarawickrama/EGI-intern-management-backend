// src/routes/socialProjects.js
const express = require("express");
const router  = express.Router();
const {
  createSocialProject,
  getAllSocialProjects,
  getSocialProject,
  updateSocialProject,
  deleteSocialProject,
  getMembers,
} = require("../controllers/socialProjectController");
const { protect } = require("../middleware/auth");  // ← ONLY protect, NO adminOnly import

router.use(protect);

router.get("/members", getMembers);   // ← must be before /:id

router.route("/")
  .get(getAllSocialProjects)
  .post(createSocialProject);         // ← NO adminOnly here

router.route("/:id")
  .get(getSocialProject)
  .put(updateSocialProject)
  .delete(deleteSocialProject);

module.exports = router;