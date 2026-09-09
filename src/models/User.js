const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

// ── Bank details ─────────────────────────────────────────────────────────────
const bankDetailsSchema = new mongoose.Schema(
  {
    bankName:          { type: String, default: "" },
    accountHolderName: { type: String, default: "" },
    accountNumber:     { type: String, default: "" },
    branchName:        { type: String, default: "" },
    ifscOrSwift:       { type: String, default: "" },
  },
  { _id: false }
);

// ── Family member (reused for spouse, father, mother) ─────────────────────────
const familyMemberSchema = new mongoose.Schema(
  {
    name:       { type: String, default: "" },
    nic:        { type: String, default: "" },
    occupation: { type: String, default: "" },
    contact:    { type: String, default: "" },
  },
  { _id: false }
);

// ── Child ─────────────────────────────────────────────────────────────────────
const childSchema = new mongoose.Schema(
  {
    name:        { type: String, default: "" },
    dateOfBirth: { type: String, default: "" },
    nic:         { type: String, default: "" },
  },
  { _id: true }
);

// ── Document (CV / Police Report / Grama Niladhari) ──────────────────────────
const documentFileSchema = new mongoose.Schema(
  {
    url:        { type: String, default: "" }, // Cloudinary HTTPS URL
    publicId:   { type: String, default: "" }, // Cloudinary public_id for deletion
    uploadedAt: { type: Date,   default: null },
  },
  { _id: false }
);

// ── Main user schema ──────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    name:            { type: String, required: true, trim: true },
    username:        { type: String, required: true, unique: true, trim: true, lowercase: true },
    password:        { type: String, required: true, minlength: 6 },
    role:            { type: String, required: true, enum: ["intern", "supervisor"] },

    supervisorLevel: { type: String, enum: ["senior", "supervisor", "junior", null], default: null },
    email:           { type: String, required: true, unique: true, trim: true, lowercase: true },
    contact:         { type: String, default: "" },
    position:        { type: String, default: "" },
    department:      { type: String, default: "" },
    startDate:       { type: String, default: "" },
    endDate:         { type: String, default: "" },
    avatar:          { type: String, default: "U" },
    avatarColor:     { type: String, default: "#1a6640" },

    // profile picture – Cloudinary HTTPS URL
    profilePicture:   { type: String, default: "" },
    // Cloudinary public_id for the profile picture (needed for deletion)
    profilePictureId: { type: String, default: "" },

    mustChangePassword: { type: Boolean, default: false },

    // ── Basic details ──────────────────────────────────────────────────────
    gender:                { type: String, enum: ["Male", "Female", "Other", ""], default: "" },
    dateOfBirth:           { type: String, default: "" },
    nic:                   { type: String, default: "" },
    address:               { type: String, default: "" },
    emergencyContactName:  { type: String, default: "" },
    emergencyContactPhone: { type: String, default: "" },

    // ── Bank details ───────────────────────────────────────────────────────
    bankDetails: { type: bankDetailsSchema, default: () => ({}) },

    // ── Family details ─────────────────────────────────────────────────────
    familyDetails: {
      type: new mongoose.Schema(
        {
          spouse:   { type: familyMemberSchema, default: () => ({}) },
          father:   { type: familyMemberSchema, default: () => ({}) },
          mother:   { type: familyMemberSchema, default: () => ({}) },
          children: { type: [childSchema],       default: []         },
        },
        { _id: false }
      ),
      default: () => ({}),
    },

    // ── Employer documents ─────────────────────────────────────────────────
    documents: {
      type: new mongoose.Schema(
        {
          cv:             { type: documentFileSchema, default: () => ({}) },
          policeReport:   { type: documentFileSchema, default: () => ({}) },
          gramaNiladhari: { type: documentFileSchema, default: () => ({}) },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

userSchema.virtual("isSeniorSupervisor").get(function () {
  return this.role === "supervisor" && this.supervisorLevel === "senior";
});
userSchema.virtual("isJuniorSupervisor").get(function () {
  return this.role === "supervisor" && this.supervisorLevel === "junior";
});

module.exports = mongoose.model("User", userSchema);