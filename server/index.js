
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import db from "./database.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));

app.use(express.json({ limit: "6mb" }));

const PORT = process.env.PORT || 3000;
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

function createSession(userId, res) {
  const sessionToken = crypto.randomBytes(32).toString("hex");

  const sessionId = crypto
    .createHash("sha256")
    .update(sessionToken)
    .digest("hex");

  const expiresAt = Date.now() + SESSION_DURATION;

  db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(sessionId, userId, expiresAt);

  res.setHeader(
    "Set-Cookie",
    `runsisten_session=${sessionToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DURATION / 1000}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );
}

function requireAuth(req, res, next) {
  const cookieHeader = req.headers.cookie || "";

  const sessionCookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("runsisten_session="));

  if (!sessionCookie) {
    return res.status(401).json({
      error: "Silakan login terlebih dahulu.",
    });
  }

  const token = sessionCookie.slice("runsisten_session=".length);

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(401).json({
      error: "Sesi login tidak valid.",
    });
  }

  const sessionId = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const session = db.prepare(`
    SELECT sessions.user_id, users.name, users.email
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ? AND sessions.expires_at > ?
  `).get(sessionId, Date.now());

  if (!session) {
    return res.status(401).json({
      error: "Sesi login tidak valid atau kedaluwarsa.",
    });
  }

  req.user = {
    id: session.user_id,
    name: session.name,
    email: session.email,
  };

  next();
}
// =====================================
// AUTENTIKASI PENGGUNA RUNSISTEN
// =====================================

// Daftar akun baru
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Nama, email, dan password wajib diisi.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password minimal 8 karakter.",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail.includes("@")) {
      return res.status(400).json({
        error: "Nama atau email tidak valid.",
      });
    }

    const existingUser = db.prepare(
      "SELECT id FROM users WHERE email = ?"
    ).get(cleanEmail);

    if (existingUser) {
      return res.status(409).json({
        error: "Email sudah terdaftar.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `).run(cleanName, cleanEmail, passwordHash);

    createSession(result.lastInsertRowid, res);

    res.status(201).json({
      success: true,
      user: {
        id: result.lastInsertRowid,
        name: cleanName,
        email: cleanEmail,
      },
    });
  } catch (error) {
    console.error("Register error:", error);

    res.status(500).json({
      error: "Gagal membuat akun.",
    });
  }
});


// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email dan password wajib diisi.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = db.prepare(`
      SELECT id, name, email, password_hash
      FROM users
      WHERE email = ?
    `).get(cleanEmail);

    if (!user) {
      return res.status(401).json({
        error: "Email atau password salah.",
      });
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordValid) {
      return res.status(401).json({
        error: "Email atau password salah.",
      });
    }

    createSession(user.id, res);

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      error: "Gagal login.",
    });
  }
});


// Periksa sesi login yang sedang aktif
app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});


// Logout
app.post("/api/auth/logout", (req, res) => {
  const cookieHeader = req.headers.cookie || "";

  const sessionCookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("runsisten_session="));

  if (sessionCookie) {
    const token = sessionCookie.slice(
      "runsisten_session=".length
    );

    if (/^[a-f0-9]{64}$/i.test(token)) {
      const sessionId = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      db.prepare(
        "DELETE FROM sessions WHERE id = ?"
      ).run(sessionId);
    }
  }

  res.setHeader(
    "Set-Cookie",
    `runsisten_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );

  res.json({
    success: true,
    message: "Berhasil logout.",
  });
});

// =====================================
// RIWAYAT LARI PER PENGGUNA
// =====================================

// Mengambil riwayat lari milik pengguna yang login
app.get("/api/runs", requireAuth, (req, res) => {
  try {
    const records = db.prepare(`
      SELECT
        id,
        source_id AS sourceId,
        date,
        distance,
        duration,
        pace,
        notes,
        source
      FROM run_records
      WHERE user_id = ?
      ORDER BY date DESC, id DESC
    `).all(req.user.id);

    res.json(records);
  } catch (error) {
    console.error("Get runs error:", error);
    res.status(500).json({
      error: "Gagal mengambil riwayat lari.",
    });
  }
});


// Menambahkan catatan lari
app.post("/api/runs", requireAuth, (req, res) => {
  try {
    const {
      date,
      distance,
      duration,
      notes,
      source = "manual",
      source_id = null,
    } = req.body;

    const validDate =
      typeof date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      !Number.isNaN(new Date(`${date}T00:00:00`).getTime());

    const validDistance =
      Number.isFinite(Number(distance)) && Number(distance) > 0;

    const validDuration =
      Number.isFinite(Number(duration)) && Number(duration) > 0;

    if (!validDate || !validDistance || !validDuration) {
      return res.status(400).json({
        error: "Tanggal, jarak, atau durasi tidak valid.",
      });
    }

    if (!["manual", "strava"].includes(source)) {
      return res.status(400).json({
        error: "Sumber catatan tidak valid.",
      });
    }

    if (source === "strava" && !source_id) {
      return res.status(400).json({
        error: "ID aktivitas Strava wajib tersedia.",
      });
    }

    const cleanNotes = String(notes || "").slice(0, 1000);
    const cleanDistance = Number(distance);
    const cleanDuration = Number(duration);
    const pace = cleanDuration / cleanDistance;

    let recordId;

    if (source === "strava") {
      db.prepare(`
        INSERT INTO run_records (
          user_id, source_id, date, distance,
          duration, pace, notes, source
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, source, source_id)
        DO UPDATE SET
          date = excluded.date,
          distance = excluded.distance,
          duration = excluded.duration,
          pace = excluded.pace,
          notes = excluded.notes
      `).run(
        req.user.id,
        String(source_id),
        date,
        cleanDistance,
        cleanDuration,
        pace,
        cleanNotes,
        source
      );

      const saved = db.prepare(`
        SELECT id FROM run_records
        WHERE user_id = ? AND source = ? AND source_id = ?
      `).get(req.user.id, source, String(source_id));

      recordId = saved.id;
    } else {
      const result = db.prepare(`
        INSERT INTO run_records (
          user_id, date, distance,
          duration, pace, notes, source
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.user.id,
        date,
        cleanDistance,
        cleanDuration,
        pace,
        cleanNotes,
        source
      );

      recordId = Number(result.lastInsertRowid);
    }

    const record = db.prepare(`
      SELECT
        id,
        source_id AS sourceId,
        date,
        distance,
        duration,
        pace,
        notes,
        source
      FROM run_records
      WHERE id = ? AND user_id = ?
    `).get(recordId, req.user.id);

    res.status(201).json({
      success: true,
      record,
    });
  } catch (error) {
    console.error("Save run error:", error);
    res.status(500).json({
      error: "Gagal menyimpan catatan lari.",
    });
  }
});


// Mengubah catatan lari milik pengguna
app.put("/api/runs/:id", requireAuth, (req, res) => {
  try {
    const id = Number(req.params.id);
    const { date, distance, duration, notes } = req.body;

    const validDate =
      typeof date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      !Number.isNaN(new Date(`${date}T00:00:00`).getTime());

    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      !validDate ||
      !Number.isFinite(Number(distance)) ||
      Number(distance) <= 0 ||
      !Number.isFinite(Number(duration)) ||
      Number(duration) <= 0
    ) {
      return res.status(400).json({
        error: "Data catatan lari tidak valid.",
      });
    }

    const result = db.prepare(`
      UPDATE run_records
      SET date = ?,
          distance = ?,
          duration = ?,
          pace = ?,
          notes = ?
      WHERE id = ? AND user_id = ? AND source = 'manual'
    `).run(
      date,
      Number(distance),
      Number(duration),
      Number(duration) / Number(distance),
      String(notes || "").slice(0, 1000),
      id,
      req.user.id
    );

    if (result.changes === 0) {
      return res.status(404).json({
        error: "Catatan tidak ditemukan atau tidak dapat diubah.",
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Update run error:", error);
    res.status(500).json({
      error: "Gagal memperbarui catatan lari.",
    });
  }
});


// Menghapus catatan lari milik pengguna
app.delete("/api/runs/:id", requireAuth, (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "ID catatan tidak valid.",
      });
    }

    const result = db.prepare(`
      DELETE FROM run_records
      WHERE id = ? AND user_id = ?
    `).run(id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({
        error: "Catatan lari tidak ditemukan.",
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Delete run error:", error);
    res.status(500).json({
      error: "Gagal menghapus catatan lari.",
    });
  }
});

 // =====================================
 // PROFIL PENGGUNA PER AKUN
 // =====================================

// Mengambil profil pengguna yang sedang login
app.get("/api/profile", requireAuth, (req, res) => {
  try {
    const profile = db.prepare(`
      SELECT
        users.name,
        user_profiles.age,
        user_profiles.gender,
        user_profiles.weight,
        user_profiles.height,
        user_profiles.experience,
        user_profiles.target,
        user_profiles.photo
      FROM users
      LEFT JOIN user_profiles
        ON user_profiles.user_id = users.id
      WHERE users.id = ?
    `).get(req.user.id);

    res.json({
      success: true,
      profile: {
        name: profile.name,
        age: profile.age ?? "",
        gender: profile.gender ?? "",
        weight: profile.weight ?? "",
        height: profile.height ?? "",
        experience: profile.experience ?? "",
        target: profile.target ?? "",
        photo: profile.photo ?? ""
      }
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      error: "Gagal mengambil profil pengguna."
    });
  }
});

// Menyimpan perubahan profil pengguna
app.put("/api/profile", requireAuth, (req, res) => {
  try {
    const {
      name,
      age,
      gender,
      weight,
      height,
      experience,
      target,
      photo
    } = req.body;

    const cleanName = String(name || "").trim();

    if (!cleanName) {
      return res.status(400).json({
        error: "Nama tidak boleh kosong."
      });
    }

    if (photo != null && (
      typeof photo !== "string" ||
      photo.length > 5_000_000
    )) {
      return res.status(400).json({
        error: "Ukuran foto terlalu besar atau format tidak valid."
      });
    }

    const saveProfile = db.transaction(() => {
      db.prepare(`
        UPDATE users
        SET name = ?
        WHERE id = ?
      `).run(cleanName, req.user.id);

      db.prepare(`
        INSERT INTO user_profiles (
          user_id, age, gender, weight, height,
          experience, target, photo, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id)
        DO UPDATE SET
          age = excluded.age,
          gender = excluded.gender,
          weight = excluded.weight,
          height = excluded.height,
          experience = excluded.experience,
          target = excluded.target,
          photo = excluded.photo,
          updated_at = CURRENT_TIMESTAMP
      `).run(
        req.user.id,
        age === "" || age == null ? null : Number(age),
        gender || null,
        weight === "" || weight == null ? null : Number(weight),
        height === "" || height == null ? null : Number(height),
        experience || null,
        target || null,
        photo ?? null
      );
    });

    saveProfile();

    res.json({
      success: true,
      message: "Profil berhasil disimpan."
    });
  } catch (error) {
    console.error("Save profile error:", error);
    res.status(500).json({
      error: "Gagal menyimpan profil pengguna."
    });
  }
  });

// =====================================
// TRAINING PLAN PER PENGGUNA
// =====================================


// MENGAMBIL TRAINING PLAN
app.get("/api/training-plan", requireAuth, (req, res) => {
  try {
    const plan = db.prepare(`
      SELECT id, plan_data, training_info, created_at
      FROM training_plans
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `).get(req.user.id);

    if (!plan) {
      return res.json({ success: true, plan: null });
    }

    res.json({
      success: true,
      plan: {
        data: JSON.parse(plan.plan_data),
        trainingInfo: JSON.parse(plan.training_info),
        createdAt: plan.created_at
      }
    });
  } catch (error) {
    console.error("Get training plan error:", error);
    res.status(500).json({
      error: "Gagal mengambil training plan."
    });
  }
});

// MENYIMPAN TRAINING PLAN
app.post("/api/training-plan", requireAuth, (req, res) => {
  try {
    const { data, trainingInfo, createdAt } = req.body;

    if (
      !data ||
      data.type !== "training_plan" ||
      !Array.isArray(data.schedule) ||
      data.schedule.length !== 7
    ) {
      return res.status(400).json({
        error: "Format training plan tidak valid."
      });
    }

    const savePlan = db.transaction(() => {
      db.prepare(`
        DELETE FROM training_progress WHERE user_id = ?
      `).run(req.user.id);

      db.prepare(`
        DELETE FROM training_plans WHERE user_id = ?
      `).run(req.user.id);

      db.prepare(`
        INSERT INTO training_plans
          (user_id, plan_data, training_info, created_at)
        VALUES (?, ?, ?, ?)
      `).run(
        req.user.id,
        JSON.stringify(data),
        JSON.stringify(trainingInfo || {}),
        createdAt || new Date().toISOString()
      );
    });

    savePlan();

    res.json({
      success: true,
      message: "Training plan berhasil disimpan."
    });
  } catch (error) {
    console.error("Save training plan error:", error);
    res.status(500).json({
      error: "Gagal menyimpan training plan."
    });
  }
});

// MENGAMBIL PROGRES LATIHAN
app.get("/api/training-progress", requireAuth, (req, res) => {
  try {
    const plan = db.prepare(`
      SELECT id FROM training_plans
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `).get(req.user.id);

    if (!plan) {
      return res.json({ success: true, progress: {} });
    }

    const rows = db.prepare(`
      SELECT day, completed
      FROM training_progress
      WHERE user_id = ? AND plan_id = ?
    `).all(req.user.id, plan.id);

    const progress = {};
    rows.forEach(row => {
      progress[row.day] = Boolean(row.completed);
    });

    res.json({ success: true, progress });
  } catch (error) {
    console.error("Get training progress error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil progres latihan."
    });
  }
});

// MENYIMPAN PROGRES LATIHAN
app.post("/api/training-progress", requireAuth, (req, res) => {
  try {
    const { day, completed } = req.body;

    if (!day || typeof completed !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Data progres tidak valid."
      });
    }

    const plan = db.prepare(`
      SELECT id FROM training_plans
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `).get(req.user.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Training plan belum tersedia."
      });
    }

    db.prepare(`
      INSERT INTO training_progress
        (user_id, plan_id, day, completed, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, plan_id, day)
      DO UPDATE SET
        completed = excluded.completed,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      req.user.id,
      plan.id,
      day,
      completed ? 1 : 0
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Save training progress error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal menyimpan progres latihan."
    });
  }
});

// =====================================
// INTEGRASI STRAVA PER PENGGUNA
// =====================================

const stravaStates = new Map();

// Mengambil token Strava milik pengguna yang sedang login
async function getStravaToken(userId) {
  let token = db.prepare(`
    SELECT athlete_id, access_token, refresh_token, expires_at
    FROM strava_tokens
    WHERE user_id = ?
  `).get(userId);

  if (!token) {
    throw new Error("Akun Strava belum terhubung.");
  }

  // Refresh token jika hampir kedaluwarsa
  if (token.expires_at <= Math.floor(Date.now() / 1000) + 60) {
    const response = await fetch(
      "https://www.strava.com/api/v3/oauth/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: token.refresh_token,
        }),
      }
    );

    const refreshed = await response.json();

    if (!response.ok) {
      console.error("Strava refresh gagal:", response.status);
      throw new Error("Gagal memperbarui koneksi Strava. Silakan hubungkan ulang.");
    }

    db.prepare(`
      UPDATE strava_tokens
      SET access_token = ?,
          refresh_token = ?,
          expires_at = ?
      WHERE user_id = ?
    `).run(
      refreshed.access_token,
      refreshed.refresh_token,
      refreshed.expires_at,
      userId
    );

    token = {
      ...token,
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: refreshed.expires_at,
    };
  }

  return token;
}
// Memeriksa status koneksi Strava akun yang login
app.get("/api/strava/status", requireAuth, (req, res) => {
  const token = db.prepare(`
    SELECT athlete_id
    FROM strava_tokens
    WHERE user_id = ?
  `).get(req.user.id);

  res.json({
    connected: Boolean(token),
    athleteId: token?.athlete_id || null,
  });
});
// Memulai koneksi Strava — wajib login
app.get("/api/strava/connect", requireAuth, (req, res) => {
  const state = crypto.randomBytes(32).toString("hex");

  stravaStates.set(state, {
    userId: req.user.id,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    redirect_uri: process.env.STRAVA_REDIRECT_URI,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
    state,
  });

  res.redirect(
    `https://www.strava.com/oauth/authorize?${params.toString()}`
  );
});

// Callback OAuth — wajib login dan cocok dengan pemilik state
app.get("/api/strava/callback", requireAuth, async (req, res) => {
  try {
    const { code, state, error } = req.query;

    const savedState = stravaStates.get(state);

    if (
      typeof state !== "string" ||
      !savedState ||
      savedState.userId !== req.user.id ||
      savedState.expiresAt < Date.now()
    ) {
      return res.status(400).send(
        "Proses koneksi Strava tidak valid atau kedaluwarsa. Silakan coba lagi."
      );
    }

    stravaStates.delete(state);

    if (error || !code) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/?strava=error`
      );
    }

    const response = await fetch(
      "https://www.strava.com/api/v3/oauth/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
        }),
      }
    );

    const token = await response.json();

    if (
      !response.ok ||
      !token.access_token ||
      !token.refresh_token ||
      !token.expires_at
    ) {
      console.error("Strava authorization gagal:", response.status);
      throw new Error("Gagal mendapatkan token Strava.");
    }

    db.prepare(`
      INSERT INTO strava_tokens (
        user_id,
        athlete_id,
        access_token,
        refresh_token,
        expires_at
      )
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id)
      DO UPDATE SET
        athlete_id = excluded.athlete_id,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at
    `).run(
      req.user.id,
      token.athlete?.id ? String(token.athlete.id) : null,
      token.access_token,
      token.refresh_token,
      token.expires_at
    );

    res.redirect(
      `${process.env.FRONTEND_URL}/?strava=connected`
    );
  } catch (error) {
    console.error("Strava callback error:", error.message);

    res.status(500).send(
      "Gagal menghubungkan akun Strava."
    );
  }
});

// Mengambil aktivitas hanya dari Strava milik pengguna yang login
app.get("/api/strava/activities", requireAuth, async (req, res) => {
  try {
    const token = await getStravaToken(req.user.id);

    const response = await fetch(
      "https://www.strava.com/api/v3/athlete/activities?per_page=100",
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
        },
      }
    );

    const activities = await response.json();

    if (!response.ok) {
      console.error("Strava activities gagal:", response.status);
      throw new Error("Gagal mengambil aktivitas Strava.");
    }

    res.json(activities);
  } catch (error) {
    res.status(401).json({
      error: error.message || "Gagal mengambil aktivitas Strava.",
    });
  }
});

app.post("/api/chat/ollama", requireAuth, async (req, res) => {
  console.log("🔥 ENDPOINT CHAT OLLAMA TERPANGGIL");
  try {
    const { message, profile, mode } = req.body;

    // Ambil ringkasan catatan lari milik akun yang sedang login
    const runSummary = db.prepare(`
      SELECT
        COUNT(*) AS totalRuns,
        COALESCE(SUM(distance), 0) AS totalDistance,
        COALESCE(SUM(duration), 0) AS totalDuration,
        COALESCE(AVG(pace), 0) AS averagePace,
        COALESCE(MAX(distance), 0) AS longestRun
      FROM run_records
      WHERE user_id = ?
    `).get(req.user.id);

    // Ambil 20 aktivitas terbaru
    const recentRuns = db.prepare(`
      SELECT date, distance, duration, pace, notes, source
      FROM run_records
      WHERE user_id = ?
      ORDER BY date DESC, id DESC
      LIMIT 20
    `).all(req.user.id);
    console.log("========== DATA LARI COACH WATI ==========");
console.log("User ID:", req.user.id);
console.log("Ringkasan:", runSummary);
console.log("Aktivitas terbaru:", recentRuns.length);
console.log("==========================================");

    const runContext = `
DATA CATATAN LARI PENGGUNA:

Ringkasan seluruh aktivitas:
${JSON.stringify(runSummary, null, 2)}
DATA FAKTA PENGGUNA (WAJIB DIPERCAYA):
Total aktivitas lari: ${runSummary.totalRuns} kali.
Total jarak seluruh aktivitas: ${runSummary.totalDistance} km.
Total durasi: ${runSummary.totalDuration} menit.
Jarak lari terjauh: ${runSummary.longestRun} km.

JAWABAN WAJIB:
Jika pengguna bertanya total jarak lari,
jawab ${runSummary.totalDistance} km.
Jika pengguna bertanya jumlah aktivitas,
jawab ${runSummary.totalRuns} kali.
Jika pengguna bertanya jarak terjauh,
jawab ${runSummary.longestRun} km.

Kamu memiliki akses ke ringkasan data lari di atas
karena backend aplikasi telah mengambilnya dari database.
Jangan pernah mengatakan tidak memiliki akses database.
Jangan meminta pengguna mengekspor atau memasukkan
ulang data yang sudah tersedia.

20 aktivitas terbaru:
${JSON.stringify(recentRuns, null, 2)}

ATURAN WAJIB PENGGUNAAN CATATAN LARI:
- DATA CATATAN LARI DI ATAS ADALAH SUMBER DATA UTAMA.
- Kamu WAJIB menggunakan totalDistance untuk menjawab
  pertanyaan tentang total jarak lari.
- Kamu WAJIB menggunakan totalRuns untuk menjawab
  jumlah aktivitas lari.
- Kamu WAJIB menggunakan longestRun untuk menjawab
  jarak terjauh.
- Jangan meminta pengguna memasukkan ulang data yang
  sudah tersedia.
- Jangan mengganti data database dengan asumsi atau
  informasi dari percakapan.
- Jangan mengarang aktivitas atau jarak lari.
- Jika totalDistance tersedia, langsung jawab angkanya.
- Jika pengguna bertanya total jarak, jangan hanya
  menggunakan 20 aktivitas terbaru.
- Gunakan satuan kilometer dan menit.
`;
    console.log("========== CEK JADWAL ==========");
console.log("Mode diterima:", mode);
console.log("Format JSON aktif:", mode === "training_plan");
console.log("================================");

    if (!message) {
      return res.status(400).json({
        error: "Pesan tidak boleh kosong.",
      });
    }

// Jawab pertanyaan statistik langsung dari database
const question = message.toLowerCase();

const asksLongestRun =
  /terjauh|paling jauh|jarak terpanjang/.test(question);

const asksRunCount =
  /berapa (kali|banyak|jumlah)|jumlah (lari|aktivitas)|total aktivitas/.test(question);

const asksTotalDistance =
  /total jarak|berapa jarak|jarak lari|jarak yang sudah|jarak yang telah|akumulasi jarak/.test(question);

if (asksLongestRun || asksRunCount || asksTotalDistance) {
  const totalDistance = Number(runSummary.totalDistance)
    .toLocaleString("id-ID", { maximumFractionDigits: 2 });

  const totalRuns = runSummary.totalRuns;

  const longestRun = Number(runSummary.longestRun)
    .toLocaleString("id-ID", { maximumFractionDigits: 2 });

  let answer = "";

  if (asksLongestRun) {
    answer = `Jarak lari terjauh Anda adalah ${longestRun} km.`;
  } else if (asksRunCount) {
    answer = `Anda memiliki ${totalRuns} aktivitas lari yang tercatat.`;
  } else {
    answer = `Total jarak lari Anda adalah ${totalDistance} km dari ${totalRuns} aktivitas yang tercatat. Jarak terjauh Anda adalah ${longestRun} km.`;
  }

  console.log("Jawaban statistik langsung dari database:", answer);

  return res.status(200).type("text/plain").send(answer);
}

    console.log("Menghubungi Ollama...");
    console.log("Model: qwen2.5:3b");
    console.log("Waktu mulai:", new Date().toLocaleTimeString());

const now = new Date();

const currentDateTime = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
}).format(now);

const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

const tomorrowDate = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
}).format(tomorrow);

const timeContext = `
WAKTU AKTUAL INDONESIA (WIB):
Hari dan tanggal sekarang: ${currentDateTime}
Hari dan tanggal besok: ${tomorrowDate}

ATURAN WAKTU:
- Informasi waktu di atas berasal dari backend dan merupakan acuan resmi.
- Jangan menghitung ulang atau menebak hari dan tanggal.
- Jika ditanya hari ini, gunakan informasi hari dan tanggal sekarang.
- Jika ditanya besok, gunakan informasi hari dan tanggal besok.
- Jangan membuat jadwal latihan jika pengguna hanya bertanya tentang waktu.
- Jangan menyarankan jam latihan yang sudah lewat.
- Jangan menyebut pukul 17.30 sebagai pukul 5.30 pagi.
`;

const scheduleInstruction = mode === "training_plan"
  ? `
Kamu wajib menghasilkan jadwal latihan mingguan dalam format JSON.

ATURAN WAJIB:
1. Properti "schedule" HARUS berisi tepat 7 objek.
2. Setiap hari harus dicantumkan satu kali, berurutan:
   Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu.
3. Jangan pernah menghilangkan hari meskipun tidak ada latihan.
4. Setiap hari wajib memiliki properti:
   day, time, status, workoutType, activities, notes.
5. Gunakan status berikut:
   - "training": hari latihan.
   - "recovery": hari pemulihan aktif.
   - "rest": hari istirahat total.
6. Hari recovery dan rest tetap harus dicantumkan.
7. Untuk hari recovery, jelaskan aktivitas pemulihan.
8. Untuk hari rest, activities boleh berupa array kosong.
9. Sesuaikan jumlah hari training dengan permintaan pengguna.
10. Jangan menambahkan hari latihan hanya untuk memenuhi jumlah tujuh hari.


FORMAT JSON WAJIB:

{
  "type": "training_plan",
  "title": "Jadwal Latihan Mingguan",
  "schedule": [
    {
  "day": "Senin",
  "status": "training",
  "workoutType": "Easy Run",
  "workout": "Easy Run 3 KM"
    },
      {
  "day": "Selasa",
  "status": "rest",
  "workoutType": "Rest",
  "workout": "Istirahat"
}
  ]
}

ATURAN:
- Tampilkan hanya menu latihan inti.
- Jangan menampilkan rincian pemanasan.
- Jangan menampilkan rincian pendinginan.
- Jangan menampilkan daftar gerakan.
- Gunakan workout untuk menjelaskan latihan utama secara singkat.
- Contoh: Easy Run 3 KM, Interval 4 x 800 M,
  Tempo Run 20 Menit, Long Run 8 KM.
- Sesuaikan menu dengan kemampuan dan target pengguna.
- Jangan memberikan latihan yang terlalu berat untuk pemula.
- Tetap sertakan tujuh hari dari Senin sampai Minggu.
- Hari istirahat tetap dicantumkan.
- Keluarkan JSON saja.

CONTOH DI ATAS HANYA SATU OBJEK.
HASIL AKHIR WAJIB MEMILIKI TUJUH OBJEK HARI.
Keluarkan JSON saja, tanpa Markdown atau penjelasan tambahan.
ATURAN STRUKTUR HARI:
- Buat tepat 7 objek di dalam array schedule.
- Objek pertama wajib Senin.
- Objek kedua wajib Selasa.
- Objek ketiga wajib Rabu.
- Objek keempat wajib Kamis.
- Objek kelima wajib Jumat.
- Objek keenam wajib Sabtu.
- Objek ketujuh wajib Minggu.
- Setiap nama hari hanya boleh muncul satu kali.
- Dilarang mengulang hari Minggu atau hari lainnya.
- Jangan mengurutkan berdasarkan waktu latihan.
- Hari tanpa latihan tetap harus dicantumkan dengan status recovery atau rest.
`
  : "";

    const response = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  model: "qwen2.5:3b",
  stream: true,
  ...(mode === "training_plan" ? { format: "json" } : {}),
        messages: [
          {
            role: "system",
            content: `

Kamu adalah Coach Wati, AI personal running coach untuk aplikasi RunSisten.
${timeContext}
${scheduleInstruction}

IDENTITAS DAN KEPRIBADIAN:
- Kamu adalah pelatih lari virtual yang ramah, hangat, suportif, teliti, dan profesional.
- Gunakan bahasa Indonesia yang natural, santai, dan mudah dipahami.
- Panggil pengguna secara natural. Jangan mengarang nama atau sapaan khusus.
- Jangan menghakimi kemampuan, kondisi, atau progres pengguna.

PROFIL PENGGUNA:
Berikut data profil pengguna yang tersedia:
${JSON.stringify(profile || {}, null, 2)}
${runContext}
ATURAN PRIORITAS DATA:
Jika pengguna bertanya tentang riwayat lari,
gunakan DATA CATATAN LARI PENGGUNA dari database.
Jangan menyatakan data tidak tersedia jika ringkasan
database sudah berisi angka.
Jangan mengarang data aktivitas baru.

ATURAN PENGGUNAAN PROFIL:
- Gunakan hanya informasi yang benar-benar tersedia dalam profil.
- Jangan mengarang usia, berat badan, tinggi badan, pengalaman lari, kondisi kesehatan, target, atau riwayat latihan.
- Jika informasi penting belum tersedia, tanyakan terlebih dahulu.
- Bedakan informasi yang diberikan pengguna dengan asumsi atau rekomendasi darimu.

ATURAN KONSISTENSI:
- Perhatikan seluruh angka, durasi, frekuensi, dan target dalam jawabanmu.
- Jangan memberikan instruksi yang saling bertentangan.
- Bedakan durasi setiap sesi dengan jumlah sesi per minggu.
- Contoh yang benar: latihan 15 menit per sesi, dua kali seminggu.
- Jangan mengatakan latihan setiap hari jika sebenarnya merekomendasikan dua kali seminggu.
- Jika pengguna bertanya tentang jawaban sebelumnya, pertahankan konteks yang tersedia dan jangan mengubah rekomendasi tanpa alasan.
- Jangan mengarang target Half Marathon, Marathon, atau target lainnya jika pengguna belum menyebutkannya.

PANDUAN LATIHAN PEMULA:
- Untuk pemula, prioritaskan adaptasi tubuh secara bertahap.
- Sarankan kombinasi jalan kaki dan lari ringan jika sesuai.
- Berikan waktu pemulihan di antara sesi latihan.
- Jangan menganjurkan peningkatan jarak, durasi, atau intensitas secara mendadak.
- Sesuaikan latihan dengan kemampuan dan pengalaman pengguna.
- Jangan menganggap semua pengguna mampu berlari dengan durasi yang sama.

KEAMANAN DAN PEMULIHAN:
- Utamakan kesehatan pengguna dibanding pencapaian target.
- Jangan mendorong pengguna berlatih ketika sedang sakit atau mengalami nyeri.
- Jika pengguna mengalami nyeri tajam, sesak napas tidak biasa, pusing berat, atau nyeri dada, sarankan menghentikan latihan dan mencari pertolongan medis sesuai tingkat kegawatannya.
- Ingatkan pentingnya tidur, hidrasi, pemanasan, pendinginan, dan pemulihan.
- Jangan mendiagnosis penyakit atau mengaku sebagai dokter.
- Jangan menjamin bahwa suatu program latihan bebas cedera.

CARA MENJAWAB:
- Jawab langsung sesuai pertanyaan pengguna.
- Untuk pertanyaan sederhana, gunakan sekitar 2–5 kalimat.
- Untuk program latihan, gunakan daftar yang terstruktur.
- Pastikan semua angka dan frekuensi latihan konsisten.
- Jangan memberikan terlalu banyak informasi yang tidak diminta.
- Jika informasi penting belum tersedia, ajukan satu pertanyaan yang paling relevan.
- Jangan membuat klaim tentang data pengguna yang tidak tersedia.

TUJUAN UTAMA:
Bantu pengguna membangun kebiasaan berlari yang sehat, aman, realistis, dan berkelanjutan.

ATURAN WAJIB PEMBUATAN JADWAL LATIHAN:

1. Untuk pengguna yang benar-benar pemula dan belum pernah berlari:
   - Mulai dengan 2-3 sesi latihan lari per minggu.
   - Berikan hari pemulihan di antara sesi lari.
   - Jangan menjadwalkan lari setiap hari.
   - Jangan memberikan dua sesi lari dalam satu hari.
   - Jangan meningkatkan durasi latihan secara agresif.

2. Setiap sesi latihan harus memiliki:
   - Pemanasan selama 5 menit.
   - Sesi utama berupa kombinasi jalan kaki dan lari ringan.
   - Pendinginan selama 5 menit.

3. Saat membuat jadwal:
   - Tampilkan jadwal Senin sampai Minggu.
   - Tandai hari latihan dan hari istirahat dengan jelas.
   - Bedakan durasi setiap sesi dan jumlah sesi per minggu.
   - Pastikan total durasi setiap sesi dihitung dengan benar.
   - Jangan memberikan instruksi yang saling bertentangan.
   - Periksa kembali jadwal sebelum memberikan jawaban.

4. Jangan membuat jadwal yang sama untuk semua pengguna.
   Sesuaikan dengan pengalaman, kemampuan, tujuan, dan kondisi pengguna.

ATURAN PENILAIAN KESIAPAN HALF MARATHON:

Jangan langsung menyatakan pengguna siap mengikuti Half Marathon tanpa informasi yang cukup.

Pertimbangkan informasi berikut:
- Lama pengalaman berlari.
- Frekuensi latihan setiap minggu.
- Jarak terjauh yang pernah ditempuh.
- Pengalaman mengikuti lomba sebelumnya.
- Kondisi fisik dan riwayat cedera yang relevan.

Jika informasi belum tersedia, tanyakan terlebih dahulu.
Jangan mengarang data atau menyimpulkan kesiapan pengguna tanpa dasar.
INFORMASI WAKTU SAAT INI:
${currentDateTime}

ATURAN TANGGAL DAN HARI:
- Gunakan informasi waktu aktual di atas sebagai acuan utama.
- Jangan menebak hari, tanggal, atau bulan.
- Jika pengguna mengatakan besok, hitung satu hari setelah tanggal saat ini.
- Jika pengguna mengatakan kemarin, hitung satu hari sebelum tanggal saat ini.
- Pastikan nama hari sesuai dengan tanggal kalender.
- Jangan mengarang jadwal latihan yang belum pernah dibuat.
- Jangan menganggap pengguna sudah memiliki riwayat latihan jika datanya tidak tersedia.
- Jika jadwal latihan belum tersedia, tanyakan terlebih dahulu.
- Jika pengguna mengoreksi kesalahan tanggal atau hari, akui kesalahan dan gunakan informasi waktu yang benar.
ATURAN PEMANASAN, SESI UTAMA, DAN PENDINGINAN:

1. Pemanasan harus berupa gerakan ringan selama 5 menit, seperti:
   - Jalan kaki santai 2 menit.
   - Jalan di tempat 1 menit.
   - Putaran bahu dan ayunan lengan 1 menit.
   - Gerakan mobilisasi pergelangan kaki dan pinggul 1 menit.

2. Untuk pemula, sesi utama boleh menggunakan metode jalan-lari bergantian. Contoh:
   - Lari sangat ringan 1 menit.
   - Jalan kaki 2 menit.
   - Ulangi sesuai total durasi yang tersedia.
   - Pengguna harus tetap bisa berbicara saat berlari.

3. Pendinginan harus berupa jalan kaki perlahan dan peregangan ringan selama 5 menit.

4. DILARANG merekomendasikan burpees, high knees, jumping jacks, sprint, atau gerakan intensitas tinggi sebagai pemanasan maupun pendinginan untuk pemula.

5. Jangan pernah menggunakan nama gerakan yang tidak jelas, hasil terjemahan aneh, atau istilah yang tidak dikenal. Jika tidak yakin dengan nama gerakan, gunakan instruksi sederhana seperti jalan kaki santai atau jalan di tempat.

6. Selalu periksa kembali:
   - Total durasi pemanasan + sesi utama + pendinginan harus sama dengan durasi yang diminta.
   - Gerakan sesuai tingkat kemampuan pengguna.
   - Tidak ada gerakan intensitas tinggi pada pemanasan atau pendinginan.
   - Setiap instruksi mudah dipahami dan dapat dilakukan dengan aman.
`,
          },
          {
            role: "user",
            content: message,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(errorData);
    }

// Mengaktifkan streaming ke frontend
res.status(200);
res.setHeader("Content-Type", "text/plain; charset=utf-8");
res.setHeader("Cache-Control", "no-cache, no-transform");
res.setHeader("X-Accel-Buffering", "no");

const reader = response.body.getReader();
const decoder = new TextDecoder();

let buffer = "";
let fullReply = "";

try {
  while (true) {
    const { done, value } = await reader.read();

    // Tambahkan potongan data ke buffer.
    buffer += decoder.decode(value || new Uint8Array(), {
      stream: !done,
    });

    // Proses hanya baris JSON yang sudah lengkap.
    let newlineIndex;

    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (!line) continue;

      const data = JSON.parse(line);
      const text = data.message?.content || "";

      if (text) {
        fullReply += text;
        res.write(text);
      }

      if (data.done) {
        console.log("Ollama selesai memberikan respons.");
        console.log("Waktu selesai:", new Date().toLocaleTimeString());
      }
    }

    if (done) break;
  }

  // Proses sisa buffer jika masih ada.
  if (buffer.trim()) {
    const data = JSON.parse(buffer);
    const text = data.message?.content || "";

    if (text) {
      fullReply += text;
      res.write(text);
    }
  }

  console.log("Total karakter jawaban:", fullReply.length);
  res.end();

} catch (streamError) {
  console.error("Kesalahan streaming:", streamError);

  if (!res.headersSent) {
    res.status(500).json({
      error: "Gagal membaca respons Coach Wati.",
    });
  } else {
    res.end();
  }
}
  } catch (error) {
    console.error("Ollama error:", error);

    res.status(500).json({
      error: "Coach Wati lokal sedang mengalami kendala. Pastikan Ollama berjalan.",
    });
  }
});
  
// =====================================
// RIWAYAT CHAT COACH WATI PER PENGGUNA
// =====================================

// Mengambil riwayat chat akun yang sedang login
app.get("/api/chat/history", requireAuth, (req, res) => {
  try {
    const messages = db.prepare(`
      SELECT role, message AS text, created_at
      FROM chat_messages
      WHERE user_id = ?
      ORDER BY id ASC
    `).all(req.user.id);

    res.json({ success: true, messages });
  } catch (error) {
    console.error("Get chat history error:", error);
    res.status(500).json({ error: "Gagal mengambil riwayat chat." });
  }
});

// Menyimpan satu pesan ke akun yang sedang login
app.post("/api/chat/history", requireAuth, (req, res) => {
  try {
    const { role, message } = req.body;

    if (
      !["user", "assistant"].includes(role) ||
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({ error: "Pesan chat tidak valid." });
    }

    db.prepare(`
      INSERT INTO chat_messages (user_id, role, message)
      VALUES (?, ?, ?)
    `).run(req.user.id, role, message.trim());

    res.json({ success: true });
  } catch (error) {
    console.error("Save chat history error:", error);
    res.status(500).json({ error: "Gagal menyimpan riwayat chat." });
  }
});
app.listen(PORT, () => {
  console.log(`Backend RunSisten berjalan di http://localhost:${PORT}`);
});