const Task     = require("../models/Task");
const User     = require("../models/User");
const mongoose = require("mongoose");

const currentWeekKey = () => {
  const d    = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
};


const weekKeyToDateRange = (wk) => {
  const [yearStr, wStr] = wk.split("-W");
  const year = parseInt(yearStr);
  const week = parseInt(wStr);

  const jan1     = new Date(year, 0, 1);
  const jan1Day  = jan1.getDay(); 

  const daysToMon = jan1Day === 0 ? 1 : jan1Day === 1 ? 0 : 8 - jan1Day;
  const firstMon  = new Date(year, 0, 1 + daysToMon);

  const mon = new Date(firstMon);
  mon.setDate(firstMon.getDate() + (week - 1) * 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d) => d.toISOString().split("T")[0];
  return { start: fmt(mon), end: fmt(sun) };
};


const enrichTasks = async (tasks) => {
  const allUsernames = [...new Set(tasks.flatMap(t => t.adminChecked || []))];
  const supervisors  = allUsernames.length
    ? await User.find({ username: { $in: allUsernames } }).select("username name avatar avatarColor")
    : [];
  const svMap = Object.fromEntries(supervisors.map(s => [s.username, s]));
  return tasks.map(t => {
    const obj = t.toObject ? t.toObject() : t;
    obj.adminCheckedUsers = (obj.adminChecked || []).map(u => svMap[u] || { username: u, name: u });
    return obj;
  });
};

// ─────────────────────────────────────────────────────────────────────────────
exports.getTasks = async (req, res, next) => {
  try {
    const { status, project, search, internId, date, weekKey } = req.query;
    let filter = {};

    if (req.user.role === "intern") {
      filter.assignedTo = req.user._id;
    } else if (req.user.role === "supervisor") {
      if (internId && internId !== "All") filter.assignedTo = internId;
    }

    if (status  && status  !== "All") filter.status  = status;
    if (project && project !== "All") filter.project = project;
    if (search)  filter.task = { $regex: search, $options: "i" };


    if (date && !weekKey) {
      filter.date = date;
    }

  
    if (weekKey) {
      const { start, end } = weekKeyToDateRange(weekKey);
      filter.date = { $gte: start, $lte: end };
    }

    let tasks = await Task.find(filter)
      .populate("assignedTo", "name avatar avatarColor role supervisorLevel")
      .populate("createdBy",  "name role")
      .sort({ date: -1, createdAt: -1 });

    if (req.user.role === "supervisor" && req.user.supervisorLevel === "junior") {
      tasks = tasks.filter(t => {
        const at = t.assignedTo;
        if (!at) return false;
        return at.role === "intern" || String(at._id) === String(req.user._id);
      });
    }

    const fixedTasks = tasks.map(t => {
      const obj = t.toObject ? t.toObject() : t;
      if ((obj.totalMinutes === 0 || !obj.totalMinutes) && obj.subTasks && obj.subTasks.length > 0) {
        obj.totalMinutes = obj.subTasks.reduce((s, st) => s + (st.totalMinutes || 0), 0);
      }
      return obj;
    });

    const enriched = await enrichTasks(fixedTasks);
    res.json({ success: true, count: enriched.length, tasks: enriched });
  } catch (err) { next(err); }
};

exports.getWeeklyHours = async (req, res, next) => {
  try {
    const { weekKey, internId } = req.query;
    const wk = weekKey || currentWeekKey();
    const { start, end } = weekKeyToDateRange(wk);

    const filter = { date: { $gte: start, $lte: end } };
    if (req.user.role === "intern") {
      filter.assignedTo = req.user._id;
    } else if (internId && internId !== "All") {
      filter.assignedTo = internId;
    }

    const tasks = await Task.find(filter).populate("assignedTo", "name avatar avatarColor role");

    const visible = req.user.supervisorLevel === "junior"
      ? tasks.filter(t => t.assignedTo?.role === "intern" || String(t.assignedTo?._id) === String(req.user._id))
      : tasks;

    const grouped = {};
    visible.forEach(t => {
      const key = String(t.assignedTo._id);
      if (!grouped[key]) grouped[key] = { intern: t.assignedTo, totalMins: 0, taskCount: 0, leaveDays: 0, tasks: [] };
      if (t.isLeave) {
        grouped[key].leaveDays += 1;
      } else {
        const mins = (t.totalMinutes > 0)
          ? t.totalMinutes
          : (t.subTasks||[]).reduce((s, st) => s + (st.totalMinutes||0), 0);
        grouped[key].totalMins  += mins;
        grouped[key].taskCount  += 1;
      }
      grouped[key].tasks.push({ id: t._id, date: t.date, task: t.task, status: t.status, totalMinutes: t.totalMinutes, isLeave: t.isLeave });
    });

    const TARGET_MINS = 30 * 60;
    const report = Object.values(grouped).map(g => ({
      ...g,
      targetMins: TARGET_MINS,
      pct: Math.min(100, Math.round((g.totalMins / TARGET_MINS) * 100)),
      met: g.totalMins >= TARGET_MINS,
    }));

    res.json({ success: true, weekKey: wk, report });
  } catch (err) { next(err); }
};

exports.getTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("assignedTo", "name avatar avatarColor role supervisorLevel")
      .populate("createdBy",  "name role");

    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    if (req.user.role === "intern" && String(task.assignedTo._id) !== String(req.user._id))
      return res.status(403).json({ success: false, message: "Access denied." });

    if (req.user.supervisorLevel === "junior") {
      const at = task.assignedTo;
      if (at.role !== "intern" && String(at._id) !== String(req.user._id))
        return res.status(403).json({ success: false, message: "Access denied." });
    }

    const [enriched] = await enrichTasks([task]);
    res.json({ success: true, task: enriched });
  } catch (err) { next(err); }
};

exports.createTask = async (req, res, next) => {
  try {
    const {
      date, project, assignedBy, assignedTo,
      task, status, estimateTime,
      timeFrom, timeTo, totalMinutes, workDoc, reason,
      isLeave, leaveReason,
    } = req.body;

    let targetId;
    if (req.user.role === "intern") {
      targetId = req.user._id;
    } else {
      if (!assignedTo)
        return res.status(400).json({ success: false, message: "Please select a person to assign this task to." });
      if (!mongoose.Types.ObjectId.isValid(assignedTo))
        return res.status(400).json({ success: false, message: "Invalid assignedTo value." });

      const targetUser = await User.findById(assignedTo);
      if (!targetUser) return res.status(404).json({ success: false, message: "Assigned user not found." });

      if (req.user.supervisorLevel === "junior") {
        if (targetUser.role === "supervisor" && String(targetUser._id) !== String(req.user._id))
          return res.status(403).json({ success: false, message: "Junior supervisors cannot assign tasks to other supervisors." });
      }
      targetId = assignedTo;
    }

    const newTask = await Task.create({
      date,
      project:      project      || "EGI",
      assignedBy:   assignedBy   || req.user.name,
      assignedTo:   targetId,
      createdBy:    req.user._id,
      task:         isLeave ? (leaveReason || "Leave Day") : task,
      status:       isLeave ? "Done" : (status || "To Do"),
      estimateTime: estimateTime || "",
      timeFrom:     timeFrom     || "",
      timeTo:       timeTo       || "",
      totalMinutes: isLeave ? 0 : (parseInt(totalMinutes) || 0),
      workDoc:      workDoc      || "",
      reason:       reason       || "",
      isLeave:      isLeave      || false,
      leaveReason:  leaveReason  || "",
      adminChecked: [],
      subTasks:     [],
    });

    await newTask.populate("assignedTo", "name avatar avatarColor");
    await newTask.populate("createdBy",  "name");

    const [enriched] = await enrichTasks([newTask]);
    res.status(201).json({ success: true, task: enriched });
  } catch (err) { next(err); }
};

exports.updateTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate("assignedTo", "role");
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    if (req.user.role === "intern" && String(task.assignedTo._id) !== String(req.user._id))
      return res.status(403).json({ success: false, message: "Access denied." });

    if (req.user.supervisorLevel === "junior") {
      if (task.assignedTo.role !== "intern" && String(task.assignedTo._id) !== String(req.user._id))
        return res.status(403).json({ success: false, message: "Access denied." });
    }

    const fields = ["date","project","assignedBy","assignedTo","task","status",
                    "estimateTime","timeFrom","timeTo","totalMinutes","workDoc","reason",
                    "isLeave","leaveReason"];
    fields.forEach(f => { if (req.body[f] !== undefined) task[f] = req.body[f]; });
    if (req.body.totalMinutes !== undefined) task.totalMinutes = parseInt(req.body.totalMinutes) || 0;

    await task.save();
    await task.populate("assignedTo", "name avatar avatarColor");
    await task.populate("createdBy",  "name");

    const [enriched] = await enrichTasks([task]);
    res.json({ success: true, task: enriched });
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate("assignedTo","role");
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    if (req.user.role === "intern" && String(task.assignedTo._id) !== String(req.user._id))
      return res.status(403).json({ success: false, message: "Access denied." });

    task.status = req.body.status;
    await task.save();
    await task.populate("assignedTo", "name avatar avatarColor");

    const [enriched] = await enrichTasks([task]);
    res.json({ success: true, task: enriched });
  } catch (err) { next(err); }
};

exports.toggleCheck = async (req, res, next) => {
  try {
    if (req.user.role !== "supervisor")
      return res.status(403).json({ success: false, message: "Supervisors only." });

    const task = await Task.findById(req.params.id).populate("assignedTo","role");
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    if (req.user.supervisorLevel === "junior" && task.assignedTo?.role === "supervisor"
        && String(task.assignedTo._id) !== String(req.user._id))
      return res.status(403).json({ success: false, message: "Access denied." });

    const already = task.adminChecked.includes(req.user.username);
    task.adminChecked = already
      ? task.adminChecked.filter(u => u !== req.user.username)
      : [...task.adminChecked, req.user.username];

    await task.save();
    await task.populate("assignedTo", "name avatar avatarColor");

    const [enriched] = await enrichTasks([task]);
    res.json({ success: true, task: enriched });
  } catch (err) { next(err); }
};

exports.deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate("assignedTo","role");
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    if (req.user.role === "intern" && String(task.assignedTo._id) !== String(req.user._id))
      return res.status(403).json({ success: false, message: "Access denied." });

    if (req.user.supervisorLevel === "junior" && task.assignedTo?.role === "supervisor"
        && String(task.assignedTo._id) !== String(req.user._id))
      return res.status(403).json({ success: false, message: "Access denied." });

    await task.deleteOne();
    res.json({ success: true, message: "Task deleted." });
  } catch (err) { next(err); }
};

exports.createSubTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate("assignedTo","role");
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });
    if (task.isLeave) return res.status(400).json({ success: false, message: "Cannot add sub-tasks to a leave day." });

    if (req.user.role === "intern" && String(task.assignedTo._id) !== String(req.user._id))
      return res.status(403).json({ success: false, message: "Access denied." });


    const existingMins = task.totalMinutes || 0;

    const { title } = req.body;
    task.subTasks.push({ title, status: "To Do", estimateTime: "", timeFrom: "", timeTo: "", totalMinutes: 0, workDoc: "", reason: "" });

  
    task.totalMinutes = existingMins;

    await task.save();
    await task.populate("assignedTo", "name avatar avatarColor");
    await task.populate("createdBy",  "name");

    const [enriched] = await enrichTasks([task]);
    res.status(201).json({ success: true, subTask: task.subTasks[task.subTasks.length - 1], task: enriched });
  } catch (err) { next(err); }
};

exports.updateSubTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate("assignedTo","role");
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    if (req.user.role === "intern" && String(task.assignedTo._id) !== String(req.user._id))
      return res.status(403).json({ success: false, message: "Access denied." });

    const sub = task.subTasks.id(req.params.subId);
    if (!sub) return res.status(404).json({ success: false, message: "Sub-task not found." });

   
    if (req.body.title        !== undefined) sub.title        = req.body.title;
    if (req.body.totalMinutes !== undefined) sub.totalMinutes = parseInt(req.body.totalMinutes) || 0;

    await task.save();
    await task.populate("assignedTo", "name avatar avatarColor");
    await task.populate("createdBy",  "name");

    const [enriched] = await enrichTasks([task]);
    res.json({ success: true, task: enriched });
  } catch (err) { next(err); }
};

exports.deleteSubTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate("assignedTo","role");
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    if (req.user.role === "intern" && String(task.assignedTo._id) !== String(req.user._id))
      return res.status(403).json({ success: false, message: "Access denied." });

    const existingMins = task.totalMinutes || 0;
    task.subTasks = task.subTasks.filter(st => String(st._id) !== req.params.subId);
    task.totalMinutes = existingMins;

    await task.save();
    await task.populate("assignedTo", "name avatar avatarColor");
    await task.populate("createdBy",  "name");

    const [enriched] = await enrichTasks([task]);
    res.json({ success: true, message: "Sub-task deleted.", task: enriched });
  } catch (err) { next(err); }
};

exports.fixHours = async (req, res, next) => {
  try {
    if (req.user.supervisorLevel !== "senior")
      return res.status(403).json({ success: false, message: "Senior supervisors only." });

    const tasks = await Task.find({ isLeave: { $ne: true } });
    let fixed = 0;

    for (const task of tasks) {
      if (task.subTasks && task.subTasks.length > 0) {
        const subTotal = task.subTasks.reduce((s, st) => s + (st.totalMinutes || 0), 0);
        if (subTotal > 0 && task.totalMinutes !== subTotal) {
          task.totalMinutes = subTotal;
          await task.save();
          fixed++;
        }
      }
    }

    res.json({ success: true, message: `Fixed ${fixed} tasks.`, fixed });
  } catch (err) { next(err); }
};