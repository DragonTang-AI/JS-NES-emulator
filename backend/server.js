const fs = require("fs");
const path = require("path");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const app = express();
app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 3030;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-nes-secret";
const DB_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DB_DIR, "nes.sqlite");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cloud_saves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  rom_name TEXT NOT NULL,
  slot INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, rom_name, slot)
);
`);

function signToken(user) {
  return jwt.sign(
    { uid: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function cleanUsername(name) {
  return String(name || "").trim();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "nes-api" });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const username = cleanUsername(req.body.username);
    const password = String(req.body.password || "");

    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      return res.status(400).json({ error: "账号需为3-24位字母数字下划线" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "密码至少6位" });
    }

    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (existing) {
      return res.status(409).json({ error: "账号已存在" });
    }

    const now = Date.now();
    const passwordHash = await bcrypt.hash(password, 10);
    const result = db.prepare(
      "INSERT INTO users (username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)"
    ).run(username, passwordHash, now, now);

    return res.json({ ok: true, userId: result.lastInsertRowid });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "注册失败" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const username = cleanUsername(req.body.username);
    const password = String(req.body.password || "");

    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!user) {
      return res.status(401).json({ error: "账号或密码错误" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "账号或密码错误" });
    }

    db.prepare("UPDATE users SET updated_at = ? WHERE id = ?").run(Date.now(), user.id);
    const token = signToken(user);
    return res.json({
      ok: true,
      token,
      user: { id: user.id, username: user.username },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "登录失败" });
  }
});

app.get("/api/auth/me", auth, (req, res) => {
  return res.json({
    ok: true,
    user: { id: req.user.uid, username: req.user.username },
  });
});

app.get("/api/saves/:rom", auth, (req, res) => {
  const { rom } = req.params;
  const rows = db.prepare(
    "SELECT slot, timestamp FROM cloud_saves WHERE user_id = ? AND rom_name = ? ORDER BY slot ASC"
  ).all(req.user.uid, rom);
  return res.json({ saves: rows.map(r => ({ slot: r.slot, timestamp: r.timestamp })) });
});

app.get("/api/saves/:rom/:slot", auth, (req, res) => {
  const { rom, slot } = req.params;
  const row = db.prepare(
    "SELECT state_json, timestamp FROM cloud_saves WHERE user_id = ? AND rom_name = ? AND slot = ?"
  ).get(req.user.uid, rom, Number(slot));
  if (!row) {
    return res.status(404).json({ error: "Save not found" });
  }
  return res.json({ state: JSON.parse(row.state_json), timestamp: row.timestamp });
});

app.put("/api/saves/:rom/:slot", auth, (req, res) => {
  const { rom, slot } = req.params;
  const { state, timestamp } = req.body;
  const stateJson = JSON.stringify(state);
  const now = Date.now();
  db.prepare(`
    INSERT INTO cloud_saves (user_id, rom_name, slot, state_json, timestamp, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, rom_name, slot) DO UPDATE SET
      state_json = excluded.state_json,
      timestamp = excluded.timestamp,
      updated_at = excluded.updated_at
  `).run(req.user.uid, rom, Number(slot), stateJson, timestamp || now, now);
  return res.json({ ok: true });
});

app.delete("/api/saves/:rom/:slot", auth, (req, res) => {
  const { rom, slot } = req.params;
  db.prepare(
    "DELETE FROM cloud_saves WHERE user_id = ? AND rom_name = ? AND slot = ?"
  ).run(req.user.uid, rom, Number(slot));
  return res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log("NES API server running on port " + PORT);
});
