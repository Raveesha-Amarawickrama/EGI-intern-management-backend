
const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true },
    color:    { type: String, default: "#1a6640" },
    icon:     { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", projectSchema);