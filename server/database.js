
import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.join(process.cwd(), "runsisten.db");

const db = new Database(dbPath);

// Pengaturan keamanan dan konsistensi database
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Tabel akun pengguna
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// Tabel koneksi Strava per pengguna
db.exec(`
  CREATE TABLE IF NOT EXISTS strava_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    athlete_id TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Tabel riwayat lari per pengguna
db.exec(`
  CREATE TABLE IF NOT EXISTS run_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    source_id TEXT,
    date TEXT NOT NULL,
    distance REAL NOT NULL,
    duration REAL NOT NULL,
    pace REAL NOT NULL,
    notes TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id, source, source_id)
  );
`);

// Tabel sesi login pengguna
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Indeks untuk mempercepat pemeriksaan sesi
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id
  ON sessions(user_id);
`);

// =====================================
// PROFIL PENGGUNA PER AKUN
// =====================================
db.exec(`
  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INTEGER PRIMARY KEY,
    age INTEGER,
    gender TEXT,
    weight REAL,
    height REAL,
    experience TEXT,
    target TEXT,
    photo TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// =====================================
// TRAINING PLAN PER PENGGUNA
// =====================================
db.exec(`
  CREATE TABLE IF NOT EXISTS training_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_data TEXT NOT NULL,
    training_info TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// =====================================
// PROGRES LATIHAN PER PENGGUNA
// =====================================
db.exec(`
  CREATE TABLE IF NOT EXISTS training_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES training_plans(id) ON DELETE CASCADE,
    UNIQUE (user_id, plan_id, day)
  );
`);

// =====================================
// RIWAYAT CHAT COACH WATI PER PENGGUNA
// =====================================
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id
  ON chat_messages(user_id, id);
`);

console.log("Database RunSisten siap digunakan.");

export default db;
