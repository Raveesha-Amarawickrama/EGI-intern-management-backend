

const multer                = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary            = require("../config/cloudinary");


const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder:         "egi/profile-pictures",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
    public_id:      `profile-${req.params.id}-${Date.now()}`,
    transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
  }),
});

const profileFileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error("Only image files (jpg, png, webp, gif) are allowed."), false);
};

const profileUpload = multer({
  storage:    profileStorage,
  fileFilter: profileFileFilter,
  limits:     { fileSize: 5 * 1024 * 1024 },
});


const documentStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const docType = req.params.docType || "document";
    return {
      folder:          "egi/documents",
      allowed_formats: ["pdf", "jpg", "jpeg", "png", "webp", "doc", "docx"],
      public_id:       `doc-${req.params.id}-${docType}-${Date.now()}`,
      resource_type:   "auto", // handle both images and raw files
    };
  },
});

const documentFileFilter = (req, file, cb) => {
  const allowed = [
    "application/pdf",
    "image/jpeg", "image/png", "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error("Allowed formats: PDF, JPG, PNG, WEBP, DOC, DOCX"), false);
};

const documentUpload = multer({
  storage:    documentStorage,
  fileFilter: documentFileFilter,
  limits:     { fileSize: 20 * 1024 * 1024 }, 
});


const generalStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder:        "egi/files",
    public_id:     `file-${req.user?._id || "unknown"}-${Date.now()}`,
    resource_type: "auto",
  }),
});

const generalUpload = multer({
  storage: generalStorage,
  limits:  { fileSize: 50 * 1024 * 1024 },
});

module.exports = { profileUpload, documentUpload, generalUpload };
