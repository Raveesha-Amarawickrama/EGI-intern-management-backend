
const express = require("express");
const router  = express.Router();
const { getProjects, getProjectStats, createProject, deleteProject } = require("../controllers/projectController");
const { protect, restrictTo } = require("../middleware/auth");

router.use(protect);
router.get("/",            getProjects);
router.get("/:name/stats", getProjectStats);
router.post("/",           restrictTo("supervisor"), createProject);
router.delete("/:name",    restrictTo("supervisor"), deleteProject);

module.exports = router;