
const express = require("express");
const router  = express.Router();
const {
  getTasks, getTask, createTask, updateTask,
  updateStatus, toggleCheck, deleteTask,
  getWeeklyHours,
  createSubTask, updateSubTask, deleteSubTask,
  fixHours,
} = require("../controllers/taskController");
const { protect, restrictTo } = require("../middleware/auth");

router.use(protect);
router.get("/weekly",   getWeeklyHours);
router.patch("/fix-hours", fixHours);       
router.route("/").get(getTasks).post(createTask);
router.route("/:id").get(getTask).patch(updateTask).delete(deleteTask);
router.patch("/:id/status", updateStatus);
router.patch("/:id/check",  restrictTo("supervisor"), toggleCheck);
router.post(  "/:id/subtasks",        createSubTask);
router.patch( "/:id/subtasks/:subId", updateSubTask);
router.delete("/:id/subtasks/:subId", deleteSubTask);

module.exports = router;