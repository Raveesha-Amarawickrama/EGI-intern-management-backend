
const jwt  = require("jsonwebtoken");
const User = require("../models/User");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });


exports.login = async (req, res, next) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !role)
      return res.status(400).json({ success: false, message: "username, password and role are required." });

    const user = await User.findOne({ username: username.toLowerCase(), role });
    if (!user)
      return res.status(401).json({ success: false, message: "Invalid credentials." });

    const match = await user.comparePassword(password);
    if (!match)
      return res.status(401).json({ success: false, message: "Invalid credentials." });

    const token = signToken(user._id);
    const safeUser = user.toSafeObject();

    res.status(200).json({
      success: true,
      token,
      user: safeUser,
      mustChangePassword: user.mustChangePassword || false,
    });
  } catch (err) { next(err); }
};


exports.register = async (req, res, next) => {
  try {
    const {
      name, username, password, role, supervisorLevel,
      email, contact, position, department,
      startDate, endDate, avatar, avatarColor,
    } = req.body;

    const user = await User.create({
      name, username, password,
      role, supervisorLevel: supervisorLevel || null,
      email, contact, position, department,
      startDate, endDate,
      avatar:      avatar      || (name ? name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() : "U"),
      avatarColor: avatarColor || "#1a6640",
    });

    const token = signToken(user._id);
    res.status(201).json({ success: true, token, user: user.toSafeObject() });
  } catch (err) { next(err); }
};


exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.json({ success: true, user });
  } catch (err) { next(err); }
};


exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters." });

    const user = await User.findById(req.user._id);
    const match = await user.comparePassword(currentPassword);
    if (!match)
      return res.status(400).json({ success: false, message: "Current password incorrect." });

    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    res.json({ success: true, message: "Password changed successfully." });
  } catch (err) { next(err); }
};


exports.resetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });

   
    const target = await User.findById(req.params.userId);
    if (!target)
      return res.status(404).json({ success: false, message: "User not found." });

    if (req.user.supervisorLevel === "junior" && target.role !== "intern")
      return res.status(403).json({ success: false, message: "Junior supervisors can only reset intern passwords." });

    target.password = newPassword;
    target.mustChangePassword = true; 
    await target.save();

    res.json({ success: true, message: `Password reset for ${target.name}. They will be prompted to change it.` });
  } catch (err) { next(err); }
};