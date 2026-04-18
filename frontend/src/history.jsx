import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppNavbar } from "./dashboard";
import "./dash.css";

const urgencyColor = { Routine: "#2ecc71", Soon: "#f39c12", Urgent: "#e74c3c" };
const likelColor   = { High: "#e74c3c",    Medium: "#f39c12", Low: "#2ecc71" };

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    + " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function History() {
  const [entries, setEntries] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("sm_history") || "[]");
      setEntries(saved);
    } catch (_) {}
  }, []);

  const clearHistory = () => {
    if (!window.confirm("Clear all history?")) return;
    localStorage.removeItem("sm_history");
    setEntries([]);
  };

  const deleteEntry = (id) => {
    const updated = entries.filter((e) => e.id !== id);
    localStorage.setItem("sm_history", JSON.stringify(updated));
    setEntries(updated);
    if (expanded === id) setExpanded(null);
  };

  return (
    <>
      <AppNavbar />
      <div className="dashboard">

        <section className="top">
          <h1>Your <span>Analysis History</span></h1>
          <p>Review your past symptom checks and AI results</p>
        </section>

        {entries.length === 0 ? (
          <div className="history-empty">
            <div className="history-empty-icon">📋</div>
            <h3>No history yet</h3>
            <p>Run your first symptom analysis from the Dashboard.</p>
            <button className="analyze" style={{ maxWidth: 240, margin: "0 auto" }} onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </button>
          </div>
        ) : (
          <>
            <div className="history-topbar">
              <span className="history-count">{entries.length} analysis{entries.length !== 1 ? "es" : ""}</span>
              <button className="history-clear-btn" onClick={clearHistory}>Clear all</button>
            </div>

            <div className="history-list">
              {entries.map((entry) => {
                const isOpen = expanded === entry.id;
                const urg    = entry.result?.urgency;

                return (
                  <div key={entry.id} className={`history-card ${isOpen ? "open" : ""}`}>

                    {/* HEADER ROW */}
                    <div className="history-card-header" onClick={() => setExpanded(isOpen ? null : entry.id)}>
                      <div className="history-card-meta">
                        <span className="history-date">{formatDate(entry.date)}</span>
                        {urg && (
                          <span className="urgency-badge small" style={{
                            background: urgencyColor[urg] + "22",
                            color: urgencyColor[urg],
                            border: `1px solid ${urgencyColor[urg]}44`
                          }}>
                            {urg === "Urgent" ? "⚠ " : urg === "Soon" ? "⏱ " : "✓ "}{urg}
                          </span>
                        )}
                      </div>

                      <div className="history-card-symptoms">
                        {entry.symptoms?.slice(0, 5).map((s) => (
                          <span key={s} className="hist-symptom-tag">{s}</span>
                        ))}
                        {entry.symptoms?.length > 5 && (
                          <span className="hist-symptom-tag muted">+{entry.symptoms.length - 5} more</span>
                        )}
                      </div>

                      <div className="history-card-actions">
                        <span className="hist-toggle">{isOpen ? "▲ Hide" : "▼ View"}</span>
                        <button
                          className="hist-delete-btn"
                          onClick={(e) => { e.stopPropagation(); deleteEntry(entry.id); }}
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* EXPANDED DETAIL */}
                    {isOpen && entry.result && (
                      <div className="history-detail">

                        {entry.result.advice && (
                          <div className="ai-advice" style={{ marginBottom: 16 }}>
                            <span className="advice-icon">💬</span>
                            <p>{entry.result.advice}</p>
                          </div>
                        )}

                        <h4 className="history-sub">Possible Conditions</h4>
                        {entry.result.conditions?.map((c, i) => (
                          <div className="condition" key={i} style={{ marginBottom: 10 }}>
                            <div className="condition-header">
                              <h3>{c.name}</h3>
                              <span className="likelihood" style={{
                                color: likelColor[c.likelihood],
                                background: likelColor[c.likelihood] + "15"
                              }}>
                                {c.likelihood} likelihood
                              </span>
                            </div>
                            <p>{c.description}</p>
                            {c.specialist && (
                              <div className="specialist-tag"><span>👨‍⚕️ {c.specialist}</span></div>
                            )}
                          </div>
                        ))}

                        {entry.result.disclaimer && (
                          <div className="disclaimer" style={{ marginTop: 8 }}>
                            <span>⚠️</span>
                            <p>{entry.result.disclaimer}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
