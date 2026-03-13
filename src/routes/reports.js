
const express = require("express");
const router  = express.Router();
const { getInternReport, getProjectReport, getSummary } = require("../controllers/reportController");
const { protect, restrictTo } = require("../middleware/auth");

router.use(protect);
router.get("/summary",  restrictTo("supervisor"), getSummary);
router.get("/interns",  restrictTo("supervisor"), getInternReport);
router.get("/projects", restrictTo("supervisor"), getProjectReport);

module.exports = router;