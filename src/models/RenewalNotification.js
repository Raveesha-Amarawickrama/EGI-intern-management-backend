const mongoose = require("mongoose");

const renewalNotificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    item:      { type: mongoose.Schema.Types.ObjectId, ref: "ThirdPartyItem", required: true },
    title:     { type: String, required: true },
    message:   { type: String, required: true },
    isRead:    { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RenewalNotification", renewalNotificationSchema);