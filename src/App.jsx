import { useState, useEffect, useRef } from 'react'
import './App.css'
import {
  Home,
  Bot,
  NotebookPen,
  ChartNoAxesColumnIncreasing,
  CalendarDays,
  UserRound,
  Footprints,
  Flag,
  Clock,
  Zap,
  ClipboardList,
  Sparkles,
  Clock3, 
  Gauge, 
  Link2
} from 'lucide-react';

function App() {
  const [showScrollButton, setShowScrollButton] = useState(false);
  const chatMessagesRef = useRef(null);
  const [activePage, setActivePage] = useState('Beranda');
  const [authPage, setAuthPage] = useState('login')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authUser, setAuthUser] = useState(null)
  const [authChecking, setAuthChecking] = useState(true)

  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
  })

  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  })

  const [authError, setAuthError] = useState('')

  const [profile, setProfile] = useState({
  name: '',
  age: '',
  gender: '',
  weight: '',
  height: '',
  experience: '',
  target: '',
});

const [profilePhoto, setProfilePhoto] = useState('');
  const [trainingInfo, setTrainingInfo] = useState({
    currentDistance: '',
    trainingDays: '',
    difficulty: '',
  })
  const [savedTrainingPlan, setSavedTrainingPlan] = useState(null);
const [trainingProgress, setTrainingProgress] = useState({});
  const [runRecords, setRunRecords] = useState([]);
const [stravaLoading, setStravaLoading] = useState(false);
const [stravaMessage, setStravaMessage] = useState('');
const [stravaConnected, setStravaConnected] = useState(false);
const [stravaStatusLoading, setStravaStatusLoading] = useState(true);
const [progressWeekOffset, setProgressWeekOffset] = useState(0);

const [runForm, setRunForm] = useState({
  date: new Date().toISOString().slice(0, 10),
  distance: '',
  duration: '',
  notes: '',
})
const [showRunForm, setShowRunForm] = useState(false)
const [editingRunId, setEditingRunId] = useState(null);

const account = authUser || {};
useEffect(() => {
  if (!authUser?.id || !isLoggedIn) return;

  const savedPage = localStorage.getItem(
    `runsistenLastPage_${authUser.id}`
  );

  if (savedPage) {
    setActivePage(savedPage);
  }
}, [authUser?.id, isLoggedIn]);

useEffect(() => {
  if (authChecking || !authUser?.id || !isLoggedIn) return;

  localStorage.setItem(
    `runsistenLastPage_${authUser.id}`,
    activePage
  );
}, [activePage, authUser?.id, isLoggedIn, authChecking]);
useEffect(() => {
  if (!authUser?.id || !isLoggedIn) return;

  const savedPage = localStorage.getItem(
    `runsistenLastPage_${authUser.id}`
  );

  if (savedPage) {
    setActivePage(savedPage);
  }
}, [authUser?.id, isLoggedIn]);

useEffect(() => {
  if (!authUser?.id || !isLoggedIn) return;

  localStorage.setItem(
    `runsistenLastPage_${authUser.id}`,
    activePage
  );
}, [activePage, authUser?.id, isLoggedIn]);

// Memuat training plan dan progres dari database
async function loadTrainingData() {
  try {
    const [planResponse, progressResponse] = await Promise.all([
      fetch('http://localhost:3000/api/training-plan', {
        credentials: 'include',
      }),
      fetch('http://localhost:3000/api/training-progress', {
        credentials: 'include',
      }),
    ]);

    if (!planResponse.ok || !progressResponse.ok) {
      throw new Error('Gagal mengambil data latihan');
    }

    const planData = await planResponse.json();
    const progressData = await progressResponse.json();

    const savedPlan = planData.plan || null;

    setSavedTrainingPlan(savedPlan);
    setTrainingProgress(progressData.progress || {});
    setConsultationStarted(Boolean(savedPlan));

    if (savedPlan?.trainingInfo) {
      setTrainingInfo(savedPlan.trainingInfo);
    }

    console.log('Training plan dari database:', savedPlan);
    console.log('Training progress dari database:', progressData.progress);

  } catch (error) {
    console.error('Gagal memuat training data:', error);
  }
}

// Periksa sesi login saat aplikasi dibuka
useEffect(() => {
  let cancelled = false;

  async function checkLoginSession() {
    try {
      const response = await fetch(
        'http://localhost:3000/api/auth/me',
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Belum login');
      }

      const data = await response.json();

      if (!cancelled) {
        setAuthUser(data.user);
        setIsLoggedIn(true);
        const savedPage = localStorage.getItem(
  `runsistenLastPage_${data.user.id}`
);

if (savedPage) {
  setActivePage(savedPage);
}

        setProfile((previous) => ({
          ...previous,
          name: data.user.name,
        }));

        // Muat training plan setelah sesi login ditemukan
        loadTrainingData();
      }
    } catch {
      if (!cancelled) {
        setAuthUser(null);
        setIsLoggedIn(false);
      }
    } finally {
      if (!cancelled) {
        setAuthChecking(false);
      }
    }
  }

  checkLoginSession();

  return () => {
    cancelled = true;
  };
}, []);

// Memuat profil berdasarkan akun yang sedang login
useEffect(() => {
  let cancelled = false;

  async function loadProfile() {
    if (!authUser?.id) {
      setProfile({
        name: '',
        age: '',
        gender: '',
        weight: '',
        height: '',
        experience: '',
        target: '',
      });
      setProfilePhoto('');
      return;
    }

    try {
      const response = await fetch(
        'http://localhost:3000/api/profile',
        {
          credentials: 'include',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal memuat profil.');
      }

      if (!cancelled) {
        setProfile(data.profile);
        setProfilePhoto(data.profile.photo || '');
      }
    } catch (error) {
      console.error('Load profile error:', error);
      if (!cancelled) {
        alert('Profil gagal dimuat: ' + error.message);
      }
    }
  }

  loadProfile();

  return () => {
    cancelled = true;
  };
}, [authUser?.id]);
const totalDistance = runRecords.reduce(
  (total, record) => total + Number(record.distance || 0),
  0
);

const totalRuns = runRecords.length;

const weight = Number(profile.weight);
const heightInMeter = Number(profile.height) / 100;

const bmi =
  weight > 0 && heightInMeter > 0
    ? (weight / (heightInMeter * heightInMeter)).toFixed(1)
    : null;

const profileInitial = profile.name
  ? profile.name.trim().charAt(0).toUpperCase()
  : 'U';


  const [consultationStarted, setConsultationStarted] = useState(
  () => Boolean(savedTrainingPlan)
);
  const [trainingLoading, setTrainingLoading] = useState(false)
const [trainingError, setTrainingError] = useState('')
  


const [chatMessages, setChatMessages] = useState([
  {
    role: 'assistant',
    text: 'Halo! Aku Coach Wati. Ada yang ingin kamu tanyakan tentang lari?',
  },
]);

useEffect(() => {
  if (activePage !== 'Konsultasi AI') return;

  const frame = requestAnimationFrame(() => {
    const chatBox = chatMessagesRef.current;

    if (chatBox) {
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  });

  return () => cancelAnimationFrame(frame);
}, [chatMessages, activePage]);
useEffect(() => {
  const chatBox = chatMessagesRef.current;
  if (!chatBox) return;

  const handleScroll = () => {
    const isAtBottom =
      chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 50;

    setShowScrollButton(!isAtBottom);
  };

  handleScroll();

  chatBox.addEventListener('scroll', handleScroll);

  return () => {
    chatBox.removeEventListener('scroll', handleScroll);
  };
}, [activePage]);

// Ambil riwayat lari berdasarkan akun yang login
useEffect(() => {
  if (!authUser?.id) {
    setRunRecords([]);
    return;
  }

  let cancelled = false;

  async function loadRunRecords() {
    try {
      const response = await fetch(
        'http://localhost:3000/api/runs',
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Gagal mengambil riwayat lari.');
      }

      const records = await response.json();

      if (!cancelled) {
        setRunRecords(records);
      }
    } catch (error) {
      console.error('Gagal memuat riwayat lari:', error);
    }
  }

  loadRunRecords();

  return () => {
    cancelled = true;
  };
}, [authUser?.id]);
// Memuat riwayat chat milik akun yang sedang login
useEffect(() => {
  let cancelled = false;

  async function loadChatHistory() {
    if (!authUser?.id) {
      setChatMessages([
        {
          role: 'assistant',
          text: 'Halo! Aku Coach Wati. Ada yang ingin kamu tanyakan tentang lari?',
        },
      ]);
      return;
    }

    try {
      const response = await fetch(
        'http://localhost:3000/api/chat/history',
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Gagal memuat riwayat chat.');
      }

      const data = await response.json();

      if (!cancelled) {
        const messages = (data.messages || []).map((item) => ({
          role: item.role,
          text: item.text,
        }));

        setChatMessages(
          messages.length
            ? messages
            : [{
                role: 'assistant',
                text: 'Halo! Aku Coach Wati. Ada yang ingin kamu tanyakan tentang lari?',
              }]
        );
      }
    } catch (error) {
      console.error('Gagal memuat riwayat chat:', error);
    }
  }

  loadChatHistory();

  return () => {
    cancelled = true;
  };
}, [authUser?.id]);
// Periksa koneksi Strava milik akun yang login
useEffect(() => {
  if (!authUser?.id) {
    setStravaConnected(false);
    setStravaStatusLoading(false);
    return;
  }

  let cancelled = false;

  async function checkStravaStatus() {
    setStravaStatusLoading(true);

    try {
      const response = await fetch(
        'http://localhost:3000/api/strava/status',
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Gagal memeriksa koneksi Strava.');
      }

      const data = await response.json();

      if (!cancelled) {
        setStravaConnected(data.connected);
      }
    } catch (error) {
      if (!cancelled) {
        setStravaConnected(false);
        console.error(error);
      }
    } finally {
      if (!cancelled) {
        setStravaStatusLoading(false);
      }
    }
  }

  checkStravaStatus();

  return () => {
    cancelled = true;
  };
}, [authUser?.id]);
const [chatInput, setChatInput] = useState('')
const [chatLoading, setChatLoading] = useState(false)

  // FUNGSI MENGUBAH JAWABAN KONSULTASI
  function handleTrainingChange(event) {
    const { name, value } = event.target

    setTrainingInfo({
      ...trainingInfo,
      [name]: value,
    })
  }

  
async function handleTrainingSubmit(event) {
  event.preventDefault()
  setTrainingLoading(true)
setTrainingError('')

  try {
    const prompt = `
Buatkan jadwal latihan lari mingguan yang personal berdasarkan data berikut.

Nama: ${profile.name || 'Pengguna'}
Usia: ${profile.age || 'Tidak diketahui'}
Pengalaman: ${profile.experience || 'Tidak diketahui'}
Target: ${profile.target || 'Menjaga kebugaran'}
Kemampuan lari saat ini: ${trainingInfo.currentDistance}
Hari latihan per minggu: ${trainingInfo.trainingDays}
Kendala: ${trainingInfo.difficulty}

Ketentuan:
- Buat jadwal dari Senin sampai Minggu.
- Sesuaikan jumlah hari latihan dengan ketersediaan pengguna.
- Sertakan pemanasan, latihan utama, dan pendinginan.
- Berikan durasi dan intensitas yang masuk akal untuk pemula atau sesuai kemampuan.
- Sisipkan hari istirahat.
- Pastikan total durasi setiap sesi sesuai dengan rincian aktivitasnya.
- Jangan mengarang riwayat atau kemampuan pengguna.
- Gunakan bahasa Indonesia yang mudah dipahami.
`

    
const response = await fetch('http://localhost:3000/api/chat/ollama', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: prompt,
    profile: {
      name: profile.name,
      age: profile.age,
      experience: profile.experience,
      target: profile.target,
    },
    mode: "training_plan",
  }),
});

    if (!response.ok) {
      throw new Error('Gagal membuat jadwal latihan.')
    }

    const planText = await response.text();

 console.log("RAW JADWAL:", planText);
 console.log("TIPE DATA PLAN:", typeof planText);
 console.log("ISI PLAN SEBELUM PARSE:", planText);

let planData;

try {
  planData = JSON.parse(planText);
} catch (error) {
  throw new Error("Format jadwal dari Coach Wati tidak valid.");
}

console.log("JUMLAH HARI:", planData.schedule?.length);
console.log("DAFTAR HARI:", planData.schedule?.map(day => day.day));



// Menyesuaikan format JSON Coach Wati
// agar cocok dengan struktur jadwal RunSisten.

if (!Array.isArray(planData.schedule)) {
  planData.schedule =
    planData.jadwal ||
    planData.jadwal_latihan;
}

// Menangani format objek berdasarkan nama pengguna
if (!Array.isArray(planData.schedule)) {
  const userName = profile.name;

  const userSchedule =
    planData[userName] ||
    planData[Object.keys(planData)[0]];

  if (userSchedule && typeof userSchedule === "object") {
    planData.schedule = Object.entries(userSchedule).map(
      ([day, details]) => ({
        day,
        time: "—",
        status: "training",
        workoutType: "Latihan Lari",
        workout:
          details["Latihan Utama"] ||
          details.latihan_utama ||
          "Latihan Lari",
        activities: [
          {
            phase: "Latihan Utama",
            items: [
              details["Latihan Utama"] ||
              details.latihan_utama ||
              "Latihan Lari",
            ],
          },
        ],
        notes: "",
      })
    );
  }
}

if (!Array.isArray(planData.schedule)) {
  throw new Error("Coach Wati tidak menghasilkan daftar jadwal.");
}

planData.type = "training_plan";

planData.schedule = planData.schedule.map((day) => {
  const dayName = day.day || day.hari || "";

  // Jika AI menggunakan format jadwal dengan sesi
  if (Array.isArray(day.sesi)) {
    const activities = [];

    day.sesi.forEach((session) => {
      if (session.pemanasan) {
        activities.push({
          phase: "Pemanasan",
          items: [session.pemanasan],
        });
      }

      if (session.latihan_utama) {
        activities.push({
          phase: "Latihan Utama",
          items: [session.latihan_utama],
        });
      }

      if (session.pendinginan) {
        activities.push({
          phase: "Pendinginan",
          items: [session.pendinginan],
        });
      }
    });

    return {
  day: dayName,
  time: "—",
  status: "training",
  workoutType: "Latihan Lari",
  workout:
    day.workout ||
    day.sesi
      .map((session) => session.latihan_utama)
      .filter(Boolean)
      .join(" + "),
  activities,
  notes: day.notes || "",
};
  }

  return {
    ...day,
    day: dayName,
    time: day.time || "—",
    status: day.status || "rest",
    workoutType: day.workoutType || "Latihan Lari",
    activities: Array.isArray(day.activities)
      ? day.activities
      : [],
    notes: day.notes || "",
  };
});

const expectedDays = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
];

// Ambil satu data untuk setiap hari yang valid
const scheduleByDay = new Map();

planData.schedule.forEach((day) => {
  const dayName = String(day?.day || "").trim();

  if (
    expectedDays.includes(dayName) &&
    !scheduleByDay.has(dayName)
  ) {
    scheduleByDay.set(dayName, day);
  }
});

// Susun ulang menjadi tujuh hari yang pasti lengkap
planData.schedule = expectedDays.map((dayName) => {
  const dayData = scheduleByDay.get(dayName);

  // Jika AI tidak memberikan hari tersebut,
  // otomatis jadikan hari istirahat.
  if (!dayData) {
    return {
      day: dayName,
      time: "—",
      status: "rest",
      workoutType: "Istirahat",
      activities: [],
      notes: "Hari istirahat untuk pemulihan.",
    };
  }

  const validStatuses = [
    "training",
    "recovery",
    "rest",
  ];

  const status = validStatuses.includes(dayData.status)
    ? dayData.status
    : "rest";

  return {
    ...dayData,
    day: dayName,
    time: dayData.time || "—",
    status,
    workoutType:
      dayData.workoutType ||
      (status === "rest" ? "Istirahat" : "Pemulihan"),
    activities: Array.isArray(dayData.activities)
      ? dayData.activities
      : [],
    notes: dayData.notes || "",
  };
});

console.log("JADWAL FINAL:", planData.schedule);
console.log("TOTAL HARI:", planData.schedule.length);


const actualDays = planData.schedule?.map((day) => day.day);

if (
  planData.type !== "training_plan" ||
  !Array.isArray(planData.schedule) ||
  planData.schedule.length !== 7 ||
  JSON.stringify(actualDays) !== JSON.stringify(expectedDays)
) {
  throw new Error(
    "Jadwal tidak valid. Harus memuat Senin sampai Minggu secara berurutan tanpa duplikasi."
  );
}

const newPlan = {
  data: planData,
  createdAt: new Date().toISOString(),
  trainingInfo: trainingInfo,
};

// Simpan training plan ke database pengguna
try {
  const response = await fetch(
    'http://localhost:3000/api/training-plan',
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newPlan),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error || 'Gagal menyimpan training plan.'
    );
  }

  // Perbarui state setelah database berhasil menyimpan
  setTrainingProgress({});
  setSavedTrainingPlan(newPlan);
  setConsultationStarted(true);

  console.log('Training plan berhasil disimpan ke database.');
} catch (error) {
  console.error('Gagal menyimpan training plan:', error);
  alert(error.message || 'Training plan gagal disimpan.');
}


  } catch (error) {
  setTrainingError('Jadwal gagal dibuat: ' + error.message)
} finally {
  setTrainingLoading(false)
}
}

async function handleTrainingProgressChange(dayName) {
  if (!savedTrainingPlan || !authUser) return;

  const updatedProgress = {
    ...trainingProgress,
    [dayName]: !trainingProgress[dayName],
  };

  // Perbarui tampilan checklist
  setTrainingProgress(updatedProgress);

  try {
    const response = await fetch(
      'http://localhost:3000/api/training-progress',
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          day: dayName,
          completed: updatedProgress[dayName],
        }),
      }
    );

    if (!response.ok) {
  const errorText = await response.text();
  console.error('Respons backend:', response.status, errorText);
  throw new Error(errorText);
}

  } catch (error) {
    console.error('Gagal menyimpan progres:', error);

    // Kembalikan checklist jika penyimpanan gagal
    setTrainingProgress(trainingProgress);

    alert('Progres latihan gagal disimpan. Silakan coba lagi.');
  }
}

const trainingDays =
  savedTrainingPlan?.data?.schedule?.filter(
    (day) =>
      day.status === 'training' ||
      (day.workoutType && day.workoutType !== 'Istirahat')
  ) || [];

const completedTrainingDays = trainingDays.filter(
  (day) => trainingProgress[day.day]
).length;

// STATISTIK BERANDA

const today = new Date();

const startOfWeek = new Date(today);
const dayOfWeek = (today.getDay() + 6) % 7;

startOfWeek.setDate(today.getDate() - dayOfWeek);
startOfWeek.setHours(0, 0, 0, 0);

const endOfWeek = new Date(startOfWeek);
endOfWeek.setDate(startOfWeek.getDate() + 7);

const thisWeekRecords = runRecords.filter((record) => {
  const recordDate = new Date(
    record.date + 'T00:00:00'
  );

  return recordDate >= startOfWeek && recordDate < endOfWeek;
});

const weeklyDistance = thisWeekRecords.reduce(
  (total, record) => total + Number(record.distance || 0),
  0
);

const weeklySessions = thisWeekRecords.length;

const latestRun = [...runRecords].sort(
  (a, b) => new Date(b.date) - new Date(a.date)
)[0];

const trainingCompletion =
  trainingDays.length > 0
    ? Math.round(
        (completedTrainingDays / trainingDays.length) * 100
      )
    : 0;

const greetingName = profile.name?.trim()
  ? profile.name.trim().split(' ')[0]
  : 'Runners';
 async function saveChatMessage(role, message) {
  const response = await fetch(
    'http://localhost:3000/api/chat/history',
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role, message }),
    }
  );

  if (!response.ok) {
    throw new Error('Gagal menyimpan riwayat chat.');
  }
}
async function handleSendMessage(event) {
  event.preventDefault();

  const message = chatInput.trim();

  if (!message || chatLoading) return;

  setChatInput('');
  setChatLoading(true);

  // Tampilkan pesan pengguna
  setChatMessages((previous) => [
    ...previous,
    { role: 'user', text: message },
  ]);

  try {

    // Jika pengguna meminta jadwal yang sudah tersimpan
    if (
      savedTrainingPlan &&
      /siap coach|jadwal latihan|jadwal hari ini/i.test(message)
    ) {
      const reply =
        'Siap! Ini jadwal latihan mingguan yang sudah kita susun sebelumnya:';
      await saveChatMessage('user', message);
      await saveChatMessage('assistant', reply);

      setChatMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          text: reply,
          trainingPlan: savedTrainingPlan.data,
        },
      ]);

      return;
    }

    // Tampilkan gelembung jawaban Coach Wati
    setChatMessages((previous) => [
      ...previous,
      { role: 'assistant', text: '' },
    ]);

    const response = await fetch(
      'http://localhost:3000/api/chat/ollama',
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          profile: {
            name: profile.name,
            age: profile.age,
            experience: profile.experience,
            target: profile.target,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        errorText || 'Gagal menghubungi Coach Wati.'
      );
    }

    if (!response.body) {
      throw new Error('Browser tidak mendukung streaming respons.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let assistantReply = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      assistantReply += chunk;

      setChatMessages((previous) => {
        const updated = [...previous];
        const lastIndex = updated.length - 1;

        updated[lastIndex] = {
          ...updated[lastIndex],
          text: updated[lastIndex].text + chunk,
        };

        return updated;
      });
    }

    const remainingText = decoder.decode();

    if (remainingText) {
      assistantReply += remainingText;

      setChatMessages((previous) => {
        const updated = [...previous];
        const lastIndex = updated.length - 1;

        updated[lastIndex] = {
          ...updated[lastIndex],
          text: updated[lastIndex].text + remainingText,
        };

        return updated;
      });
    }

    // Simpan jawaban lengkap Coach Wati
    // Simpan pesan pengguna dan jawaban Coach Wati
if (assistantReply.trim()) {
  await saveChatMessage('user', message);
  await saveChatMessage('assistant', assistantReply);
}

  } catch (error) {
    console.error('Chat error:', error);

    // Hapus pesan pengguna dan jawaban sementara yang gagal
    setChatMessages((previous) => {
      const updated = [...previous];

      if (updated[updated.length - 1]?.role === 'assistant') {
        updated.pop();
      }

      if (updated[updated.length - 1]?.role === 'user') {
        updated.pop();
      }

      return updated;
    });

    alert('Pesan belum berhasil dikirim. Silakan coba lagi.');
  } finally {
    setChatLoading(false);
  }
}
  
  // PENDAFTARAN AKUN
  async function handleRegister(event) {
    event.preventDefault();
    setAuthError('');

    try {
      const response = await fetch(
        'http://localhost:3000/api/auth/register',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(registerData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Pendaftaran gagal.');
      }

      setAuthUser(data.user);
      setIsLoggedIn(true);
      loadTrainingData();

      setProfile((previous) => ({
        ...previous,
        name: data.user.name,
      }));

      setAuthPage('login');
      setActivePage('Beranda');

      setRegisterData({
        name: '',
        email: '',
        password: '',
      });

      alert('Pendaftaran berhasil! Selamat datang di RunSisten.');
    } catch (error) {
      setAuthError(error.message);
    }
  }

  // LOGIN AKUN
  async function handleLogin(event) {
    event.preventDefault();
    setAuthError('');

    try {
      const response = await fetch(
        'http://localhost:3000/api/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(loginData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login gagal.');
      }

setAuthUser(data.user);
setIsLoggedIn(true);

// Ambil training plan milik akun yang baru login
setSavedTrainingPlan(null);
setTrainingProgress({});
setConsultationStarted(false);

loadTrainingData();

      setProfile((previous) => ({
        ...previous,
        name: data.user.name,
      }));

      setLoginData({
        email: '',
        password: '',
      });

      setActivePage('Beranda');
    } catch (error) {
      setAuthError(error.message);
    }
  }

  // LOGOUT AKUN
  async function handleLogout() {
    try {
      await fetch(
        'http://localhost:3000/api/auth/logout',
        {
          method: 'POST',
          credentials: 'include',
        }
      );
    } catch (error) {
      console.error('Logout error:', error);
    }
    setActivePage('Beranda');
    setAuthUser(null);
    setIsLoggedIn(false);
    setChatMessages([
  {
    role: 'assistant',
    text: 'Halo! Aku Coach Wati. Ada yang ingin kamu tanyakan tentang lari?',
  },
]);
    setSavedTrainingPlan(null);
setTrainingProgress({});
setConsultationStarted(false);

setTrainingInfo({
  currentDistance: '',
  trainingDays: '',
  difficulty: '',
});
    setAuthPage('login');

    setLoginData({
      email: '',
      password: '',
    });

    setAuthError('');
  }

const menuItems = [
  { name: 'Beranda', icon: Home },
  { name: 'Konsultasi AI', icon: Bot },
  { name: 'Catatan Lari', icon: NotebookPen },
  { name: 'Progres', icon: ChartNoAxesColumnIncreasing },
  { name: 'Training Plan', icon: CalendarDays },
  { name: 'Profil', icon: UserRound },
];

  function handleProfileChange(event) {
    const { name, value } = event.target

    setProfile({
      ...profile,
      [name]: value,
    })
  }

function handleProfilePhotoChange(event) {
  const file = event.target.files[0];

  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Pilih file gambar yang valid.');
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    alert('Ukuran foto maksimal 2 MB.');
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    setProfilePhoto(reader.result);
  };

  reader.readAsDataURL(file);
}
  
async function handleProfileSubmit(event) {
  event.preventDefault();

  if (
    Number(profile.age) <= 0 ||
    Number(profile.weight) <= 0 ||
    Number(profile.height) <= 0
  ) {
    alert('Usia, berat, dan tinggi badan harus lebih dari 0.');
    return;
  }

  try {
    const response = await fetch(
      'http://localhost:3000/api/profile',
      {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...profile,
          photo: profilePhoto,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Gagal menyimpan profil.');
    }

    setProfile((previous) => ({
      ...previous,
      name: profile.name,
    }));

    alert('Profil berhasil disimpan!');
  } catch (error) {
    console.error('Save profile error:', error);
    alert('Profil gagal disimpan: ' + error.message);
  }
}

function handleRunChange(event) {
  const { name, value } = event.target

  setRunForm((previous) => ({
    ...previous,
    [name]: value,
  }))
}
function handleStravaConnect() {
  window.location.href =
    'http://localhost:3000/api/strava/connect';
}
async function handleStravaSync() {
  setStravaLoading(true);
  setStravaMessage('');

  try {
    // Ambil aktivitas dari Strava milik akun yang login
    const response = await fetch(
      'http://localhost:3000/api/strava/activities',
      { credentials: 'include' }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || 'Gagal mengambil aktivitas Strava.'
      );
    }

    const activities = await response.json();

    // Ambil aktivitas lari saja
    const stravaRuns = activities.filter((activity) =>
      ['Run', 'VirtualRun'].includes(
        activity.sport_type || activity.type
      )
    );

    let savedCount = 0;

    // Simpan setiap aktivitas ke database akun yang login
    for (const activity of stravaRuns) {
      const distance = Number(activity.distance || 0) / 1000;
      const duration = Number(activity.moving_time || 0) / 60;
      const date = activity.start_date_local?.slice(0, 10);

      if (!date || distance <= 0 || duration <= 0) {
        continue;
      }

      const saveResponse = await fetch(
        'http://localhost:3000/api/runs',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            source: 'strava',
            source_id: String(activity.id),
            date,
            distance: Number(distance.toFixed(2)),
            duration: Number(duration.toFixed(2)),
            notes: activity.name || 'Aktivitas dari Strava',
          }),
        }
      );

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error || 'Gagal menyimpan aktivitas Strava.'
        );
      }

      savedCount++;
    }

    // Muat ulang riwayat dari database
    const refreshResponse = await fetch(
      'http://localhost:3000/api/runs',
      { credentials: 'include' }
    );

    if (!refreshResponse.ok) {
      throw new Error('Gagal memuat ulang riwayat lari.');
    }

    const records = await refreshResponse.json();
    setRunRecords(records);

    setStravaMessage(
      `${savedCount} aktivitas lari berhasil disinkronkan dari Strava.`
    );
  } catch (error) {
    setStravaMessage(error.message);
  } finally {
    setStravaLoading(false);
  }
}

async function handleRunSubmit(e) {
  e.preventDefault();

  const distance = Number(runForm.distance);
  const duration = Number(runForm.duration);

  if (distance <= 0 || duration <= 0) {
    alert("Jarak dan durasi harus lebih dari 0.");
    return;
  }

  const isEditing = editingRunId !== null;

  const url = isEditing
    ? `http://localhost:3000/api/runs/${editingRunId}`
    : "http://localhost:3000/api/runs";

  try {
    const response = await fetch(url, {
      method: isEditing ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        date: runForm.date,
        distance,
        duration,
        notes: runForm.notes,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Gagal menyimpan catatan lari.");
    }

    const refreshResponse = await fetch(
      "http://localhost:3000/api/runs",
      { credentials: "include" }
    );

    if (!refreshResponse.ok) {
      throw new Error("Catatan tersimpan, tetapi gagal memuat ulang riwayat.");
    }

    const records = await refreshResponse.json();
    setRunRecords(records);

    alert(
      isEditing
        ? "Catatan lari berhasil diperbarui!"
        : "Catatan lari berhasil disimpan!"
    );

    setRunForm({
      date: "",
      distance: "",
      duration: "",
      notes: "",
    });

    setEditingRunId(null);
    setShowRunForm(false);
  } catch (error) {
    alert(error.message);
  }
}

async function handleDeleteRun(id) {
  if (!window.confirm("Hapus catatan lari ini?")) return;

  try {
    const response = await fetch(
      `http://localhost:3000/api/runs/${id}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Gagal menghapus catatan lari.");
    }

    setRunRecords((previous) =>
      previous.filter((record) => record.id !== id)
    );
  } catch (error) {
    alert(error.message);
  }
}
const handleEditRun = (record) => {
  setEditingRunId(record.id);

  setRunForm({
    date: record.date,
    distance: record.distance,
    duration: record.duration,
    notes: record.notes || "",
  });

  setShowRunForm(true);
};

// Menghitung awal minggu (Senin)
function getWeekStart(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  const day = result.getDay();
  const difference = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + difference);
  return result;
}

// Format tanggal menjadi YYYY-MM-DD
function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// Menghitung statistik suatu minggu
function getWeeklyStats(weekOffset) {
  const monday = getWeekStart(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const startDate = formatLocalDate(monday);
  const endDate = formatLocalDate(sunday);

  const records = runRecords.filter((record) =>
    record.date >= startDate &&
    record.date <= endDate
  );

  const totalDistance = records.reduce(
    (total, record) => total + Number(record.distance || 0),
    0
  );

  const totalDuration = records.reduce(
    (total, record) => total + Number(record.duration || 0),
    0
  );

  const averagePace =
    totalDistance > 0
      ? totalDuration / totalDistance
      : 0;

  return {
    monday,
    sunday,
    records,
    totalDistance,
    totalDuration,
    totalSessions: records.length,
    averagePace,
  };
}

// Statistik minggu yang sedang dipilih
const selectedWeek = getWeeklyStats(progressWeekOffset);

// Data grafik enam minggu terakhir
const weeklyChartData = Array.from(
  { length: 6 },
  (_, index) => {
    const offset = progressWeekOffset - (5 - index);
    const stats = getWeeklyStats(offset);

    return {
      label: `M${6 - index}`,
      distance: stats.totalDistance,
      sessions: stats.totalSessions,
    };
  }
);

// Format pace menjadi menit:detik
function formatPace(pace) {
  if (!pace) return '0:00';

  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

  if (authChecking) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <p>Memeriksa sesi login...</p>
      </div>
    </div>
  );
}

return (
  <>
    {!isLoggedIn ? (
        <div className="auth-page">
          <div className="auth-card">
            <button
  type="button"
  className="auth-logo-button"
  onClick={() => {
    setAuthPage('login')
    setAuthError('')
  }}
  aria-label="RunSisten"
>
  <img
    src="/runsisten-logo.png"
    alt="RunSisten"
    className="auth-logo-image"
  />
</button>

            <div className="auth-heading">
              <h1>
                {authPage === 'login'
                  ? 'Selamat Datang Kembali!'
                  : 'Buat Akun Baru'}
              </h1>

              <p>
                {authPage === 'login'
                  ? 'Masuk dan lanjutkan perjalanan larimu.'
                  : 'Mulai perjalanan sehatmu bersama RunSisten.'}
              </p>
            </div>

            {authError && (
              <div className="auth-error">{authError}</div>
            )}

            {authPage === 'login' ? (
              <form className="auth-form" onSubmit={handleLogin}>
                <label>Email</label>
                <input
                  type="email"
                  placeholder="Masukkan email"
                  value={loginData.email}
                  onChange={(event) =>
                    setLoginData({
                      ...loginData,
                      email: event.target.value,
                    })
                  }
                  required
                />

                <label>Password</label>
                <input
                  type="password"
                  placeholder="Masukkan password"
                  value={loginData.password}
                  onChange={(event) =>
                    setLoginData({
                      ...loginData,
                      password: event.target.value,
                    })
                  }
                  required
                />

                <button type="submit">Masuk</button>

                <p className="auth-switch">
                  Belum punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthPage('register')
                      setAuthError('')
                    }}
                  >
                    Daftar sekarang
                  </button>
                </p>
              </form>
            ) : (
              <form className="auth-form" onSubmit={handleRegister}>
                <label>Nama Lengkap</label>
                <input
                  type="text"
                  placeholder="Masukkan nama lengkap"
                  value={registerData.name}
                  onChange={(event) =>
                    setRegisterData({
                      ...registerData,
                      name: event.target.value,
                    })
                  }
                  required
                />

                <label>Email</label>
                <input
                  type="email"
                  placeholder="Masukkan email"
                  value={registerData.email}
                  onChange={(event) =>
                    setRegisterData({
                      ...registerData,
                      email: event.target.value,
                    })
                  }
                  required
                />

                <label>Password</label>
                <input
                  type="password"
                  placeholder="Minimal 8 karakter"
                  minLength={8}
                  value={registerData.password}
                  onChange={(event) =>
                    setRegisterData({
                      ...registerData,
                      password: event.target.value,
                    })
                  }
                  required
                />

                <button type="submit">Buat Akun</button>

                <p className="auth-switch">
                  Sudah punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthPage('login')
                      setAuthError('')
                    }}
                  >
                    Masuk
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      ) : (
  <div className="dashboard">
      <aside className="sidebar">
        <button
  type="button"
  className="logo-button"
  onClick={() => setActivePage('Beranda')}
  aria-label="Kembali ke Beranda"
>
  <img
    src="/runsisten-logo.png"
    alt="RunSisten"
    className="sidebar-logo"
  />
</button>

        <nav className="navigation">
          {menuItems.map((item) => (
            <a
              href="#"
              key={item.name}
              className={activePage === item.name ? 'active' : ''}
              onClick={(event) => {
                event.preventDefault()
                setActivePage(item.name)
              }}
            >
              <span className="menu-icon">
  <item.icon size={20} strokeWidth={1.8} />
</span>
{item.name}
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
  <p>Your Personal AI Running Companion</p>

  <button
    className="logout-button"
    onClick={handleLogout}
  >
    <span>↪</span> Keluar
  </button>
</div>
      </aside>

      <main className={`main-content ${activePage === 'Konsultasi AI' ? 'consultation-mode' : ''}`}>

        
{activePage === 'Beranda' && (
  <section className="home-page">

    {/* SAPAAN */}
    <div className="home-welcome">
      <div>
        <span className="home-eyebrow">
          RUNSISTEN DASHBOARD
        </span>

        <h1 className="home-greeting">
  Halo, {profile.name || 'Pengguna'}!
  <Sparkles size={30} strokeWidth={1.8} />
</h1>

        <p>
          Siap berlari dan mencapai targetmu hari ini?
        </p>
      </div>

      <div className="home-date">
        {today.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </div>
    </div>

    {/* STATISTIK */}
    <div className="home-stats">

      <div className="home-stat-card">
  <span className="home-stat-icon">
    <Footprints size={24} strokeWidth={1.8} />
  </span>
  <p>Total Jarak Minggu Ini</p>
  <h2>{weeklyDistance.toFixed(1)} KM</h2>
</div>

<div className="home-stat-card">
  <span className="home-stat-icon">
    <CalendarDays size={24} strokeWidth={1.8} />
  </span>
  <p>Sesi Lari Minggu Ini</p>
  <h2>{weeklySessions} Sesi</h2>
</div>

<div className="home-stat-card">
  <span className="home-stat-icon">
    <Flag size={24} strokeWidth={1.8} />
  </span>
  <p>Total Jarak Keseluruhan</p>
  <h2>
    {runRecords.reduce(
      (total, record) =>
        total + Number(record.distance || 0),
      0
    ).toFixed(1)} KM
  </h2>
</div>
    </div>

    {/* TRAINING PLAN */}
    <div className="home-card home-training-panel">
      <div className="home-card-heading">
        <div>
          <h2 className="home-activity-title">
  Training Plan
  <ClipboardList size={21} strokeWidth={1.8} />
</h2>
          <p>Perjalanan latihanmu minggu ini.</p>
        </div>

        <button
          className="home-text-button"
          onClick={() => setActivePage('Training Plan')}
        >
          Lihat Jadwal →
        </button>
      </div>

      {savedTrainingPlan ? (
        <>
          <div className="home-training-info">
            <strong>
              {savedTrainingPlan.data.title}
            </strong>

            <span>
              {completedTrainingDays} dari {trainingDays.length} sesi selesai
            </span>
          </div>

          <div className="home-progress-track">
            <div
              className="home-progress-fill"
              style={{ width: `${trainingCompletion}%` }}
            />
          </div>

          <p className="home-progress-label">
            {trainingCompletion}% latihan diselesaikan
          </p>
        </>
      ) : (
        <div className="home-empty">
          <p>Belum ada Training Plan.</p>
          <button
            onClick={() => setActivePage('Training Plan')}
          >
            Buat Training Plan
          </button>
        </div>
      )}
    </div>

    {/* AKTIVITAS TERAKHIR */}
    <div className="home-card home-activity-panel">
      <div className="home-card-heading">
        <div>
          <h2 className="home-activity-title">
  Aktivitas Terakhir
  <NotebookPen size={21} strokeWidth={1.8} />
</h2>
          <p>Catatan perjalanan larimu.</p>
        </div>

        <button
          className="home-text-button"
          onClick={() => setActivePage('Catatan Lari')}
        >
          Lihat Semua →
        </button>
      </div>

      {latestRun ? (
        <div className="home-latest-run">
          <div>
            <strong>{latestRun.distance} KM</strong>
            <p>
              {new Date(
                latestRun.date + 'T00:00:00'
              ).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>

          <div className="home-run-details">
  <span>
    <Clock size={16} strokeWidth={1.8} />
    {latestRun.duration} menit
  </span>
  <span>
    <Zap size={16} strokeWidth={1.8} />
    Pace {(() => {
      const pace = Number(latestRun.pace);
      const minutes = Math.floor(pace);
      const seconds = Math.round((pace - minutes) * 60);

      return `${minutes}:${String(seconds).padStart(2, '0')} menit/km`;
    })()}
  </span>
</div>
        </div>
      ) : (
        <div className="home-empty">
          <p>Belum ada catatan lari.</p>
          <button
            onClick={() => {
              setShowRunForm(true);
              setActivePage('Catatan Lari');
            }}
          >
            + Catat Lari Pertama
          </button>
        </div>
      )}
    </div>

    {/* COACH WATI */}
    <div className="home-coach-card">
      <div>
        <span className="home-eyebrow">
          PERSONAL RUNNING COACH
        </span>

        <h2>Butuh teman latihan?</h2>

        <p>
          Coach Wati siap membantu menjawab pertanyaan
          dan menemani perjalanan larimu.
        </p>

        <button
          onClick={() => setActivePage('Konsultasi AI')}
        >
          Konsultasi Sekarang →
        </button>
      </div>

      <div className="home-coach-icon">
  <Footprints size={76} strokeWidth={1.5} />
</div>
    </div>

  </section>
)}


       {activePage === 'Konsultasi AI' && (
  <section className="consultation-page">
  <div className="chat-container">

    <div className="coach-card">
  <div className="coach-avatar">
    <img src="/coach-wati.png" alt="Coach Wati" />
  </div>

  <div>
    <h2>Coach Wati</h2>
    <p>AI Personal Running Coach</p>
  </div>
</div>

<div className="chat-messages" ref={chatMessagesRef}>
  {chatMessages.map((message, index) => (
    <div
      key={index}
      className={`chat-bubble ${message.role}`}
    >
      {message.text}

      {message.trainingPlan && (
        <div className="chat-training-plan">
          {message.trainingPlan.schedule.map((day, i) => (
            <div key={i} className="chat-training-day">
              <h4>{day.day}</h4>
              <p>{day.time} — {day.workoutType}</p>

              {day.activities?.map((activity, j) => (
                <div key={j}>
                  <strong>{activity.phase}</strong>
                  <ul>
                    {activity.items.map((item, k) => (
                      <li key={k}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}

              {day.notes && <p>{day.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  ))}
</div>
{showScrollButton && (
  <button
    type="button"
    className="chat-scroll-bottom"
    onClick={() => {
      const chatBox = chatMessagesRef.current;

      if (chatBox) {
        chatBox.scrollTo({
          top: chatBox.scrollHeight,
          behavior: 'smooth',
        });
      }
    }}
    aria-label="Ke pesan terbaru"
    title="Ke pesan terbaru"
  >
    ↓
  </button>
)}
      <form className="chat-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={chatInput}
          onChange={(event) => setChatInput(event.target.value)}
          placeholder="Tanyakan sesuatu tentang lari..."
          disabled={chatLoading}
        />

        <button type="submit" disabled={chatLoading || !chatInput.trim()}>
          Kirim
        </button>
      </form>
    </div>
  </section>
)}

        {activePage === 'Catatan Lari' && (
  <section className="run-page">
    
<div className="run-page-header">
  <div>
    <h1>Catatan Lari 📝</h1>
    <p>Catat dan pantau perjalanan larimu.</p>
  </div>

  <div className="run-header-actions">
    {!showRunForm ? (
      <>
        {stravaStatusLoading ? (
  <button
    type="button"
    className="strava-sync-button"
    disabled
  >
    Memeriksa Strava...
  </button>
) : stravaConnected ? (
  <button
    type="button"
    className="strava-sync-button"
    onClick={handleStravaSync}
    disabled={stravaLoading}
  >
    {stravaLoading
      ? 'Menyinkronkan...'
      : '↻ Sinkronkan Strava'}
  </button>
) : (
  <button
    type="button"
    className="strava-sync-button"
    onClick={handleStravaConnect}
  >
    Hubungkan Strava
  </button>
)}

        <button
          type="button"
          className="add-run-button"
          onClick={() => setShowRunForm(true)}
        >
          + Tambah Catatan
        </button>
      </>
    ) : (
      <button
        type="button"
        className="add-run-button"
        onClick={() => {
          setShowRunForm(false);
          setEditingRunId(null);
        }}
      >
        Batal
      </button>
    )}

    {stravaMessage && (
      <p className="strava-sync-message">{stravaMessage}</p>
    )}
  </div>
</div>

    {showRunForm ? (
      <div className="run-form-card">
        <h2>
  {editingRunId !== null ? "Edit Catatan Lari" : "Tambah Catatan Lari"}
</h2>
        <p>Masukkan informasi aktivitas larimu.</p>

        <form className="run-form" onSubmit={handleRunSubmit}>
          <label>Tanggal Lari</label>
          <input
            type="date"
            name="date"
            value={runForm.date}
            onChange={handleRunChange}
            required
          />

          <label>Jarak (KM)</label>
          <input
            type="number"
            name="distance"
            placeholder="Contoh: 5"
            min="0.1"
            step="0.1"
            value={runForm.distance}
            onChange={handleRunChange}
            required
          />

          <label>Durasi (Menit)</label>
          <input
            type="number"
            name="duration"
            placeholder="Contoh: 35"
            min="1"
            step="1"
            value={runForm.duration}
            onChange={handleRunChange}
            required
          />

          <label>Catatan Tambahan</label>
          <textarea
            name="notes"
            placeholder="Bagaimana perasaanmu saat berlari?"
            value={runForm.notes}
            onChange={handleRunChange}
          />

          <div className="run-form-actions">
            <button type="submit">
  {editingRunId !== null ? "Simpan Perubahan" : "Simpan Catatan"}
</button>

            <button
              type="button"
              className="cancel-run-button"
              onClick={() => setShowRunForm(false)}
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    ) : (
      <>
        {runRecords.length === 0 ? (
          <div className="empty-record">
            <span>🏃‍♂️</span>
            <h2>Belum Ada Riwayat Lari</h2>
            <p>
              Setiap perjalanan dimulai dari langkah pertama.
              Yuk, catat aktivitas larimu!
            </p>

            <button
              className="add-run-button"
              onClick={() => setShowRunForm(true)}
            >
              + Tambah Catatan Pertama
            </button>
          </div>
        ) : (
          <div className="run-history">
            <h2>Riwayat Lari</h2>

            {runRecords.map((record) => (
              <div className="run-record-card" key={record.id}>
                <div className="run-record-top">
                  <strong>{record.distance} KM</strong>
                  <span>{record.date}</span>
                </div>

                
<div className="run-record-details">
  {record.source === 'strava' && (
    <span className="strava-source-label">
      <Link2 size={18} color="#FC4C02" />
      Terhubung dari Strava
    </span>
  )}

  <span>
    <Clock3 size={18} />
    {record.duration} menit
  </span>

  <span>
    <Gauge size={18} />
    Pace {formatPace(Number(record.pace))} menit/km
  </span>
</div>

                {record.notes && (
                  <p className="run-record-notes">
                    {record.notes}
                  </p>
                )}

                <div className="run-record-actions">
  {record.source !== 'strava' && (
    <>
      <button
        className="edit-run-button"
        onClick={() => handleEditRun(record)}
      >
        Edit
      </button>

      <button
        className="delete-run-button"
        onClick={() => handleDeleteRun(record.id)}
      >
        Hapus Catatan
      </button>
    </>
  )}

  {record.source === 'strava' && (
    <button
      className="delete-run-button"
      onClick={() => handleDeleteRun(record.id)}
    >
      Hapus Catatan
    </button>
  )}
</div>
              </div>
            ))}
          </div>
        )}
      </>
    )}
  </section>
)}

        
{activePage === 'Progres' && (
  <section className="progress-page">

    <div className="progress-header">
      <h1>Progres Lari 📊</h1>
      <p>Pantau perkembangan dan pencapaian larimu.</p>
    </div>

    {/* FILTER MINGGU */}
    <div className="progress-filter">
      <button
        onClick={() => setProgressWeekOffset(0)}
        className={progressWeekOffset === 0 ? 'selected' : ''}
      >
        Minggu Ini
      </button>

      <button
        onClick={() => setProgressWeekOffset(-1)}
        className={progressWeekOffset === -1 ? 'selected' : ''}
      >
        Minggu Sebelumnya
      </button>

      <button
        onClick={() =>
          setProgressWeekOffset((previous) => previous - 1)
        }
      >
        ←
      </button>
    </div>

    <p className="progress-date">
      {selectedWeek.monday.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
      })}
      {' - '}
      {selectedWeek.sunday.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}
    </p>

    {/* RINGKASAN */}
    <div className="progress-stats">

      <div className="progress-stat-card">
        <span>Total Jarak</span>
        <strong>
          {selectedWeek.totalDistance.toFixed(2)} KM
        </strong>
      </div>

      <div className="progress-stat-card">
        <span>Total Sesi</span>
        <strong>
          {selectedWeek.totalSessions} Sesi
        </strong>
      </div>

      <div className="progress-stat-card">
        <span>Rata-rata Pace</span>
        <strong>
          {formatPace(selectedWeek.averagePace)}
        </strong>
        <small>Menit/km</small>
      </div>

      <div className="progress-stat-card">
        <span>Total Durasi</span>
        <strong>
          {selectedWeek.totalDuration} Menit
        </strong>
      </div>

    </div>

    {/* GRAFIK GARIS */}
    <div className="progress-chart-card">
      <h2>Perkembangan Jarak Lari</h2>
      <p>Perbandingan jarak lari selama enam minggu.</p>

      {weeklyChartData.some((item) => item.distance > 0) ? (
        <div className="line-chart">

          <svg
            viewBox="0 0 600 260"
            className="progress-svg"
            role="img"
            aria-label="Grafik perkembangan jarak lari mingguan"
          >
            {(() => {
              const maxDistance = Math.max(
                5,
                ...weeklyChartData.map((item) => item.distance)
              );

              const points = weeklyChartData.map((item, index) => ({
                x: 45 + index * 102,
                y: 205 - (item.distance / maxDistance) * 165,
                ...item,
              }));

              return (
                <>
                  {[0, 1, 2, 3].map((line) => {
                    const y = 205 - line * 55;

                    return (
                      <line
                        key={line}
                        x1="40"
                        y1={y}
                        x2="555"
                        y2={y}
                        stroke="#dce5ef"
                        strokeDasharray="5 5"
                      />
                    );
                  })}

                  <polyline
                    points={points
                      .map((point) => `${point.x},${point.y}`)
                      .join(' ')}
                    fill="none"
                    stroke="#3182ce"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {points.map((point, index) => (
                    <g key={index}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="4"
                        fill="#3182ce"
                        stroke="white"
                        strokeWidth="2"
                      />

                      <text
                        x={point.x}
                        y="235"
                        textAnchor="middle"
                        fontSize="13"
                        fill="#64748b"
                      >
                        {point.label}
                      </text>

                      <text
                        x={point.x}
                        y={point.y - 14}
                        textAnchor="middle"
                        fontSize="13"
                        fill="#1e3a5f"
                        fontWeight="bold"
                      >
                        {point.distance.toFixed(1)}
                      </text>
                    </g>
                  ))}
                </>
              );
            })()}
          </svg>

          <p className="chart-unit">Jarak (KM)</p>
        </div>
      ) : (
        <div className="progress-empty">
          Belum ada data lari untuk ditampilkan.
        </div>
      )}
    </div>

    {/* RIWAYAT MINGGUAN */}
    <div className="weekly-history-card">
      <h2>Riwayat Lari Mingguan</h2>

      {selectedWeek.records.length === 0 ? (
        <p className="progress-empty">
          Belum ada catatan lari pada minggu ini.
        </p>
      ) : (
        selectedWeek.records.map((record) => (
          <div className="progress-record" key={record.id}>
            <div>
              <strong>
                {new Date(
                  record.date + 'T00:00:00'
                ).toLocaleDateString('id-ID', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                })}
              </strong>

              <p>{record.distance} KM</p>
            </div>

            <div className="progress-record-info">
              <strong>{record.duration} menit</strong>
              <span>⚡ Pace {formatPace(record.pace)} menit/km</span>
            </div>
          </div>
        ))
      )}
    </div>

  </section>
)}


        
{activePage === 'Training Plan' && (
  <section className="training-section">
    <h1>Training Plan 🏃‍♀️</h1>
    <p className="training-description">
      Susun program latihan personal bersama Coach Wati
      berdasarkan kemampuan dan target larimu.
    </p>

    {!consultationStarted ? (
      <div className="consultation-card">
        <h2>Yuk, kenali kemampuan larimu!</h2>
        <p>
          Sebelum menyusun program latihan, aku ingin
          mengetahui kondisi dan kebiasaan larimu.
        </p>

        <div className="target-info">
          <strong>Target larimu saat ini:</strong>
          <span>{profile.target || 'Belum diatur di Profil'}</span>
        </div>

        <form onSubmit={handleTrainingSubmit}>
          <label>
            1. Seberapa jauh kamu mampu berlari saat ini?
          </label>
          <select
            name="currentDistance"
            value={trainingInfo.currentDistance}
            onChange={handleTrainingChange}
            required
          >
            <option value="">Pilih kemampuanmu</option>
            <option value="Belum pernah berlari">
              Belum pernah berlari
            </option>
            <option value="1-2 km">1-2 km</option>
            <option value="3-5 km">3-5 km</option>
            <option value="Lebih dari 5 km">
              Lebih dari 5 km
            </option>
          </select>

          <label>
            2. Berapa hari kamu bisa berlatih dalam seminggu?
          </label>
          <select
            name="trainingDays"
            value={trainingInfo.trainingDays}
            onChange={handleTrainingChange}
            required
          >
            <option value="">Pilih hari latihan</option>
            <option value="2 hari">2 hari</option>
            <option value="3 hari">3 hari</option>
            <option value="4 hari">4 hari</option>
            <option value="5 hari atau lebih">
              5 hari atau lebih
            </option>
          </select>

          <label>
            3. Apa kendala terbesar yang kamu rasakan?
          </label>
          <textarea
            name="difficulty"
            value={trainingInfo.difficulty}
            onChange={handleTrainingChange}
            placeholder="Contoh: cepat lelah, sulit mengatur napas, atau sulit konsisten..."
            required
          />

          <button type="submit" disabled={trainingLoading}>
  {trainingLoading
    ? 'Coach Wati sedang menyusun jadwal...'
    : 'Mulai Konsultasi'}
</button>
{trainingLoading && (
  <p className="training-loading">
    Coach Wati sedang menganalisis kemampuanmu dan menyusun jadwal latihan.
    Mohon tunggu sebentar.
  </p>
)}

{trainingError && (
  <p className="training-error">
    {trainingError}
  </p>
)}
        </form>
      </div>
    ) : (
      <div className="consultation-card">
        {savedTrainingPlan && (
  
<div className="saved-training-plan">

  <h2>{savedTrainingPlan.data.title}</h2>

  
<div className="training-progress">
  <div className="training-progress-heading">
    <h3>Progress Latihan Mingguan</h3>
    <strong>
      {trainingDays.length > 0
        ? Math.round(
            (completedTrainingDays / trainingDays.length) * 100
          )
        : 0}%
    </strong>
  </div>

  <p>
    {completedTrainingDays} dari {trainingDays.length} hari latihan selesai
  </p>

  <div className="training-progress-track">
    <div
      className="training-progress-fill"
      style={{
        width: `${
          trainingDays.length > 0
            ? (completedTrainingDays / trainingDays.length) * 100
            : 0
        }%`
      }}
    />
  </div>
</div>


  <div className="training-plan-content">
    {savedTrainingPlan.data.schedule.map((day, index) => (
      <div
        key={index}
        className={`training-day ${day.status}`}
      >
        <div className="training-day-header">
          <div>
            <h3>{day.day}</h3>
            <p>{day.workoutType}</p>
          </div>

          {(day.status === 'training' ||
  (day.workoutType && day.workoutType !== 'Istirahat')) && (
            <label className="training-completion">
              <input
                type="checkbox"
                checked={Boolean(trainingProgress[day.day])}
                onChange={() =>
                  handleTrainingProgressChange(day.day)
                }
              />
              Selesai
            </label>
          )}
        </div>

        {day.status === 'training' && (
          <div className="workout-menu">
            <h4>{day.workout || day.workoutType}</h4>
          </div>
        )}
      </div>
    ))}
  </div>

  <small>
    Dibuat: {new Date(savedTrainingPlan.createdAt).toLocaleDateString('id-ID')}
  </small>

</div>
)}

        <div className="target-info">
          <strong>Target:</strong>
          <span>{profile.target || 'Belum diatur'}</span>
        </div>

        <div className="target-info">
          <strong>Kemampuan lari:</strong>
          <span>
  {savedTrainingPlan?.trainingInfo?.currentDistance ||
   trainingInfo.currentDistance ||
   'Belum diisi'}
</span>
        </div>

        <div className="target-info">
          <strong>Waktu latihan:</strong>
          <span>
  {savedTrainingPlan?.trainingInfo?.trainingDays ||
   trainingInfo.trainingDays ||
   'Belum diisi'}
</span>
        </div>

        <div className="target-info">
          <strong>Kendala:</strong>
          <span>
  {savedTrainingPlan?.trainingInfo?.difficulty ||
   trainingInfo.difficulty ||
   'Belum diisi'}
</span>
        </div>

        <button
          onClick={() => setConsultationStarted(false)}
        >
          Ubah Jawaban
        </button>
      </div>
    )}
  </section>
)}


        
{activePage === 'Profil' && (
  <section className="profile-section">
    <div className="profile-heading">
      <h1>Profil Saya 👤</h1>
      <p>Kelola informasi diri dan pantau aktivitas larimu.</p>
    </div>

    <div className="profile-identity">
      
<div className="profile-avatar-wrapper">
  <div className="profile-avatar">
    {profilePhoto ? (
      <img src={profilePhoto} alt="Foto Profil" />
    ) : (
      profileInitial
    )}
  </div>

  <label className="profile-photo-upload">
    Ganti Foto
    <input
      type="file"
      accept="image/*"
      onChange={handleProfilePhotoChange}
      hidden
    />
  </label>
</div>


      <div className="profile-identity-info">
        <h2>{profile.name || 'Pengguna RunSisten'}</h2>
        <p>{account.email || 'Email tidak tersedia'}</p>
        <span className="profile-status">● Akun aktif</span>
      </div>
    </div>

    <div className="profile-stats">
      <div className="profile-stat-card">
        <span>Total Jarak</span>
        <strong>{totalDistance.toFixed(1)} KM</strong>
      </div>

      <div className="profile-stat-card">
        <span>Total Aktivitas</span>
        <strong>{totalRuns} Sesi</strong>
      </div>

      <div className="profile-stat-card">
        <span>Indeks BMI</span>
        <strong>{bmi || '—'}</strong>
      </div>
    </div>

    <div className="profile-form-card">
      <div className="profile-card-heading">
        <h2>Informasi Pribadi</h2>
        <p>Pastikan informasi berikut selalu diperbarui.</p>
      </div>

      <form className="profile-form" onSubmit={handleProfileSubmit}>
        <div className="profile-form-grid">
          <div className="profile-field">
            <label>Nama Lengkap</label>
            <input
              type="text"
              name="name"
              placeholder="Masukkan nama lengkap"
              value={profile.name}
              onChange={handleProfileChange}
              required
            />
          </div>

          <div className="profile-field">
            <label>Usia</label>
            <input
              type="number"
              name="age"
              min="1"
              placeholder="Contoh: 21"
              value={profile.age}
              onChange={handleProfileChange}
              required
            />
          </div>

          <div className="profile-field">
            <label>Jenis Kelamin</label>
            <select
              name="gender"
              value={profile.gender}
              onChange={handleProfileChange}
              required
            >
              <option value="">Pilih jenis kelamin</option>
              <option value="Laki-laki">Laki-laki</option>
              <option value="Perempuan">Perempuan</option>
            </select>
          </div>

          <div className="profile-field">
            <label>Berat Badan (kg)</label>
            <input
              type="number"
              name="weight"
              min="1"
              step="0.1"
              placeholder="Contoh: 55"
              value={profile.weight}
              onChange={handleProfileChange}
              required
            />
          </div>

          <div className="profile-field">
            <label>Tinggi Badan (cm)</label>
            <input
              type="number"
              name="height"
              min="1"
              step="0.1"
              placeholder="Contoh: 165"
              value={profile.height}
              onChange={handleProfileChange}
              required
            />
          </div>

          <div className="profile-field">
            <label>Pengalaman Berlari</label>
            <select
              name="experience"
              value={profile.experience}
              onChange={handleProfileChange}
              required
            >
              <option value="">Pilih pengalaman</option>
              <option value="Pemula">Pemula</option>
              <option value="Menengah">Menengah</option>
              <option value="Berpengalaman">Berpengalaman</option>
            </select>
          </div>

          <div className="profile-field profile-field-full">
            <label>Target Lari</label>
            <select
              name="target"
              value={profile.target}
              onChange={handleProfileChange}
              required
            >
              <option value="">Pilih target</option>
              <option value="5K">Mampu berlari 5K</option>
              <option value="10K">Mampu berlari 10K</option>
              <option value="Half Marathon">Half Marathon</option>
              <option value="Marathon">Marathon</option>
              <option value="Menjaga Kebugaran">
                Menjaga kebugaran
              </option>
            </select>
          </div>
        </div>

        <button type="submit" className="profile-save-button">
          Simpan Perubahan
        </button>
      </form>
    </div>

    <div className="profile-account-card">
      <div>
        <h2>Pengaturan Akun</h2>
        <p>Keluar dari akun RunSisten pada perangkat ini.</p>
      </div>

      <button
        type="button"
        className="profile-logout-button"
        onClick={handleLogout}
      >
        Keluar dari Akun
      </button>
    </div>
  </section>
)}

                 </main>
      </div>
    )}
  </>
)
}

export default App