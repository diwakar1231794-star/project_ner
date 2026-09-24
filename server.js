/**
 * RouteAI Backend
 * - Simple login (public / official)
 * - Geo-tagged photo storage
 * - Route analysis (blockage + weather)
 * - SMS alert simulation when all routes blocked
 */
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const sessions = new Map();
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

// Paths
const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PHOTOS_FILE = path.join(DATA_DIR, "photos.json");
const NOTIFS_FILE = path.join(DATA_DIR, "notifications.json");

// Ensure dirs
[DATA_DIR, UPLOADS_DIR].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Default users (simple auth for local/dev)
const DEFAULT_USERS = [
  { id: "1", username: "admin", password: "admin123", role: "admin", name: "Admin Official", phone: "+919876543210" },
  { id: "2", username: "officer1", password: "pass123", role: "official", name: "Road Officer", phone: "+919876543211" },
  { id: "3", username: "user1", password: "user123", role: "public", name: "Public User", phone: "+919876543212" },
  { id: "4", username: "citizen", password: "citizen", role: "public", name: "Citizen", phone: "+919876543213" }
];

function readJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {}
  return fallback;
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Init data
if (!fs.existsSync(USERS_FILE)) writeJSON(USERS_FILE, DEFAULT_USERS);
// Upgrade the original demo admin account, including installations with existing users.json.
const existingUsers = readJSON(USERS_FILE, DEFAULT_USERS);
const originalAdmin = existingUsers.find(u => u.username === "admin");
if (originalAdmin && originalAdmin.role !== "admin") { originalAdmin.role = "admin"; writeJSON(USERS_FILE, existingUsers); }
if (!fs.existsSync(PHOTOS_FILE)) writeJSON(PHOTOS_FILE, []);
if (!fs.existsSync(NOTIFS_FILE)) writeJSON(NOTIFS_FILE, []);

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve frontend
const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));
app.use("/uploads", express.static(UPLOADS_DIR));

// Multer for photo uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

// ========== AUTH ==========
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  const users = readJSON(USERS_FILE, DEFAULT_USERS);
  const user = users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
  );
  if (!user) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  // Simple token (not production-grade; use JWT in production)
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, user.id);
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      phone: user.phone
    }
  });
});

app.get("/api/me", (req, res) => {
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ error: "Please sign in again" });
  res.json({ id:user.id, username:user.username, name:user.name, role:user.role, phone:user.phone });
});
app.post("/api/logout", (req,res) => {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  sessions.delete(token); res.json({ success:true });
});
function requireAuth(req,res,next) {
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ error:"Please sign in to submit reports" });
  req.authUser=user; next();
}
function requireOwnerOrAdmin(req,res,next) {
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ error:"Please sign in" });
  req.authUser=user; next();
}
// ========== PHOTOS ==========
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "RouteAI", time: new Date().toISOString() });
});

app.get("/api/photos", (_req, res) => {
  const photos = readJSON(PHOTOS_FILE, []);
  res.json(photos);
});


function getUserFromToken(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const id = sessions.get(token);
  if (!id) return null;
  return readJSON(USERS_FILE, DEFAULT_USERS).find(u => String(u.id) === String(id)) || null;
}
app.delete("/api/photos/:id", requireOwnerOrAdmin, (req, res) => {
  const user = req.authUser;
  if (!user) return res.status(401).json({ error: "Login required" });

  const photos = readJSON(PHOTOS_FILE, []);
  const index = photos.findIndex((p) => String(p.id) === String(req.params.id));
  if (index === -1) return res.status(404).json({ error: "Report not found" });

  const photo = photos[index];
  if (user.role !== "admin" && String(photo.userId) !== String(user.id)) {
    return res.status(403).json({ error: "You can delete only your own reports" });
  }

  if (photo.filename) {
    const filePath = path.join(UPLOADS_DIR, path.basename(photo.filename));
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
  }

  photos.splice(index, 1);
  writeJSON(PHOTOS_FILE, photos);
  res.json({ success: true, deletedId: req.params.id });
});

app.post("/api/photos/batch", requireAuth, (req, res) => {
  const user = req.authUser;
  if (!user) return res.status(401).json({ error: "Login required" });
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: "items required" });
  const photos = readJSON(PHOTOS_FILE, []);
  const created = [];
  for (const item of items.slice(0, 30)) {
    if (item.lat == null || item.lng == null || !Number.isFinite(Number(item.lat)) || !Number.isFinite(Number(item.lng)) || Math.abs(Number(item.lat)) > 90 || Math.abs(Number(item.lng)) > 180) continue;
    const photo = {
      id: uuidv4(),
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lng),
      description: item.description || "Offline report",
      userId: user.id,
      userName: user.name,
      role: user.role,
      severity: item.severity || "Medium",
      incidentType: item.incidentType || "Other",
      filename: null,
      url: null,
      dataUrl: item.dataUrl || null,
      timestamp: item.timestamp || new Date().toISOString(),
      syncedAt: new Date().toISOString(),
      source: "offline"
    };
    photos.push(photo);
    created.push(photo);
  }
  writeJSON(PHOTOS_FILE, photos.slice(-200));
  res.json({ success: true, count: created.length, photos: created });
});

app.post("/api/photos", requireAuth, upload.single("photo"), (req, res) => {
  const { lat, lng, description, userId, userName, role, severity, incidentType } = req.body || {};
  if (lat == null || lng == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || Math.abs(Number(lat)) > 90 || Math.abs(Number(lng)) > 180) {
    return res.status(400).json({ error: "lat and lng required" });
  }

  const photo = {
    id: uuidv4(),
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    description: description || "No description",
    userId: req.authUser.id,
    userName: req.authUser.name,
    role: req.authUser.role,
    severity: severity || "Medium",
    incidentType: incidentType || "Other",
    filename: req.file ? req.file.filename : null,
    url: req.file ? `/uploads/${req.file.filename}` : null,
    dataUrl: req.body.dataUrl || null, // for base64 fallback
    timestamp: new Date().toISOString()
  };

  const photos = readJSON(PHOTOS_FILE, []);
  photos.push(photo);
  writeJSON(PHOTOS_FILE, photos.slice(-100)); // keep last 100

  res.json({ success: true, photo });
});

// ========== ROUTE ANALYSIS (AI panel data) ==========
app.post("/api/analyze-route", async (req, res) => {
  const { fromLat, fromLng, toLat, toLng, routeCoords } = req.body || {};

  if ([fromLat, fromLng, toLat, toLng].some(v => v == null || Number.isNaN(Number(v)))) {
    return res.status(400).json({ error: "from/to coordinates required" });
  }

  const photos = readJSON(PHOTOS_FILE, []);

  // 1. Road blockage analysis
  let blockedCount = 0;
  const nearbyBlockages = [];
  if (routeCoords && Array.isArray(routeCoords) && routeCoords.length > 1) {
    const THRESHOLD = 0.0012;
    for (const photo of photos) {
      for (let i = 0; i < routeCoords.length - 1; i++) {
        const p1 = routeCoords[i];
        const p2 = routeCoords[i + 1];
        const dist = pointToSegment(photo.lat, photo.lng, p1[0], p1[1], p2[0], p2[1]);
        if (dist < THRESHOLD) {
          blockedCount++;
          nearbyBlockages.push({
            id: photo.id,
            description: photo.description,
            lat: photo.lat,
            lng: photo.lng,
            by: photo.userName,
            role: photo.role,
            time: photo.timestamp
          });
          break;
        }
      }
    }
  }

  const roadAvailability = blockedCount === 0 ? "Clear" : blockedCount === 1 ? "Partially Blocked" : "Blocked";
  const isFullyBlocked = blockedCount >= 2 || (blockedCount >= 1 && nearbyBlockages.length >= 2);

  // 2. Weather (Open-Meteo – free, no key)
  let weather = { status: "unavailable", temp: null, condition: "Unknown", humidity: null };
  try {
    const midLat = (parseFloat(fromLat) + parseFloat(toLat)) / 2;
    const midLng = (parseFloat(fromLng) + parseFloat(toLng)) / 2;
    const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${midLat}&longitude=${midLng}&current=temperature_2m,relative_humidity_2m,weather_code,precipitation,wind_speed_10m`;
    const wRes = await fetch(wUrl);
    if (wRes.ok) {
      const wData = await wRes.json();
      const cur = wData.current || {};
      weather = {
        status: "ok",
        temp: cur.temperature_2m,
        humidity: cur.relative_humidity_2m,
        wind: cur.wind_speed_10m,
        precipitation: cur.precipitation,
        condition: weatherCodeToText(cur.weather_code),
        code: cur.weather_code
      };
    }
  } catch (e) {
    console.warn("Weather fetch failed:", e.message);
  }

  // 3. Overall AI summary
  const analysis = {
    roadAvailability,
    isFullyBlocked,
    blockageCount: blockedCount,
    nearbyBlockages,
    weather,
    recommendation: isFullyBlocked
      ? "All analyzed paths show blockages. Stay where you are. SMS alert will be sent."
      : roadAvailability === "Clear"
      ? "Roads appear clear. Safe to proceed."
      : "Some blockages reported. Prefer alternate route if available.",
    analyzedAt: new Date().toISOString()
  };

  res.json(analysis);
});

function weatherCodeToText(code) {
  const map = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Thunderstorm with heavy hail"
  };
  return map[code] || "Unknown";
}

function pointToSegment(px, py, x1, y1, x2, y2) {
  const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = lenSq !== 0 ? dot / lenSq : -1;
  let xx, yy;
  if (param < 0) { xx = x1; yy = y1; }
  else if (param > 1) { xx = x2; yy = y2; }
  else { xx = x1 + param * C; yy = y1 + param * D; }
  return Math.sqrt((px - xx) ** 2 + (py - yy) ** 2);
}

// ========== SMS ALERT (simulated + stored) ==========
app.post("/api/send-sms-alert", (req, res) => {
  const { phone, message, userId, userName } = req.body || {};
  if (!phone) {
    return res.status(400).json({ error: "phone required" });
  }

  const msg = message || "RouteAI Alert: All routes are blocked. Please stay where you are and wait for clearance.";

  // In production you would call Twilio / MSG91 / Fast2SMS here.
  // For this demo we log + store the notification.
  console.log("\n========== SMS ALERT ==========");
  console.log(`To     : ${phone}`);
  console.log(`User   : ${userName || userId || "Unknown"}`);
  console.log(`Message: ${msg}`);
  console.log("================================\n");

  const notif = {
    id: uuidv4(),
    phone,
    message: msg,
    userId: userId || null,
    userName: userName || null,
    type: "route_blocked",
    sentAt: new Date().toISOString(),
    status: "simulated_sent"
  };

  const notifs = readJSON(NOTIFS_FILE, []);
  notifs.push(notif);
  writeJSON(NOTIFS_FILE, notifs.slice(-50));

  res.json({
    success: true,
    message: "SMS alert sent (simulated)",
    notification: notif
  });
});

app.get("/api/notifications", (req, res) => {
  const notifs = readJSON(NOTIFS_FILE, []);
  res.json(notifs.reverse());
});

// Fallback to frontend index
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n🚀 RouteAI Backend running at http://localhost:${PORT}`);
  console.log(`   Sign-in page → http://localhost:${PORT}`);
  console.log(`   Accounts    → admin/admin123 (admin) | user1/user123 (public)\n`);
});
