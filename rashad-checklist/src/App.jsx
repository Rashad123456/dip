import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const questions = [
  "মনে কর তুমি আর ১৪ দিন বাঁচবা। এই ১৪ দিন কী কী করবা?",
  "তোমার কাজটা পৃথিবীর জন্য কতটা দরকার হবে?",
  "কাজটা করে তুমি কি টাকা ইনকাম করতে পারবা?",
  "১৪ দিন পর যদি তুমি মারা না যাও, ১৫তম দিন নিজেকে কোথায় দেখতে চাও?"
];

const DAYS_TO_TRACK = 14;
const reflectionDuration = 20 * 60;
const meditationDuration = 10 * 60;

const dipMessages = [
  "Dip, আজকে তোমার মন নরম থাকুক, শান্ত থাকুক, আর একটু একটু করে আলোয় ভরে উঠুক।",
  "তুমি ক্লান্ত হতে পারো, কিন্তু তুমি ভাঙা নও। তুমি healing-এর ভিতর দিয়ে যাচ্ছ।",
  "আজ শুধু নিজেকে একটু সময় দাও। সব ঠিক করার দরকার নেই, শুধু নিজেকে একটু জড়িয়ে ধরো।",
  "তোমার মন ভালো থাকার অধিকার আছে। আজকের দিনটা কোমল, সুন্দর আর হালকা হোক।",
  "তুমি অনেক মূল্যবান। তোমার অনুভূতি, তোমার স্বপ্ন, তোমার অস্তিত্ব—সবকিছুই সুন্দর।",
  "আজ ছোট ছোট যত্নই বড় পরিবর্তন আনবে—একটু শ্বাস, একটু ভাবনা, একটু শান্তি।"
];

const notes = [
  "আজ perfection না, peace চাই।",
  "ধীরে চললেও তুমি এগোচ্ছো।",
  "নিজের সাথে নরম থেকো।",
  "ছোট progress-ও progress।"
];

let sharedAudioContext = null;

function getSharedAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioContextClass();
  }
  return sharedAudioContext;
}

function formatTime(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${mins}:${secs}`;
}

function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getDayNumber(startDate) {
  const start = new Date(startDate);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - start) / (1000 * 60 * 60 * 24));
  return diff + 1;
}

function createAudioContext() {
  return getSharedAudioContext();
}

function playSoftBell() {
  const ctx = createAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const tone = (freq, start, duration, volume) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  };

  tone(432, now, 1.1, 0.05);
  tone(528, now + 0.18, 1.2, 0.04);
  tone(639, now + 0.32, 1.35, 0.03);
}

function playMeditationMusic() {
  const ctx = createAudioContext();
  if (!ctx) return null;

  const master = ctx.createGain();
  master.gain.value = 0.05;
  master.connect(ctx.destination);

  const baseFreqs = [174.61, 220, 261.63, 329.63];
  const oscillators = [];

  baseFreqs.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = index % 2 === 0 ? "sine" : "triangle";
    osc.frequency.value = freq;
    gain.gain.value = 0.0001;

    osc.connect(gain);
    gain.connect(master);
    osc.start();

    gain.gain.exponentialRampToValueAtTime(0.012 + index * 0.003, ctx.currentTime + 1.1);
    oscillators.push({ osc, gain });
  });

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = "sine";
  lfo.frequency.value = 0.06;
  lfoGain.gain.value = 14;
  lfo.connect(lfoGain);
  lfo.start();

  oscillators.forEach(({ osc }) => {
    lfoGain.connect(osc.frequency);
  });

  return {
    stop: () => {
      const stopAt = ctx.currentTime + 1.2;
      oscillators.forEach(({ osc, gain }) => {
        gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
        try {
          osc.stop(stopAt + 0.1);
        } catch {}
      });

      try {
        lfo.stop(stopAt + 0.1);
      } catch {}
    }
  };
}

function App() {
  const todayKey = getDateKey();

  const reflectionIntervalRef = useRef(null);
  const meditationIntervalRef = useRef(null);
  const meditationAudioRef = useRef(null);

  const [activeTab, setActiveTab] = useState("home");
  const [reflectionTime, setReflectionTime] = useState(reflectionDuration);
  const [meditationTime, setMeditationTime] = useState(meditationDuration);
  const [reflectionRunning, setReflectionRunning] = useState(false);
  const [meditationRunning, setMeditationRunning] = useState(false);
  const [todayQuote, setTodayQuote] = useState(dipMessages[0]);
  const [todayNote, setTodayNote] = useState(notes[0]);

  const [tracker, setTracker] = useState(() => {
    try {
      const saved = localStorage.getItem("dip_pro_tracker_v7");
      if (saved) return JSON.parse(saved);
    } catch {}

    return {
      startDate: getDateKey(),
      reflection: {},
      meditationCompleted: {},
      checklist: {},
      notificationsEnabled: false,
      lastReminderCheck: ""
    };
  });

  useEffect(() => {
    localStorage.setItem("dip_pro_tracker_v7", JSON.stringify(tracker));
  }, [tracker]);

  useEffect(() => {
    const dayIndex = new Date().getDate() % dipMessages.length;
    setTodayQuote(dipMessages[dayIndex]);
    setTodayNote(notes[dayIndex % notes.length]);
  }, []);

  const currentDay = Math.min(
    DAYS_TO_TRACK,
    Math.max(1, getDayNumber(tracker.startDate || todayKey))
  );

  const todayReflection = tracker.reflection[todayKey] || {
    q1: 0,
    q2: 0,
    q3: 0,
    q4: 0,
    completed: false
  };

  const todayChecklist = tracker.checklist[todayKey] || {
    glucose: false,
    exercise: false,
    meals: false,
    meditation: false
  };

  const progress = useMemo(() => {
    const checklistDone = Object.values(todayChecklist).filter(Boolean).length;
    const reflectionDone = todayReflection.completed ? 1 : 0;
    const total = 5;
    return Math.min(100, Math.round(((checklistDone + reflectionDone) / total) * 100));
  }, [todayChecklist, todayReflection]);

  const reflectionTotalMinutesToday = Math.floor(
    (todayReflection.q1 + todayReflection.q2 + todayReflection.q3 + todayReflection.q4) / 60
  );

  const last14Days = useMemo(() => {
    const base = new Date(tracker.startDate || todayKey);

    return Array.from({ length: DAYS_TO_TRACK }, (_, i) => {
      const date = addDays(base, i);
      const key = getDateKey(date);
      const reflection = tracker.reflection[key] || {
        q1: 0,
        q2: 0,
        q3: 0,
        q4: 0,
        completed: false
      };

      return {
        key,
        reflection,
        meditation: Boolean(tracker.meditationCompleted[key]),
        dayNumber: i + 1
      };
    });
  }, [tracker, todayKey]);

  const checklistHistory = useMemo(() => {
    const base = new Date(tracker.startDate || todayKey);

    return Array.from({ length: DAYS_TO_TRACK }, (_, i) => {
      const date = addDays(base, i);
      const key = getDateKey(date);
      const item = tracker.checklist[key] || {
        glucose: false,
        exercise: false,
        meals: false,
        meditation: false
      };
      const totalDone = Object.values(item).filter(Boolean).length;

      return { key, item, totalDone, dayNumber: i + 1 };
    });
  }, [tracker, todayKey]);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      setTracker((prev) => ({ ...prev, notificationsEnabled: true }));
    }
  }, []);

  useEffect(() => {
    if (!reflectionRunning) return;

    reflectionIntervalRef.current = setInterval(() => {
      setReflectionTime((prev) => {
        if (prev <= 1) {
          clearInterval(reflectionIntervalRef.current);
          setReflectionRunning(false);
          playSoftBell();

          setTracker((old) => ({
            ...old,
            reflection: {
              ...old.reflection,
              [todayKey]: {
                ...(old.reflection[todayKey] || { q1: 0, q2: 0, q3: 0, q4: 0 }),
                completed: true
              }
            }
          }));

          return 0;
        }

        setTracker((old) => {
          const current = old.reflection[todayKey] || {
            q1: 0,
            q2: 0,
            q3: 0,
            q4: 0,
            completed: false
          };

          const updated = {
            ...current,
            q1: current.q1 + 0.25,
            q2: current.q2 + 0.25,
            q3: current.q3 + 0.25,
            q4: current.q4 + 0.25
          };

          return {
            ...old,
            reflection: {
              ...old.reflection,
              [todayKey]: updated
            }
          };
        });

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(reflectionIntervalRef.current);
  }, [reflectionRunning, todayKey]);

  useEffect(() => {
    if (!meditationRunning) return;

    meditationIntervalRef.current = setInterval(() => {
      setMeditationTime((prev) => {
        if (prev <= 1) {
          clearInterval(meditationIntervalRef.current);
          setMeditationRunning(false);

          meditationAudioRef.current?.stop?.();
          meditationAudioRef.current = null;

          playSoftBell();

          setTracker((old) => ({
            ...old,
            meditationCompleted: {
              ...old.meditationCompleted,
              [todayKey]: true
            },
            checklist: {
              ...old.checklist,
              [todayKey]: {
                ...(old.checklist[todayKey] || {}),
                meditation: true
              }
            }
          }));

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(meditationIntervalRef.current);
  }, [meditationRunning, todayKey]);

  useEffect(() => {
    const yesterday = getDateKey(addDays(new Date(), -1));
    const hadYesterdayReflection = Boolean(tracker.reflection[yesterday]?.completed);
    const hadYesterdayMeditation = Boolean(tracker.meditationCompleted[yesterday]);
    const alreadyChecked = tracker.lastReminderCheck === todayKey;

    if (!alreadyChecked && currentDay > 1 && (!hadYesterdayReflection || !hadYesterdayMeditation)) {
      const message = "গতকাল একটু miss হয়েছে। আজ Dip-এর জন্য নরমভাবে আবার শুরু করি 💛";
      alert(message);

      if (
        tracker.notificationsEnabled &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification("Dip Care Reminder", { body: message });
      }

      setTracker((prev) => ({ ...prev, lastReminderCheck: todayKey }));
    }
  }, [todayKey, tracker, currentDay]);

  const requestNotifications = async () => {
    if (typeof window.Notification === "undefined") {
      alert("এই browser notification support করছে না।");
      return;
    }

    const result = await Notification.requestPermission();
    if (result === "granted") {
      setTracker((prev) => ({ ...prev, notificationsEnabled: true }));
      new Notification("Dip Care Reminder", {
        body: "Miss হলে Dip-এর জন্য gentle reminder দেখাবে 🌷"
      });
    }
  };

  const startReflection = () => setReflectionRunning(true);
  const pauseReflection = () => setReflectionRunning(false);
  const resetReflection = () => {
    setReflectionRunning(false);
    setReflectionTime(reflectionDuration);
  };

  const startMeditation = async () => {
    if (meditationRunning) return;

    const ctx = createAudioContext();
    if (!ctx) {
      alert("এই browser audio support করছে না।");
      return;
    }

    try {
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
    } catch {}

    playSoftBell();
    meditationAudioRef.current?.stop?.();
    meditationAudioRef.current = playMeditationMusic();
    setMeditationRunning(true);
  };

  const pauseMeditation = () => {
    setMeditationRunning(false);
    meditationAudioRef.current?.stop?.();
    meditationAudioRef.current = null;
  };

  const resetMeditation = () => {
    setMeditationRunning(false);
    meditationAudioRef.current?.stop?.();
    meditationAudioRef.current = null;
    setMeditationTime(meditationDuration);
  };

  const toggleCheck = (key) => {
    setTracker((old) => ({
      ...old,
      checklist: {
        ...old.checklist,
        [todayKey]: {
          ...todayChecklist,
          [key]: !todayChecklist[key]
        }
      }
    }));
  };

  const renderHome = () => (
    <section className="tab-panel">
      <div className="hero-card">
        <div className="hero-badge">RASHAD • A gentle healing space for Dip</div>
        <h1>
          <span>Dip Care</span> Reflection Studio
        </h1>
        <p className="subtitle">{todayQuote}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card primary-stat">
          <span className="stat-label">আজকের Progress</span>
          <strong className="stat-value">{progress}%</strong>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-label">আজকের Day</span>
          <strong className="stat-value">Day {currentDay}</strong>
          <small>শুরু করার দিন থেকে auto count হবে</small>
        </div>

        <div className="stat-card note-card">
          <span className="stat-label">Today Note</span>
          <strong className="stat-note">{todayNote}</strong>
          <button className="soft-btn" onClick={requestNotifications}>
            Reminder On
          </button>
        </div>
      </div>

      <div className="home-actions">
        <button className="big-action reflection-action" onClick={() => setActiveTab("reflection")}>
          Reflection এ যাও
        </button>
        <button className="big-action meditation-action" onClick={() => setActiveTab("care")}>
          Care & Meditation
        </button>
      </div>

      <div className="love-note-card">
        <p className="eyebrow">For Dip</p>
        <h2>Little Love Note</h2>
        <p className="love-note">
          Dip, এই spaceটা তোমার জন্য—যাতে তুমি চাপ না নিয়ে, ধীরে ধীরে, নিজের মনটাকে
          একটু safe আর light feel করতে পারো। আজকে সব answer দরকার নেই। শুধু একটু শ্বাস,
          একটু শান্তি, আর একটু নিজের কাছে ফেরা।
        </p>
      </div>
    </section>
  );

  const renderReflection = () => (
    <section className="tab-panel">
      <div className="section-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Deep Inner Work</p>
            <h2>২০ মিনিটের Full Reflection</h2>
          </div>
          <div className="pill">সব ৪টা question</div>
        </div>

        <p className="card-text">
          এখানে একটা question না—প্রতিদিন সবগুলো question নিয়েই ভাবা হবে। timer চলার
          সময় app চারটি প্রশ্নেই সমানভাবে চিন্তার সময় record করবে।
        </p>

        <div className="timer-box reflection-box">
          <div>
            <p className="timer-label">Reflection Session</p>
            <div className="timer">{formatTime(reflectionTime)}</div>
          </div>

          <div className="timer-buttons">
            <button onClick={startReflection}>Start</button>
            <button onClick={pauseReflection}>Pause</button>
            <button onClick={resetReflection}>Reset</button>
          </div>
        </div>

        <div className="question-grid">
          {questions.map((question, index) => {
            const seconds = todayReflection[`q${index + 1}`] || 0;

            return (
              <div key={question} className="question-card">
                <div className="question-top">
                  <span className="question-number">0{index + 1}</span>
                  <span className="question-time">
                    {Math.floor(seconds / 60)}মি {Math.floor(seconds % 60)}সে
                  </span>
                </div>
                <p>{question}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );

  const renderCare = () => (
    <section className="tab-panel">
      <div className="section-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Calm Sound Space</p>
            <h2>১০ মিনিট Meditation</h2>
          </div>
          <div className="pill pill-warm">music + bell</div>
        </div>

        <p className="card-text">
          timer চলার পুরো সময় soft ambient meditation music বাজবে। শুরু আর শেষে gentle
          bell থাকবে।
        </p>

        <div className="timer-box meditation-box">
          <div>
            <p className="timer-label">Meditation Session</p>
            <div className="timer">{formatTime(meditationTime)}</div>
          </div>

          <div className="timer-buttons">
            <button onClick={startMeditation}>Start</button>
            <button onClick={pauseMeditation}>Pause</button>
            <button onClick={resetMeditation}>Reset</button>
          </div>
        </div>

        <div className="soft-panel">
          <div className="soft-mini-card">
            <span>Start bell</span>
            <strong>Gentle</strong>
          </div>
          <div className="soft-mini-card">
            <span>Music mood</span>
            <strong>Calm ambient</strong>
          </div>
          <div className="soft-mini-card">
            <span>End bell</span>
            <strong>Peaceful</strong>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Body & Balance</p>
            <h2>Daily Care Checklist</h2>
          </div>
          <div className="pill pill-soft">soft daily care</div>
        </div>

        <div className="care-item" onClick={() => toggleCheck("glucose")}>
          <div>
            <strong>Glucose</strong>
            <p>আজ energy support নেওয়া হয়েছে</p>
          </div>
          <input type="checkbox" checked={todayChecklist.glucose || false} readOnly />
        </div>

        <div className="care-item" onClick={() => toggleCheck("exercise")}>
          <div>
            <strong>Exercise</strong>
            <p>আজ শরীরকে একটু active রাখা হয়েছে</p>
          </div>
          <input type="checkbox" checked={todayChecklist.exercise || false} readOnly />
        </div>

        <div className="care-item" onClick={() => toggleCheck("meals")}>
          <div>
            <strong>Meals</strong>
            <p>সময়মতো খাওয়া-দাওয়া হয়েছে</p>
          </div>
          <input type="checkbox" checked={todayChecklist.meals || false} readOnly />
        </div>

        <div className="care-item" onClick={() => toggleCheck("meditation")}>
          <div>
            <strong>Meditation</strong>
            <p>আজ ১০ মিনিটের calm session complete</p>
          </div>
          <input type="checkbox" checked={todayChecklist.meditation || false} readOnly />
        </div>
      </div>
    </section>
  );

  const renderRecord = () => (
    <section className="tab-panel">
      <div className="section-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Smart Record</p>
            <h2>১৪ দিনের Healing Timeline</h2>
          </div>
          <div className="pill pill-smart">reflection + meditation</div>
        </div>

        <div className="record-list">
          {last14Days.map((day) => {
            const totalMin = Math.floor(
              (day.reflection.q1 + day.reflection.q2 + day.reflection.q3 + day.reflection.q4) / 60
            );

            const missed =
              day.dayNumber < currentDay && !day.reflection.completed && !day.meditation;

            return (
              <div
                className={`record-item ${day.dayNumber === currentDay ? "today-record" : ""} ${
                  missed ? "missed-record" : ""
                }`}
                key={day.key}
              >
                <div className="record-left">
                  <span className="record-day">Day {day.dayNumber}</span>
                  <p>Reflection & Calm</p>
                </div>

                <div className="record-right">
                  <span>ভাবা {totalMin}মি</span>
                  <span>{day.meditation ? "Meditation done" : "Meditation pending"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Checklist Record</p>
            <h2>১৪ দিনের Daily Care Record</h2>
          </div>
          <div className="pill pill-soft">body care tracking</div>
        </div>

        <div className="record-list">
          {checklistHistory.map((day) => (
            <div
              className={`record-item ${day.dayNumber === currentDay ? "today-record" : ""}`}
              key={day.key}
            >
              <div className="record-left">
                <span className="record-day">Day {day.dayNumber}</span>
                <p>Care status</p>
              </div>

              <div className="record-right">
                <span>{day.totalDone}/4 care done</span>
                <span>
                  G {day.item.glucose ? "✓" : "✗"} · E {day.item.exercise ? "✓" : "✗"} ·
                  M {day.item.meals ? "✓" : "✗"} · D {day.item.meditation ? "✓" : "✗"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  return (
    <div className="app dreamy-bg">
      <div className="blob blob-a"></div>
      <div className="blob blob-b"></div>
      <div className="blob blob-c"></div>

      <div className="container">
        <div className="desktop-shell">
          {activeTab === "home" && renderHome()}
          {activeTab === "reflection" && renderReflection()}
          {activeTab === "care" && renderCare()}
          {activeTab === "record" && renderRecord()}
        </div>
      </div>

      <nav className="bottom-nav">
        <button
          className={activeTab === "home" ? "nav-btn active-nav" : "nav-btn"}
          onClick={() => setActiveTab("home")}
        >
          Home
        </button>
        <button
          className={activeTab === "reflection" ? "nav-btn active-nav" : "nav-btn"}
          onClick={() => setActiveTab("reflection")}
        >
          Reflection
        </button>
        <button
          className={activeTab === "care" ? "nav-btn active-nav" : "nav-btn"}
          onClick={() => setActiveTab("care")}
        >
          Care
        </button>
        <button
          className={activeTab === "record" ? "nav-btn active-nav" : "nav-btn"}
          onClick={() => setActiveTab("record")}
        >
          Record
        </button>
      </nav>
    </div>
  );
}

export default App;