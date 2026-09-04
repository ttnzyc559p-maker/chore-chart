import { useState, useEffect } from "react";
import { ref, onValue, push, remove } from "firebase/database";
import { db } from "./firebase";

const COLORS = [
  { bg: "#FF6B6B", light: "#FFE5E5", text: "#C0392B", emoji: "🌟" },
  { bg: "#4ECDC4", light: "#E0F8F7", text: "#1A9E95", emoji: "🚀" },
  { bg: "#FFD93D", light: "#FFF8DC", text: "#B8860B", emoji: "🎯" },
];

const GOAL_MILES = 100;
const MILESTONES = [
  { at: 25, emoji: "🥉", label: "25 miles" },
  { at: 50, emoji: "🥈", label: "50 miles" },
  { at: 75, emoji: "🥇", label: "75 miles" },
  { at: 100, emoji: "🏆", label: "100 MILES!" },
];
const QUICK_ADDS = [0.25, 0.5, 1];

function formatMiles(m) {
  return (Math.round(m * 100) / 100).toString();
}

function formatWhen(ts) {
  const d = new Date(ts);
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (d.toDateString() === today) return "Today";
  if (d.toDateString() === yesterday) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function MileClub() {
  const [names, setNames] = useState(["Child 1", "Child 2", "Child 3"]);
  const [log, setLog] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [syncStatus, setSyncStatus] = useState("");
  const [customFor, setCustomFor] = useState(null);
  const [customMiles, setCustomMiles] = useState("");
  const [showLog, setShowLog] = useState(false);

  // Names are shared with the chore chart, so renaming there renames here too
  useEffect(() => {
    const logRef = ref(db, "mileclub/log");
    const namesRef = ref(db, "chores/names");

    const unsubLog = onValue(logRef, (snap) => {
      setLog(snap.val() || {});
      setLoadError(null);
      setLoading(false);
    }, (err) => {
      console.error("Failed to load miles", err);
      setLoadError(err);
      setLoading(false);
    });

    const unsubNames = onValue(namesRef, (snap) => {
      if (snap.val()) setNames(snap.val().slice(0, 3));
    }, (err) => {
      console.error("Failed to load names", err);
    });

    return () => { unsubLog(); unsubNames(); };
  }, []);

  const addMiles = async (kidIdx, miles) => {
    const m = Number(miles);
    if (!m || m <= 0 || m > 30) return;
    setSyncStatus("saving");
    try {
      await push(ref(db, "mileclub/log"), { kid: kidIdx, miles: m, ts: Date.now() });
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus(""), 1800);
    } catch {
      setSyncStatus("error");
    }
  };

  const removeEntry = async (id) => {
    setSyncStatus("saving");
    try {
      await remove(ref(db, `mileclub/log/${id}`));
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus(""), 1800);
    } catch {
      setSyncStatus("error");
    }
  };

  const submitCustom = (kidIdx) => {
    addMiles(kidIdx, parseFloat(customMiles));
    setCustomFor(null);
    setCustomMiles("");
  };

  const entries = Object.entries(log)
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => b.ts - a.ts);

  const totals = [0, 0, 0];
  for (const e of entries) {
    if (e.kid >= 0 && e.kid < 3) totals[e.kid] += Number(e.miles) || 0;
  }

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
      <div style={{ fontSize: "3rem" }}>🏃</div>
      <div style={{ fontFamily: "sans-serif", fontWeight: 700, color: "#888", fontSize: "1.1rem" }}>Loading Mile Club…</div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Nunito', sans-serif", minHeight: "100vh", background: "#F7F3EE", padding: "24px 16px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');
        * { box-sizing: border-box; }
        .kid-card { transition: box-shadow 0.2s ease; }
        .kid-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
        .mile-btn { transition: all 0.15s ease; cursor: pointer; border: none; font-family: 'Nunito', sans-serif; font-weight: 800; }
        .mile-btn:hover { transform: translateY(-2px); }
        .mile-btn:active { transform: scale(0.95); }
        .log-row { transition: background 0.15s ease; }
        .log-row:hover { background: #FAF7F2; }
        @keyframes pop { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .animate-pop { animation: pop 0.2s ease forwards; }
        @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
        .sync { animation: fadein 0.2s ease; font-size: 0.75rem; font-weight: 700; }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <h1 style={{ fontFamily: "'Fredoka One', cursive", fontSize: "clamp(2rem, 6vw, 3.2rem)", color: "#2D2D2D", margin: 0, letterSpacing: "1px" }}>
          🏃 Mile Club
        </h1>
        <p style={{ color: "#888", fontSize: "1rem", fontWeight: 600, margin: "6px 0 4px" }}>
          Run, walk, or jog — every lap counts toward {GOAL_MILES} miles! 🏆
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
          <span style={{ fontSize: "0.72rem", color: "#bbb", fontWeight: 700 }}>
            Miles sync across all devices in real time
          </span>
          {syncStatus === "saving" && <span className="sync" style={{ color: "#aaa" }}>⏳ Saving…</span>}
          {syncStatus === "saved"  && <span className="sync" style={{ color: "#6BCB77" }}>✓ Synced</span>}
          {syncStatus === "error"  && <span className="sync" style={{ color: "#FF6B6B" }}>⚠ Sync error</span>}
        </div>
      </div>

      {/* Kid Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
        {names.map((name, kidIdx) => {
          const color = COLORS[kidIdx];
          const total = totals[kidIdx];
          const earned = MILESTONES.filter((m) => total >= m.at);
          const next = MILESTONES.find((m) => total < m.at);
          const pct = Math.min((total / GOAL_MILES) * 100, 100);
          const isMember = total >= GOAL_MILES;

          return (
            <div key={kidIdx} className="kid-card"
              style={{
                background: "white", borderRadius: "20px", overflow: "hidden",
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                border: isMember ? `2px solid ${color.bg}` : "2px solid transparent",
              }}
            >
              {/* Card Header */}
              <div style={{ background: color.bg, padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.5rem" }}>{color.emoji}</span>
                <div>
                  <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: "1.2rem", color: "white" }}>{name}</div>
                  <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.8)", fontWeight: 700 }}>
                    {isMember ? "🏆 MILE CLUB MEMBER!" : next ? `NEXT UP: ${next.emoji} ${next.label.toUpperCase()}` : "KEEP GOING!"}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: "1.5rem", color: "white", lineHeight: 1 }}>
                    {formatMiles(total)}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.8)", fontWeight: 800 }}>MILES</div>
                </div>
              </div>

              {/* Progress toward goal */}
              <div style={{ padding: "14px 16px 4px" }}>
                <div style={{ background: color.light, borderRadius: "10px", height: "12px", overflow: "hidden", position: "relative" }}>
                  <div style={{
                    background: color.bg, height: "100%",
                    width: `${pct}%`,
                    borderRadius: "10px", transition: "width 0.4s ease",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                  {MILESTONES.map((m) => (
                    <span key={m.at} title={m.label} style={{
                      fontSize: "1.05rem",
                      filter: total >= m.at ? "none" : "grayscale(1) opacity(0.35)",
                      transition: "filter 0.3s ease",
                    }}>
                      {m.emoji}
                    </span>
                  ))}
                </div>
                {earned.length > 0 && !isMember && (
                  <div style={{ fontSize: "0.72rem", color: "#aaa", fontWeight: 700, marginTop: "2px" }}>
                    {formatMiles(GOAL_MILES - total)} miles to the club!
                  </div>
                )}
              </div>

              {/* Add miles */}
              <div style={{ padding: "12px 16px 16px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                {QUICK_ADDS.map((m) => (
                  <button key={m} className="mile-btn"
                    onClick={() => addMiles(kidIdx, m)}
                    style={{
                      background: color.light, color: color.text, borderRadius: "20px",
                      padding: "8px 14px", fontSize: "0.85rem",
                    }}
                  >
                    +{m === 0.25 ? "¼" : m === 0.5 ? "½" : m} mi
                  </button>
                ))}
                {customFor === kidIdx ? (
                  <span className="animate-pop" style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                    <input
                      type="number" step="0.05" min="0.05" max="30" autoFocus
                      value={customMiles}
                      placeholder="miles"
                      onChange={(e) => setCustomMiles(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submitCustom(kidIdx)}
                      style={{ width: "70px", border: `2px solid ${color.bg}`, borderRadius: "10px", padding: "6px 8px", fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "#555", outline: "none" }}
                    />
                    <button className="mile-btn" onClick={() => submitCustom(kidIdx)}
                      style={{ background: color.bg, color: "white", borderRadius: "20px", padding: "8px 14px", fontSize: "0.85rem" }}>
                      Add
                    </button>
                  </span>
                ) : (
                  <button className="mile-btn"
                    onClick={() => { setCustomFor(kidIdx); setCustomMiles(""); }}
                    style={{ background: "white", color: "#888", border: "2px dashed #ddd", borderRadius: "20px", padding: "6px 12px", fontSize: "0.85rem" }}
                  >
                    other…
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent activity */}
      <div style={{ maxWidth: "560px", margin: "24px auto 0" }}>
        <button className="mile-btn" onClick={() => setShowLog(!showLog)}
          style={{
            display: "block", margin: "0 auto", background: "white", color: "#888",
            borderRadius: "20px", padding: "8px 18px", fontSize: "0.85rem",
            boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          }}
        >
          {showLog ? "Hide recent runs ▲" : `Recent runs (${entries.length}) ▼`}
        </button>
        {showLog && (
          <div className="animate-pop" style={{ background: "white", borderRadius: "16px", marginTop: "12px", padding: "8px 0", boxShadow: "0 4px 14px rgba(0,0,0,0.08)" }}>
            {entries.length === 0 && (
              <div style={{ padding: "16px", textAlign: "center", color: "#aaa", fontWeight: 700, fontSize: "0.9rem" }}>
                No runs logged yet — lace up! 👟
              </div>
            )}
            {entries.slice(0, 12).map((e) => (
              <div key={e.id} className="log-row" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 16px" }}>
                <span style={{ fontSize: "1.1rem" }}>{COLORS[e.kid]?.emoji || "🏃"}</span>
                <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "#444" }}>{names[e.kid] || "?"}</span>
                <span style={{ fontWeight: 700, fontSize: "0.9rem", color: COLORS[e.kid]?.text || "#666" }}>
                  {formatMiles(Number(e.miles) || 0)} mi
                </span>
                <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#bbb", fontWeight: 700 }}>{formatWhen(e.ts)}</span>
                <button
                  onClick={() => removeEntry(e.id)}
                  title="Remove this entry"
                  style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: "0.9rem", fontWeight: 900, padding: "2px 4px" }}
                >
                  ✕
                </button>
              </div>
            ))}
            {entries.length > 12 && (
              <div style={{ padding: "6px 16px", textAlign: "center", color: "#ccc", fontWeight: 700, fontSize: "0.75rem" }}>
                …and {entries.length - 12} more
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: "28px", color: "#bbb", fontSize: "0.8rem", fontWeight: 700 }}>
        Tap a button after each run 👟 &nbsp;•&nbsp; Milestones at 25, 50, 75 &amp; 100 miles
      </div>
    </div>
  );
}
