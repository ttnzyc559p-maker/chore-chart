import { useState, useEffect } from "react";
import App from "./App.jsx";
import MileClub from "./MileClub.jsx";

// #mileclub in the URL opens Mile Club, so each view can be bookmarked
// or added to the home screen separately.
function viewFromHash() {
  return window.location.hash === "#mileclub" ? "mileclub" : "chores";
}

export default function Shell() {
  const [view, setView] = useState(viewFromHash);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const switchTo = (v) => {
    window.location.hash = v === "mileclub" ? "mileclub" : "";
    setView(v);
  };

  const tabStyle = (active) => ({
    border: "none", cursor: "pointer", borderRadius: "20px",
    padding: "8px 16px", fontFamily: "'Nunito', sans-serif",
    fontWeight: 800, fontSize: "0.85rem",
    background: active ? "#2D2D2D" : "white",
    color: active ? "white" : "#666",
    boxShadow: active ? "0 4px 14px rgba(0,0,0,0.2)" : "0 2px 6px rgba(0,0,0,0.08)",
    transition: "all 0.15s ease",
  });

  return (
    <>
      <div style={{
        display: "flex", justifyContent: "center", gap: "8px",
        background: "#F7F3EE", paddingTop: "16px",
      }}>
        <button style={tabStyle(view === "chores")} onClick={() => switchTo("chores")}>
          🏠 Chores
        </button>
        <button style={tabStyle(view === "mileclub")} onClick={() => switchTo("mileclub")}>
          🏃 Mile Club
        </button>
      </div>
      {view === "mileclub" ? <MileClub /> : <App />}
    </>
  );
}
