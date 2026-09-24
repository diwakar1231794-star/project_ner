const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: true },
    message: { type: String, required: true },
    userId: { type: String, default: null },
    userName: { type: String, default: null },
    type: { type: String, default: "route_blocked" },
    sentAt: { type: String, default: () => new Date().toISOString() },
    status: { type: String, default: "simulated_sent" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
