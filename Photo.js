const mongoose = require("mongoose");

const photoSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    description: { type: String, default: "No description" },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    role: { type: String, default: "public" },
    severity: { type: String, default: "Medium" },
    incidentType: { type: String, default: "Other" },
    filename: { type: String, default: null },
    url: { type: String, default: null },
    dataUrl: { type: String, default: null },
    timestamp: { type: String, default: () => new Date().toISOString() },
    syncedAt: { type: String, default: null },
    source: { type: String, default: "online" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Photo", photoSchema);
