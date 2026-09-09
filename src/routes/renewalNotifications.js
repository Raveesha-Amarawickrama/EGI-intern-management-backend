const express = require("express");
const router  = express.Router();
const { getMyNotifications, markRead, markAllRead } = require("../controllers/renewalNotificationController");
const { protect, restrictTo } = require("../middleware/auth");

router.use(protect, restrictTo("supervisor"));

router.get("/",             getMyNotifications);
router.patch("/:id/read",   markRead);
router.patch("/read-all",   markAllRead);

module.exports = router;