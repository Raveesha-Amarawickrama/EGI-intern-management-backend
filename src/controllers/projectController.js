
const Project = require("../models/Project");
const Task    = require("../models/Task");

exports.getProjects = async (req, res, next) => {
  try {
    const projects = await Project.find().sort({ name: 1 });
    res.json({ success: true, projects });
  } catch (err) { next(err); }
};

exports.getProjectStats = async (req, res, next) => {
  try {
    const { name } = req.params;
    const tasks    = await Task.find({ project: name });
    const done     = tasks.filter(t => t.status === "Done").length;

    const stats = {
      total:      tasks.length,
      done,
      inProgress: tasks.filter(t => t.status === "In Progress").length,
      hold:       tasks.filter(t => t.status === "Hold").length,
      todo:       tasks.filter(t => t.status === "To Do").length,
      totalMins:  tasks.reduce((s, t) => s + (t.totalMinutes || 0), 0),
      pct:        tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    };

    res.json({ success: true, stats });
  } catch (err) { next(err); }
};

exports.createProject = async (req, res, next) => {
  try {
    const { name, fullName, color, icon } = req.body;
    const project = await Project.create({ name, fullName, color: color || "#1a6640", icon: icon || "🗂️" });
    res.status(201).json({ success: true, project });
  } catch (err) { next(err); }
};

exports.deleteProject = async (req, res, next) => {
  try {
    await Project.findOneAndDelete({ name: req.params.name });
    res.json({ success: true, message: "Project deleted." });
  } catch (err) { next(err); }
};