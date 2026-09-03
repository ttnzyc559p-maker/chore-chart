import { useState, useEffect, useRef } from "react";
import { ref, onValue, set } from "firebase/database";
import { db } from "./firebase";

const COLORS = [
  { bg: "#FF6B6B", light: "#FFE5E5", text: "#C0392B", emoji: "🌟" },
  { bg: "#4ECDC4", light: "#E0F8F7", text: "#1A9E95", emoji: "🚀" },
  { bg: "#FFD93D", light: "#FFF8DC", text: "#B8860B", emoji: "🎯" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Three chore sets rotate one kid to the right each day, so every chore
// passes through all three kids during the week:
//   Set A: Load dishwasher, Wipe kitchen counters, Set dinner table
//   Set B: Unload dishwasher, Take out trash, Dinner cleanup
//   Set C: Tidy living room, Vacuum living room, Clear dinner table
// Friday swaps in its own three sets, continuing the same rotation.
const DAILY_CHORE_ROTATION = [
  // Monday — A, B, C
  [
    ["Load dishwasher", "Wipe kitchen counters", "Set dinner table"],
    ["Unload dishwasher", "Take out trash", "Dinner cleanup"],
    ["Tidy living room", "Vacuum living room", "Clear dinner table"],
  ],
  // Tuesday — C, A, B
  [
    ["Tidy living room", "Vacuum living room", "Clear dinner table"],
    ["Load dishwasher", "Wipe kitchen counters", "Set dinner table"],
    ["Unload dishwasher", "Take out trash", "Dinner cleanup"],
  ],
  // Wednesday — B, C, A
  [
    ["Unload dishwasher", "Take out trash", "Dinner cleanup"],
    ["Tidy living room", "Vacuum living room", "Clear dinner table"],
    ["Load dishwasher", "Wipe kitchen counters", "Set dinner table"],
  ],
  // Thursday — A, B, C
  [
    ["Load dishwasher", "Wipe kitchen counters", "Set dinner table"],
    ["Unload dishwasher", "Take out trash", "Dinner cleanup"],
    ["Tidy living room", "Vacuum living room", "Clear dinner table"],
  ],
  // Friday — Friday sets, rotated C, A, B
  [
    ["Tidy entryway & mudroom", "Vacuum living room", "Clear dinner table"],
    ["Load dishwasher", "Wipe stovetop & microwave", "Set dinner table"],
    ["Unload dishwasher", "Empty all trash cans", "Dinner cleanup"],
  ],
  // Saturday — deep clean (rotates weekly)
  [
    ["Clean upstairs bathroom", "Vacuum all carpets & rugs", "Wipe down stovetop & oven"],
    ["Clean downstairs bathroom", "Dust all furniture & shelves", "Clean microwave inside/out"],
    ["Clean basement bathroom", "Clean windows & mirrors", "Take out basement trash"],
  ],
];

function getWeekKey() {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  const jan4 = new Date(monday.getFullYear(), 0, 4);
  const startOfW1 = new Date(jan4);
  startOfW1.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1));
  const week = Math.round((monday - startOfW1) / 604800000) + 1;
  return `${monday.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

const ALERT_ENABLED_KEY = "chores:alertEnabled";
const ALERT_TIME_KEY = "chores:alertTime";
const ALERT_FIRED_KEY = "chores:alertLastFired";

const WEEK_KEY = getWeekKey();
const WEEK_NUM = parseInt(WEEK_KEY.split("-W")[1], 10);
const SAT_OFFSET = WEEK_NUM % 3;

export default function App() {
  const [names, setNames] = useState(["Child 1", "Child 2", "Child 3"]);
  const [editingName, setEditingName] = useState(null);
  const [activeDay, setActiveDay] = useState(0);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [syncStatus, setSyncStatus] = useState("");
  const saveTimer = useRef(null);

  const notifSupported = typeof Notification !== "undefined";
  const [alertEnabled, setAlertEnabled] = useState(() => {
    try { return localStorage.getItem(ALERT_ENABLED_KEY) === "1"; } catch { return false; }
  });
  const [alertTime, setAlertTime] = useState(() => {
    try { return localStorage.getItem(ALERT_TIME_KEY) || "16:00"; } catch { return "16:00"; }
  });
  const [showAlertSettings, setShowAlertSettings] = useState(false);

  // Service worker lets notifications work on Android and installed home-screen apps
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js").catch(() => {});
    }
  }, []);

  const toggleAlert = async () => {
    if (alertEnabled) {
      setAlertEnabled(false);
      try { localStorage.setItem(ALERT_ENABLED_KEY, "0"); } catch {}
      return;
    }
    if (!notifSupported) return;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;
    setAlertEnabled(true);
    try { localStorage.setItem(ALERT_ENABLED_KEY, "1"); } catch {}
  };

  const updateAlertTime = (t) => {
    setAlertTime(t);
    try { localStorage.setItem(ALERT_TIME_KEY, t); } catch {}
  };

  // Fire the daily alert: at (or after) the chosen time, once per day, never on Sunday
  useEffect(() => {
    if (!alertEnabled || !notifSupported) return;
    const check = async () => {
      const now = new Date();
      if (now.getDay() === 0) return;
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const today = now.toDateString();
      let last = null;
      try { last = localStorage.getItem(ALERT_FIRED_KEY); } catch {}
      if (hhmm < alertTime || last === today || Notification.permission !== "granted") return;
      try { localStorage.setItem(ALERT_FIRED_KEY, today); } catch {}
      const opts = { body: "Time to check off today's chores!" };
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg) { await reg.showNotification("🏠 Chore time!", opts); return; }
      } catch {}
      try { new Notification("🏠 Chore time!", opts); } catch {}
    };
    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
  }, [alertEnabled, alertTime, notifSupported]);

  // Subscribe to Firebase — real-time updates from any device
  useEffect(() => {
    const checkedRef = ref(db, `chores/checked/${WEEK_KEY}`);
    const namesRef = ref(db, "chores/names");

    const unsubChecked = onValue(checkedRef, (snap) => {
      setChecked(snap.val() || {});
      setLoadError(null);
      setLoading(false);
    }, (err) => {
      console.error("Failed to load chores", err);
      setLoadError(err);
      setLoading(false);
    });

    const unsubNames = onValue(namesRef, (snap) => {
      if (snap.val()) setNames(snap.val().slice(0, 3));
    }, (err) => {
      console.error("Failed to load names", err);
    });

    return () => { unsubChecked(); unsubNames(); };
  }, []);

  const saveChecked = (newChecked) => {
    setSyncStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await set(ref(db, `chores/checked/${WEEK_KEY}`), newChecked);
        setSyncStatus("saved");
        setTimeout(() => setSyncStatus(""), 1800);
      } catch {
        setSyncStatus("error");
      }
    }, 400); // debounce rapid taps
  };

  const saveNames = async (newNames) => {
    try {
      await set(ref(db, "chores/names"), newNames);
    } catch (e) {
      console.error("Failed to save names", e);
    }
  };

  const toggleCheck = (day, kid, chore) => {
    const key = `${day}-${kid}-${chore}`;
    const newChecked = { ...checked, [key]: !checked[key] };
    if (!newChecked[key]) delete newChecked[key]; // keep DB clean
    setChecked(newChecked);
    saveChecked(newChecked);
  };

  const updateName = (i, value) => {
    const newNames = [...names];
    newNames[i] = value;
    setNames(newNames);
    saveNames(newNames);
  };

  const isChecked = (day, kid, chore) => !!checked[`${day}-${kid}-${chore}`];
  const isSaturday = activeDay === 5;

  if (loadError) return (
    <div style={{ minHeight: "100vh", background: "#F7F3EE", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "24px", textAlign: "center" }}>
      <div style={{ fontSize: "3rem" }}>🔒</div>
      <div style={{ fontFamily: "sans-serif", fontWeight: 700, color: "#555", fontSize: "1.1rem", maxWidth: "420px" }}>
        Can't reach the family database — its access rules have expired.
      </div>
      <div style={{ fontFamily: "sans-serif", color: "#888", fontSize: "0.95rem", maxWidth: "420px" }}>
        Fix it in the Firebase console: Realtime Database → Rules, then set read and write to true.
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F7F3EE", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
      <div style={{ fontSize: "3rem" }}>🏠</div>
      <div style={{ fontFamily: "sans-serif", fontWeight: 700, color: "#888", fontSize: "1.1rem" }}>Loading chore chart…</div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Nunito', sans-serif", minHeight: "100vh", background: "#F7F3EE", padding: "24px 16px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');
        * { box-sizing: border-box; }
        .day-btn { transition: all 0.15s ease; cursor: pointer; border: none; }
        .day-btn:hover { transform: translateY(-2px); }
        .chore-item { transition: all 0.2s ease; cursor: pointer; }
        .chore-item:hover { transform: translateX(4px); }
        .kid-card { transition: box-shadow 0.2s ease; }
        .kid-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
        .name-input { background: transparent; border: none; border-bottom: 2px dashed rgba(255,255,255,0.6); color: white; font-family: 'Fredoka One', cursive; font-size: 1.3rem; text-align: center; outline: none; width: 100%; padding: 2px 4px; }
        .name-input::placeholder { color: rgba(255,255,255,0.5); }
        .checkbox { width: 20px; height: 20px; border-radius: 6px; border: 2.5px solid currentColor; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; }
        .checkbox:hover { opacity: 0.8; transform: scale(1.1); }
        .badge { display: inline-block; background: linear-gradient(135deg, #FF6B6B, #FF8E53); color: white; border-radius: 20px; padding: 4px 16px; font-size: 0.85rem; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 12px; }
        @keyframes pop { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .animate-pop { animation: pop 0.2s ease forwards; }
        @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
        .sync { animation: fadein 0.2s ease; font-size: 0.75rem; font-weight: 700; }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <h1 style={{ fontFamily: "'Fredoka One', cursive", fontSize: "clamp(2rem, 6vw, 3.2rem)", color: "#2D2D2D", margin: 0, letterSpacing: "1px" }}>
          🏠 Family Chore Chart
        </h1>
        <p style={{ color: "#888", fontSize: "1rem", fontWeight: 600, margin: "6px 0 4px" }}>
          Mon – Sat &nbsp;•&nbsp; No chores on Sunday 🎉
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
          <span style={{ fontSize: "0.72rem", color: "#bbb", fontWeight: 700 }}>
            {WEEK_KEY} &nbsp;•&nbsp; Resets automatically each Monday
          </span>
          {syncStatus === "saving" && <span className="sync" style={{ color: "#aaa" }}>⏳ Saving…</span>}
          {syncStatus === "saved"  && <span className="sync" style={{ color: "#6BCB77" }}>✓ Synced</span>}
          {syncStatus === "error"  && <span className="sync" style={{ color: "#FF6B6B" }}>⚠ Sync error</span>}
          <button
            onClick={() => setShowAlertSettings(!showAlertSettings)}
            style={{
              background: alertEnabled ? "#FFF3D6" : "white", border: "none", borderRadius: "20px",
              padding: "4px 12px", fontFamily: "'Nunito', sans-serif", fontWeight: 800,
              fontSize: "0.75rem", color: alertEnabled ? "#B8860B" : "#888", cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            }}
          >
            {alertEnabled ? `🔔 Daily alert ${alertTime}` : "🔕 Daily alert off"}
          </button>
        </div>
        {showAlertSettings && (
          <div className="animate-pop" style={{
            display: "inline-flex", alignItems: "center", gap: "12px", marginTop: "10px",
            background: "white", borderRadius: "16px", padding: "10px 16px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.1)", fontFamily: "'Nunito', sans-serif",
          }}>
            {notifSupported ? (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 800, fontSize: "0.85rem", color: "#555", cursor: "pointer" }}>
                  <input type="checkbox" checked={alertEnabled} onChange={toggleAlert} style={{ width: "16px", height: "16px", accentColor: "#FFD93D" }} />
                  Remind us at
                </label>
                <input
                  type="time"
                  value={alertTime}
                  onChange={(e) => updateAlertTime(e.target.value)}
                  style={{ border: "2px solid #eee", borderRadius: "10px", padding: "4px 8px", fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "#555" }}
                />
                <span style={{ fontSize: "0.72rem", color: "#aaa", fontWeight: 600, maxWidth: "220px", textAlign: "left" }}>
                  Rings on this device while the chart is open — no alerts on Sundays
                </span>
              </>
            ) : (
              <span style={{ fontSize: "0.8rem", color: "#888", fontWeight: 700 }}>
                This browser can't show alerts — on iPhone/iPad, use Share → Add to Home Screen, then turn the alert on from there.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Kid Name Headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "20px" }}>
        {names.map((name, i) => (
          <div key={i}
            style={{ background: COLORS[i].bg, borderRadius: "16px", padding: "14px 8px", textAlign: "center", cursor: "pointer" }}
            onClick={() => setEditingName(editingName === i ? null : i)}
          >
            <div style={{ fontSize: "2rem", marginBottom: "4px" }}>{COLORS[i].emoji}</div>
            {editingName === i ? (
              <input
                className="name-input"
                value={name}
                autoFocus
                onChange={(e) => updateName(i, e.target.value)}
                onBlur={() => setEditingName(null)}
                onKeyDown={(e) => e.key === "Enter" && setEditingName(null)}
                placeholder="Enter name"
              />
            ) : (
              <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: "1.25rem", color: "white", textShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
                {name}
              </div>
            )}
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.75)", marginTop: "4px", fontWeight: 700 }}>tap to rename</div>
          </div>
        ))}
      </div>

      {/* Day Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", overflowX: "auto", paddingBottom: "4px" }}>
        {DAYS.map((day, i) => (
          <button key={day} className="day-btn" onClick={() => setActiveDay(i)}
            style={{
              padding: "10px 18px", borderRadius: "30px", fontFamily: "'Nunito', sans-serif",
              fontWeight: 800, fontSize: "0.9rem", whiteSpace: "nowrap",
              background: activeDay === i ? "#2D2D2D" : "white",
              color: activeDay === i ? "white" : "#666",
              boxShadow: activeDay === i ? "0 4px 14px rgba(0,0,0,0.2)" : "0 2px 6px rgba(0,0,0,0.08)",
            }}
          >
            {i === 5 ? "🧹 " : ""}{day}
          </button>
        ))}
      </div>

      {/* Saturday Badge */}
      {isSaturday && (
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <span className="badge animate-pop">🧹 Deep Clean Day — Extra scrubbing required! 💪</span>
        </div>
      )}

      {/* Chore Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
        {names.map((name, kidIdx) => {
          const choreIdx = isSaturday
            ? (kidIdx + SAT_OFFSET) % DAILY_CHORE_ROTATION[5].length
            : kidIdx;
          const chores = DAILY_CHORE_ROTATION[activeDay][choreIdx];
          const color = COLORS[kidIdx];
          const doneCount = chores.filter((c) => isChecked(activeDay, kidIdx, c)).length;
          const allDone = doneCount === chores.length;

          return (
            <div key={kidIdx} className="kid-card"
              style={{
                background: "white", borderRadius: "20px", overflow: "hidden",
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                border: allDone ? `2px solid ${color.bg}` : "2px solid transparent",
              }}
            >
              {/* Card Header */}
              <div style={{ background: color.bg, padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.5rem" }}>{color.emoji}</span>
                <div>
                  <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: "1.2rem", color: "white" }}>{name}</div>
                  <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.8)", fontWeight: 700 }}>
                    {DAYS[activeDay].toUpperCase()} {isSaturday ? "DEEP CLEAN" : "CHORES"}
                  </div>
                </div>
                {allDone && (
                  <div style={{ marginLeft: "auto", background: "rgba(255,255,255,0.25)", borderRadius: "20px", padding: "4px 10px", fontSize: "0.8rem", fontWeight: 800, color: "white" }}>
                    ✓ Done!
                  </div>
                )}
              </div>

              {/* Chore List */}
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {chores.map((chore, cIdx) => {
                  const done = isChecked(activeDay, kidIdx, chore);
                  return (
                    <div key={cIdx} className="chore-item"
                      style={{ display: "flex", alignItems: "center", gap: "12px" }}
                      onClick={() => toggleCheck(activeDay, kidIdx, chore)}
                    >
                      <div className="checkbox"
                        style={{ color: color.text, background: done ? color.bg : "transparent", borderColor: done ? color.bg : color.text }}
                      >
                        {done && <span style={{ color: "white", fontSize: "13px", fontWeight: 900 }}>✓</span>}
                      </div>
                      <span style={{
                        fontSize: "0.92rem", fontWeight: 700, lineHeight: 1.3,
                        color: done ? "#bbb" : "#333",
                        textDecoration: done ? "line-through" : "none",
                      }}>
                        {chore}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div style={{ padding: "0 16px 14px" }}>
                <div style={{ background: color.light, borderRadius: "10px", height: "8px", overflow: "hidden" }}>
                  <div style={{
                    background: color.bg, height: "100%",
                    width: `${(doneCount / chores.length) * 100}%`,
                    borderRadius: "10px", transition: "width 0.4s ease",
                  }} />
                </div>
                <div style={{ fontSize: "0.72rem", color: "#aaa", fontWeight: 700, marginTop: "4px", textAlign: "right" }}>
                  {doneCount}/{chores.length} done
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: "center", marginTop: "28px", color: "#bbb", fontSize: "0.8rem", fontWeight: 700 }}>
        Sunday is a rest day 😴 &nbsp;•&nbsp; Progress syncs across all devices in real time
      </div>
    </div>
  );
}
