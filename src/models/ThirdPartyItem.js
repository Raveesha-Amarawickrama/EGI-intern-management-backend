const mongoose = require("mongoose");

const thirdPartyItemSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    vendor:   { type: String, required: true, trim: true },
    category: { type: String, default: "" },

    // Stored as "YYYY-MM-DD" string
    renewalDate: { type: String, required: true },

    renewalCycle: {
      type: String,
      enum: ["monthly", "quarterly", "yearly", "one-time"],
      default: "yearly",
    },

    cost:  { type: Number, default: 0 },
    notes: { type: String, default: "" },

    // ── "completed" = a one-time item that's been marked renewed/done ──────
    status: { type: String, enum: ["active", "cancelled", "expired", "completed"], default: "active" },

    // ── CHANGED: was a single Date guard that fired once. Now stores the
    // "YYYY-MM-DD" of the last day a reminder was sent, so the job can send
    // once per day throughout the whole 7-day-to-expiry window instead of
    // only once, ever. ─────────────────────────────────────────────────────
    lastNotifiedDate: { type: String, default: null },

    // ── NEW: audit trail for when a supervisor last marked this renewed ────
    lastRenewedAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ThirdPartyItem", thirdPartyItemSchema);