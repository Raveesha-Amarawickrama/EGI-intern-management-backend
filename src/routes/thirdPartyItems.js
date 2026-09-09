const express = require("express");
const router  = express.Router();
const {
  getAllItems, getOneItem, createItem, updateItem, deleteItem, markRenewed, checkRemindersNow,
} = require("../controllers/thirdPartyItemController");
const { protect, restrictTo, seniorOnly } = require("../middleware/auth");

router.use(protect, restrictTo("supervisor"));

router.get("/",              getAllItems);
router.get("/:id",           getOneItem);
router.post("/",             seniorOnly, createItem);
router.patch("/:id",         seniorOnly, updateItem);
router.patch("/:id/renew",   seniorOnly, markRenewed);
router.post("/check-reminders", seniorOnly, checkRemindersNow); // ← NEW
router.delete("/:id",        seniorOnly, deleteItem);

module.exports = router;