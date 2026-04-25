
const Task    = require("../models/Task");
const User    = require("../models/User");
const Project = require("../models/Project");

const currentWeekKey = () => {
  const d    = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
};


exports.getInternReport = async (req, res, next) => {
  try {
    const interns = await User.find({ role: "intern" }).select("-password").sort({ name: 1 });
    const wk = currentWeekKey();

    const report = await Promise.all(interns.map(async (intern) => {
      const allTasks = await Task.find({ assignedTo: intern._id });

    
      const leaveTasks    = allTasks.filter(t => t.isLeave === true);
      const realTasks     = allTasks.filter(t => t.isLeave !== true);
      const weekRealTasks = realTasks.filter(t => t.weekKey === wk);

      const total      = realTasks.length;
      const done       = realTasks.filter(t => t.status === "Done").length;
      const inProgress = realTasks.filter(t => t.status === "In Progress").length;
      const hold       = realTasks.filter(t => t.status === "Hold").length;
      const todo       = realTasks.filter(t => t.status === "To Do").length;
      const leaveDays  = leaveTasks.length;

  
      const totalMins = realTasks.reduce((s, t) => {
        const p = t.totalMinutes || 0;
        const sub = (t.subTasks||[]).reduce((ss, st) => ss + (st.totalMinutes||0), 0);
        return s + (p > 0 ? p : sub);
      }, 0);
      const weekMins  = weekRealTasks.reduce((s, t) => {
        const p = t.totalMinutes || 0;
        const sub = (t.subTasks||[]).reduce((ss, st) => ss + (st.totalMinutes||0), 0);
        return s + (p > 0 ? p : sub);
      }, 0);
      const pct       = total > 0 ? Math.round((done / total) * 100) : 0;

      return {
        _id: intern._id, name: intern.name, username: intern.username,
        email: intern.email, position: intern.position, department: intern.department,
        startDate: intern.startDate, endDate: intern.endDate,
        avatar: intern.avatar, avatarColor: intern.avatarColor,
        stats: { total, done, inProgress, hold, todo, leaveDays, totalMins, weekMins, pct },
      };
    }));

    res.json({ success: true, report });
  } catch (err) { next(err); }
};


exports.getProjectReport = async (req, res, next) => {
  try {
    const projects = await Project.find().sort({ name: 1 });

    const report = await Promise.all(projects.map(async (p) => {
      const tasks      = await Task.find({ project: p.name, isLeave: { $ne: true } });
      const done       = tasks.filter(t => t.status === "Done").length;
      const inProgress = tasks.filter(t => t.status === "In Progress").length;
      const hold       = tasks.filter(t => t.status === "Hold").length;
      const todo       = tasks.filter(t => t.status === "To Do").length;
   
      const totalMins  = tasks.reduce((s, t) => {
        const parentMins = t.totalMinutes || 0;
        const subMins    = (t.subTasks||[]).reduce((ss, st) => ss + (st.totalMinutes||0), 0);
        return s + (parentMins > 0 ? parentMins : subMins);
      }, 0);
      const total      = tasks.length;
      const pct        = total > 0 ? Math.round((done / total) * 100) : 0;

      return {
        _id: p._id, id: p._id, name: p.name, fullName: p.fullName,
        color: p.color, icon: p.icon,
        stats: { total, done, inProgress, hold, todo, totalMins, pct },
      };
    }));

    res.json({ success: true, report });
  } catch (err) { next(err); }
};


exports.getSummary = async (req, res, next) => {
  try {
    const internCount = await User.countDocuments({ role: "intern" });
    const realTasks   = await Task.find({ isLeave: { $ne: true } });
    const total       = realTasks.length;
    const done        = realTasks.filter(t => t.status === "Done").length;
    const totalMins   = realTasks.reduce((s, t) => s + (t.totalMinutes || 0), 0);
    res.json({ success: true, summary: { internCount, total, done, totalMins, pct: total ? Math.round((done/total)*100) : 0 } });
  } catch (err) { next(err); }
};

exports.getSupervisorReport = async (req, res, next) => {
  try {
    const supervisors = await User.find({ role: "supervisor" }).select("-password").sort({ name: 1 });
    const wk = currentWeekKey();

    const report = await Promise.all(supervisors.map(async (sv) => {
      const allTasks = await Task.find({ assignedTo: sv._id });

      const leaveTasks    = allTasks.filter(t => t.isLeave === true);
      const realTasks     = allTasks.filter(t => t.isLeave !== true);
      const weekRealTasks = realTasks.filter(t => t.weekKey === wk);

      const total      = realTasks.length;
      const done       = realTasks.filter(t => t.status === "Done").length;
      const inProgress = realTasks.filter(t => t.status === "In Progress").length;
      const hold       = realTasks.filter(t => t.status === "Hold").length;
      const todo       = realTasks.filter(t => t.status === "To Do").length;
      const leaveDays  = leaveTasks.length;

      const totalMins = realTasks.reduce((s, t) => {
        const p   = t.totalMinutes || 0;
        const sub = (t.subTasks || []).reduce((ss, st) => ss + (st.totalMinutes || 0), 0);
        return s + (p > 0 ? p : sub);
      }, 0);
      const weekMins = weekRealTasks.reduce((s, t) => {
        const p   = t.totalMinutes || 0;
        const sub = (t.subTasks || []).reduce((ss, st) => ss + (st.totalMinutes || 0), 0);
        return s + (p > 0 ? p : sub);
      }, 0);
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;

      return {
        _id: sv._id, name: sv.name, username: sv.username,
        email: sv.email, position: sv.position, department: sv.department,
        supervisorLevel: sv.supervisorLevel,
        avatar: sv.avatar, avatarColor: sv.avatarColor,
        stats: { total, done, inProgress, hold, todo, leaveDays, totalMins, weekMins, pct },
      };
    }));

    res.json({ success: true, report });
  } catch (err) { next(err); }
};