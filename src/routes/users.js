// routes/users.js
const express  = require("express");
const router   = express.Router();
const {
  getAllUsers, getUser, updateUser, deleteUser, getUserStats,
  uploadProfilePicture, deleteProfilePicture,
  uploadUserDocument, deleteUserDocument,
} = require("../controllers/userController");
const { protect, restrictTo }  = require("../middleware/auth");
const { profileUpload, documentUpload } = require("../middleware/uploadCloudinary");

router.use(protect);

router.get("/",          restrictTo("supervisor"), getAllUsers);
router.get("/:id",       getUser);
router.patch("/:id",     updateUser);
router.delete("/:id",    restrictTo("supervisor"), deleteUser);
router.get("/:id/stats", getUserStats);

// ── Profile picture ──────────────────────────────────────────────────────────
router.post(   "/:id/profile-picture", profileUpload.single("profilePicture"), uploadProfilePicture);
router.delete( "/:id/profile-picture", deleteProfilePicture);

// ── Employee documents (CV / Police Report / Grama Niladhari) ────────────────
// docType: "cv" | "policeReport" | "gramaNiladhari"
router.post(   "/:id/documents/:docType", documentUpload.single("document"), uploadUserDocument);
router.delete( "/:id/documents/:docType", deleteUserDocument);

module.exports = router;