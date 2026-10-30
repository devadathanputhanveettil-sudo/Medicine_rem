const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "data.json");
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-before-deployment";

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = { users: [], medicines: [], doseLogs: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    throw new Error("Could not read data.json. Stop the server and check the file.");
  }
}
function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
function makeId() {
  return crypto.randomUUID();
}
function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Please log in first." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Your session expired. Please log in again." });
  }
}

app.get("/api/health", (req, res) => res.json({ status: "ok", app: "MediReminder" }));

app.post("/api/register", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (name.length < 2) return res.status(400).json({ error: "Name must be at least 2 characters." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });

  const db = readDb();
  if (db.users.some(u => u.email === email)) return res.status(409).json({ error: "An account with this email already exists." });
  const user = { id: makeId(), name, email, passwordHash: await bcrypt.hash(password, 10), createdAt: new Date().toISOString() };
  db.users.push(user);
  writeDb(db);
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
  res.status(201).json({ token, user: safeUser(user) });
});

app.post("/api/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const db = readDb();
  const user = db.users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: safeUser(user) });
});

app.get("/api/me", auth, (req, res) => {
  const db = readDb();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json({ user: safeUser(user) });
});

app.get("/api/medicines", auth, (req, res) => {
  const db = readDb();
  const medicines = db.medicines
    .filter(m => m.userId === req.user.id)
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  res.json({ medicines });
});

app.post("/api/medicines", auth, (req, res) => {
  const name = String(req.body.name || "").trim();
  const dosage = String(req.body.dosage || "").trim();
  const time = String(req.body.time || "").trim();
  const instructions = String(req.body.instructions || "").trim();
  const refillDate = String(req.body.refillDate || "").trim();
  if (!name || !dosage || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return res.status(400).json({ error: "Medicine name, dosage and a valid reminder time are required." });
  }
  const db = readDb();
  const medicine = {
    id: makeId(), userId: req.user.id, name, dosage, time,
    instructions, refillDate, createdAt: new Date().toISOString(), active: true
  };
  db.medicines.push(medicine);
  writeDb(db);
  res.status(201).json({ medicine });
});

app.put("/api/medicines/:id", auth, (req, res) => {
  const db = readDb();
  const medicine = db.medicines.find(m => m.id === req.params.id && m.userId === req.user.id);
  if (!medicine) return res.status(404).json({ error: "Medicine not found." });
  const name = String(req.body.name || "").trim();
  const dosage = String(req.body.dosage || "").trim();
  const time = String(req.body.time || "").trim();
  if (!name || !dosage || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return res.status(400).json({ error: "Medicine name, dosage and a valid reminder time are required." });
  }
  medicine.name = name;
  medicine.dosage = dosage;
  medicine.time = time;
  medicine.instructions = String(req.body.instructions || "").trim();
  medicine.refillDate = String(req.body.refillDate || "").trim();
  writeDb(db);
  res.json({ medicine });
});

app.delete("/api/medicines/:id", auth, (req, res) => {
  const db = readDb();
  const before = db.medicines.length;
  db.medicines = db.medicines.filter(m => !(m.id === req.params.id && m.userId === req.user.id));
  if (db.medicines.length === before) return res.status(404).json({ error: "Medicine not found." });
  writeDb(db);
  res.json({ message: "Medicine deleted." });
});

app.get("/api/logs", auth, (req, res) => {
  const db = readDb();
  const logs = db.doseLogs
    .filter(log => log.userId === req.user.id)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, 100);
  res.json({ logs });
});

app.post("/api/logs", auth, (req, res) => {
  const medicineId = String(req.body.medicineId || "");
  const status = String(req.body.status || "");
  const date = String(req.body.date || new Date().toISOString().slice(0, 10));
  if (!["taken", "missed"].includes(status)) return res.status(400).json({ error: "Status must be taken or missed." });
  const db = readDb();
  const medicine = db.medicines.find(m => m.id === medicineId && m.userId === req.user.id);
  if (!medicine) return res.status(404).json({ error: "Medicine not found." });
  const log = {
    id: makeId(), userId: req.user.id, medicineId,
    medicineName: medicine.name, dosage: medicine.dosage, status, date,
    recordedAt: new Date().toISOString()
  };
  db.doseLogs.push(log);
  writeDb(db);
  res.status(201).json({ log });
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  readDb();
  console.log(`MediReminder is running at http://localhost:${PORT}`);
});
