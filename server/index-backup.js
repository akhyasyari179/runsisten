
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const STRAVA_TOKEN_FILE = path.join(process.cwd(), "strava-token.json");
const stravaStates = new Map();

async function saveStravaToken(token) {
  await fs.writeFile(
    STRAVA_TOKEN_FILE,
    JSON.stringify(token, null, 2),
    "utf8"
  );
}

async function getStravaToken() {
  let token;

  try {
    const data = await fs.readFile(STRAVA_TOKEN_FILE, "utf8");
    token = JSON.parse(data);
  } catch {
    throw new Error("Strava belum terhubung.");
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
      throw new Error("Gagal memperbarui token Strava.");
    }

    token = refreshed;
    await saveStravaToken(token);
  }

  return token;
}

// Memulai koneksi Strava
app.get("/api/strava/connect", (req, res) => {
  const state = crypto.randomBytes(24).toString("hex");

  stravaStates.set(state, Date.now());

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

// Callback setelah pengguna menyetujui akses
app.get("/api/strava/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).send("Akses Strava ditolak.");
    }

    const stateTime = stravaStates.get(state);

    if (
      !state ||
      !stateTime ||
      Date.now() - stateTime > 10 * 60 * 1000
    ) {
      return res.status(400).send("State OAuth tidak valid atau kedaluwarsa.");
    }

    stravaStates.delete(state);

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

    if (!response.ok) {
      console.error("Strava token error:", token);
      throw new Error("Gagal mendapatkan token Strava.");
    }

    await saveStravaToken(token);

    res.redirect(
      `${process.env.FRONTEND_URL}/?strava=connected`
    );
  } catch (error) {
    console.error("Strava callback error:", error);
    res.status(500).send("Gagal menghubungkan akun Strava.");
  }
});

// Mengambil aktivitas dari Strava
app.get("/api/strava/activities", async (req, res) => {
  try {
    const token = await getStravaToken();

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
      console.error("Strava activities error:", activities);
      throw new Error("Gagal mengambil aktivitas Strava.");
    }

    res.json(activities);
  } catch (error) {
    res.status(401).json({
      error: error.message,
    });
  }
});

app.post("/api/chat/ollama", async (req, res) => {
  try {
    const { message, profile, mode } = req.body;
    console.log("========== CEK JADWAL ==========");
console.log("Mode diterima:", mode);
console.log("Format JSON aktif:", mode === "training_plan");
console.log("================================");

    if (!message) {
      return res.status(400).json({
        error: "Pesan tidak boleh kosong.",
      });
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
app.listen(PORT, () => {
  console.log(`Backend RunSisten berjalan di http://localhost:${PORT}`);
});