
const User = require("../models/User");
const Task = require("../models/Task");


exports.getAllUsers = async (req, res, next) => {
  try {
    const { role } = req.query;
    let filter = role ? { role } : {};

    if (req.user.supervisorLevel === "junior") {
      if (!role || role === "intern") {
        filter = { role: "intern" };
      } else if (role === "supervisor") {
        filter = { _id: req.user._id };
      } else {
        filter = { $or: [{ role: "intern" }, { _id: req.user._id }] };
      }
    }

    const users = await User.find(filter).select("-password").sort({ name: 1 });
    res.json({ success: true, count: users.length, users });
  } catch (err) { next(err); }
};


exports.getUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.role === "intern" && String(req.user._id) !== id)
      return res.status(403).json({ success: false, message: "Access denied." });

    if (req.user.supervisorLevel === "junior") {
      const target = await User.findById(id).select("-password");
      if (!target) return res.status(404).json({ success: false, message: "User not found." });
      if (target.role === "supervisor" && target.supervisorLevel === "senior" && String(target._id) !== String(req.user._id))
        return res.status(403).json({ success: false, message: "Access denied." });
      return res.json({ success: true, user: target });
    }

    const user = await User.findById(id).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    res.json({ success: true, user });
  } catch (err) { next(err); }
};


exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.role === "intern" && String(req.user._id) !== id)
      return res.status(403).json({ success: false, message: "Access denied." });

    const allowed = ["name","email","contact","position","department","startDate","endDate","avatar","avatarColor"];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (req.body.supervisorLevel !== undefined && req.user.supervisorLevel === "senior")
      updates.supervisorLevel = req.body.supervisorLevel;

    const user = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).select("-password");
    res.json({ success: true, user });
  } catch (err) { next(err); }
};


exports.deleteUser = async (req, res, next) => {
  try {
    if (req.user.supervisorLevel !== "senior")
      return res.status(403).json({ success: false, message: "Senior supervisors only." });

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "User deleted." });
  } catch (err) { next(err); }
};

exports.getUserStats = async (req, res, next) => {
  try {
    const allTasks   = await Task.find({ assignedTo: req.params.id });

    const realTasks  = allTasks.filter(t => t.isLeave !== true);
    const leaveDays  = allTasks.filter(t => t.isLeave === true).length;

    const total      = realTasks.length;
    const done       = realTasks.filter(t => t.status === "Done").length;
    const inProgress = realTasks.filter(t => t.status === "In Progress").length;
    const hold       = realTasks.filter(t => t.status === "Hold").length;
    const todo       = realTasks.filter(t => t.status === "To Do").length;


    const totalMins  = realTasks.reduce((s, t) => {
      const p   = t.totalMinutes || 0;
      const sub = (t.subTasks||[]).reduce((ss, st) => ss + (st.totalMinutes||0), 0);
      return s + (p > 0 ? p : sub);
    }, 0);

    const pct = total ? Math.round((done / total) * 100) : 0;

    res.json({ success: true, stats: { total, done, inProgress, hold, todo, leaveDays, totalMins, pct } });
  } catch (err) { next(err); }
};