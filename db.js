const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

let isConnected = false;

function readJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {}
  return fallback;
}

async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/routeai";

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 4000 // Quick timeout to prevent blocking if Mongo is offline
    });

    isConnected = true;
    console.log(` Connected to MongoDB: ${mongoose.connection.host}/${mongoose.connection.name}`);

    // Auto-seed data from local JSON if MongoDB collections are empty
    await seedFromJSON();
  } catch (err) {
    isConnected = false;
    console.warn(`⚠️  MongoDB connection warning: ${err.message}`);
    console.warn("ℹ️  Running in dual-mode: Using local JSON files as fallback. Configure MONGODB_URI in backend/.env to connect to MongoDB.");
  }

  mongoose.connection.on("connected", () => {
    isConnected = true;
    console.log(" MongoDB connection re-established.");
  });

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
    console.warn("⚠️  MongoDB disconnected. Using local file fallback.");
  });

  return isConnected;
}

function isDBConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

async function seedFromJSON() {
  try {
    const User = require("../models/User");
    const Photo = require("../models/Photo");
    const Notification = require("../models/Notification");

    const dataDir = path.join(__dirname, "..", "data");
    const usersFile = path.join(dataDir, "users.json");
    const photosFile = path.join(dataDir, "photos.json");
    const notifsFile = path.join(dataDir, "notifications.json");

    // Seed Users
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const defaultUsers = [
        { id: "1", username: "admin", password: "admin123", role: "admin", name: "Admin Official", phone: "+919876543210" },
        { id: "2", username: "officer1", password: "pass123", role: "official", name: "Road Officer", phone: "+919876543211" },
        { id: "3", username: "user1", password: "user123", role: "public", name: "Public User", phone: "+919876543212" },
        { id: "4", username: "citizen", password: "citizen", role: "public", name: "Citizen", phone: "+919876543213" }
      ];
      const jsonUsers = readJSON(usersFile, defaultUsers);
      for (const u of jsonUsers) {
        await User.updateOne({ id: u.id }, { $set: u }, { upsert: true });
      }
      console.log(` Seeded ${jsonUsers.length} users into MongoDB.`);
    }

    // Seed Photos
    const photoCount = await Photo.countDocuments();
    if (photoCount === 0 && fs.existsSync(photosFile)) {
      const jsonPhotos = readJSON(photosFile, []);
      if (jsonPhotos.length > 0) {
        for (const p of jsonPhotos) {
          await Photo.updateOne({ id: p.id }, { $set: p }, { upsert: true });
        }
        console.log(` Seeded ${jsonPhotos.length} photo reports into MongoDB.`);
      }
    }

    // Seed Notifications
    const notifCount = await Notification.countDocuments();
    if (notifCount === 0 && fs.existsSync(notifsFile)) {
      const jsonNotifs = readJSON(notifsFile, []);
      if (jsonNotifs.length > 0) {
        for (const n of jsonNotifs) {
          await Notification.updateOne({ id: n.id }, { $set: n }, { upsert: true });
        }
        console.log(` Seeded ${jsonNotifs.length} notifications into MongoDB.`);
      }
    }
  } catch (seedErr) {
    console.warn("Notice: Seed check completed with notice:", seedErr.message);
  }
}

module.exports = {
  connectDB,
  isDBConnected,
  seedFromJSON
};
