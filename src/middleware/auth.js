const jwt  = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Not authorised. No token." });
    }
    const token   = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(401).json({ success: false, message: "User no longer exists." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
};

const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "You do not have permission." });
  }
  next();
};

const seniorOnly = (req, res, next) => {
  if (req.user.role !== "supervisor" || req.user.supervisorLevel !== "senior") {
    return res.status(403).json({ success: false, message: "Senior supervisors only." });
  }
  next();
};

// ── NEW ───────────────────────────────────────────────────────────────────────
const adminOnly = (req, res, next) => {
  if (req.user && (req.user.role === "admin" || req.user.role === "supervisor")) {
    return next();
  }
  return res.status(403).json({ success: false, message: "Admin access required." });
};

module.exports = { protect, restrictTo, seniorOnly, adminOnly }; // ← adminOnly added