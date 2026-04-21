import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import AppNavbar from "../components/AppNavbar";
import { apiFetch } from "../lib/api";
import { loadIsAdminByUid } from "../lib/admin";
import "../styles/dash.css";

const urgencyColor = { Routine: "#2ecc71", Soon: "#f39c12", Urgent: "#e74c3c" };
const likelColor = { High: "#e74c3c", Medium: "#f39c12", Low: "#2ecc71" };

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return (
    d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

export default function History() {
  const [entries, setEntries] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const navigate = useNavigate();

  // Auth guard
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) navigate("/login");
      else {
        const isAdmin = await loadIsAdminByUid(user.uid);
        if (isAdmin) {
          navigate("/doctors");
          return;
        }
        setAuthChecked(true);
      }
    });
    return unsub;
  }, [navigate]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/history");
      setEntries(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      console.error("/history failed:", err);
      setError(
        err?.message ||
          "Could not load history. Please check the backend is running."
      );
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchHistory();
  }, [authChecked, fetchHistory]);

  const deleteEntry = async (id) => {
    if (!id) return;
    setDeletingId(id);
    setError("");
    try {
      await apiFetch(`/history/${encodeURIComponent(id)}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (expanded === id) setExpanded(null);
    } catch (err) {
      console.error("Delete history failed:", err);
      setError(err?.message || "Could not delete this entry.");
    } finally {
      setDeletingId("");
    }
  };

  const clearHistory = async () => {
    if (!entries.length) return;
    if (
      !window.confirm(
        `Clear all ${entries.length} saved analyses? This cannot be undone.`
      )
    ) {
      return;
    }
    setError("");
    // Delete sequentially so we surface useful feedback if any one fails.
    for (const entry of entries) {
      try {
        await apiFetch(`/history/${encodeURIComponent(entry.id)}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error("Delete failed for", entry.id, err);
        setError(
          `Partial clear — could not delete one or more entries: ${
            err?.message || "unknown error"
          }`
        );
        // Refetch so the UI reflects what actually got deleted
        fetchHistory();
        return;
      }
    }
    setEntries([]);
    setExpanded(null);
  };

  if (!authChecked) return null;

  return (
    <>
      <AppNavbar />
      <div className="dashboard">
        <section className="top">
          <h1>
            Your <span>Analysis History</span>
          </h1>
          <p>Review your past symptom checks and AI results</p>
        </section>

        {error && <div className="dash-error">{error}</div>}

        {loading ? (
          <div className="loader">
            <div className="spinner"></div>
            <p>Loading your history…</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="history-empty">
            <div className="history-empty-icon">📋</div>
            <h3>No history yet</h3>
            <p>Run your first symptom analysis from the Dashboard.</p>
            <button
              className="analyze"
              style={{ maxWidth: 240, margin: "0 auto" }}
              onClick={() => navigate("/dashboard")}
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <>
            <div className="history-topbar">
              <span className="history-count">
                {entries.length} analysis{entries.length !== 1 ? "es" : ""}
              </span>
              <button className="history-clear-btn" onClick={clearHistory}>
                Clear all
              </button>
            </div>

            <div className="history-list">
              {entries.map((entry) => {
                const isOpen = expanded === entry.id;
                const result = entry.aiResult || {};
                const urg = result.urgency;

                return (
                  <div
                    key={entry.id}
                    className={`history-card ${isOpen ? "open" : ""}`}
                  >
                    <div
                      className="history-card-header"
                      onClick={() => setExpanded(isOpen ? null : entry.id)}
                    >
                      <div className="history-card-meta">
                        <span className="history-date">
                          {formatDate(entry.createdAt)}
                        </span>
                        {urg && (
                          <span
                            className="urgency-badge small"
                            style={{
                              background:
                                (urgencyColor[urg] || "#2ecc71") + "22",
                              color: urgencyColor[urg] || "#2ecc71",
                              border: `1px solid ${(urgencyColor[urg] || "#2ecc71")}44`,
                            }}
                          >
                            {urg === "Urgent"
                              ? "⚠ "
                              : urg === "Soon"
                              ? "⏱ "
                              : "✓ "}
                            {urg}
                          </span>
                        )}
                      </div>

                      <div className="history-card-symptoms">
                        {entry.symptoms?.slice(0, 5).map((s) => (
                          <span key={s} className="hist-symptom-tag">
                            {s}
                          </span>
                        ))}
                        {entry.symptoms?.length > 5 && (
                          <span className="hist-symptom-tag muted">
                            +{entry.symptoms.length - 5} more
                          </span>
                        )}
                      </div>

                      <div className="history-card-actions">
                        <span className="hist-toggle">
                          {isOpen ? "▲ Hide" : "▼ View"}
                        </span>
                        <button
                          className="hist-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteEntry(entry.id);
                          }}
                          disabled={deletingId === entry.id}
                          title="Delete"
                        >
                          {deletingId === entry.id ? "…" : "✕"}
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="history-detail">
                        {result.advice && (
                          <div
                            className="ai-advice"
                            style={{ marginBottom: 16 }}
                          >
                            <span className="advice-icon">💬</span>
                            <p>{result.advice}</p>
                          </div>
                        )}

                        {entry.mlHint?.disease && (
                          <div
                            className="ai-advice"
                            style={{ marginBottom: 16 }}
                          >
                            <span className="advice-icon">🔬</span>
                            <p>
                              Model hint: <strong>{entry.mlHint.disease}</strong>
                              {typeof entry.mlHint.confidence === "number" && (
                                <>
                                  {" "}
                                  ({Math.round(entry.mlHint.confidence * 100)}%)
                                </>
                              )}
                            </p>
                          </div>
                        )}

                        <h4 className="history-sub">Possible Conditions</h4>
                        {result.conditions?.map((c, i) => (
                          <div
                            className="condition"
                            key={i}
                            style={{ marginBottom: 10 }}
                          >
                            <div className="condition-header">
                              <h3>{c.name}</h3>
                              <span
                                className="likelihood"
                                style={{
                                  color:
                                    likelColor[c.likelihood] || "#f39c12",
                                  background:
                                    (likelColor[c.likelihood] || "#f39c12") +
                                    "15",
                                }}
                              >
                                {c.likelihood} likelihood
                              </span>
                            </div>
                            <p>{c.description}</p>
                            {c.specialist && (
                              <div className="specialist-tag">
                                <span>👨‍⚕️ {c.specialist}</span>
                              </div>
                            )}
                          </div>
                        ))}

                        {result.disclaimer && (
                          <div
                            className="disclaimer"
                            style={{ marginTop: 8 }}
                          >
                            <span>⚠️</span>
                            <p>{result.disclaimer}</p>
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
