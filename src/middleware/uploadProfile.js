// middleware/uploadProfile.js
// ── DEPRECATED – kept for backward compatibility only ──────────────────────────
// All upload logic has moved to uploadCloudinary.js.
// This file re-exports the profileUpload instance so any code that still
// requires "uploadProfile" won't break.

const { profileUpload } = require("./uploadCloudinary");
module.exports = profileUpload;