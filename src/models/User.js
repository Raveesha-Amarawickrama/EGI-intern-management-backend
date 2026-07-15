const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

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
    mustChangePassword: { type: Boolean, default: false },

    // ── Profile: basic details ──────────────────────────────────────────
    gender:                { type: String, enum: ["Male", "Female", "Other", ""], default: "" },
    dateOfBirth:            { type: String, default: "" },
    nic:                    { type: String, default: "" }, // National ID / Passport
    address:                { type: String, default: "" },
    emergencyContactName:   { type: String, default: "" },
    emergencyContactPhone:  { type: String, default: "" },

    // ── Profile: bank details ───────────────────────────────────────────
    bankDetails: { type: bankDetailsSchema, default: () => ({}) },
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