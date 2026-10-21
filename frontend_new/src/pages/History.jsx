import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import AppNavbar from "../components/AppNavbar";
import { apiFetch } from "../lib/api";
import { loadIsAdminByUid } from "../lib/admin";
import { useTranslation } from "react-i18next";
import "../styles/dash.css";

const urgencyColor = { Routine: "#2ecc71", Soon: "#f39c12", Urgent: "#e74c3c" };
const likelihoodColor = { High: "#e74c3c", Medium: "#f39c12", Low: "#2ecc71" };

function formatDate(iso, lang) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const locale = lang === "ar" ? "ar-TN" : lang === "fr" ? "fr-FR" : "en-GB";
  return (
    date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) +
    " · " +
    date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
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
  const { t, i18n } = useTranslation();

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/history");
      setEntries(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      console.error("/history failed:", err);
      setError(err?.message || t("history.errors.loadFailed"));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login");
        return;
      }
      const isAdmin = await loadIsAdminByUid(user.uid);
      if (isAdmin) {
        navigate("/doctors");
        return;
      }
      setAuthChecked(true);
      fetchHistory();
    });
    return unsub;
  }, [fetchHistory, navigate]);

  const getLikelihoodLabel = (value) => {
    const normalized = String(value || "").toLowerCase();
    if (normalized === "high") return t("common.likelihood.high");
    if (normalized === "medium") return t("common.likelihood.medium");
    return t("common.likelihood.low");
  };

  const deleteEntry = async (id) => {
    if (!id) return;
    if (!window.confirm(t("history.confirmDelete"))) return;

    setDeletingId(id);
    setError("");
    try {
      await apiFetch(`/history/${encodeURIComponent(id)}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      if (expanded === id) setExpanded(null);
    } catch (err) {
      console.error("Delete history failed:", err);
      setError(err?.message || t("history.errors.deleteFailed"));
    } finally {
      setDeletingId("");
    }
  };

  const clearHistory = async () => {
    if (!entries.length) return;
    if (!window.confirm(t("history.confirmClear", { count: entries.length }))) return;

    setError("");
    for (const entry of entries) {
      try {
        await apiFetch(`/history/${encodeURIComponent(entry.id)}`, { method: "DELETE" });
      } catch (err) {
        console.error("Delete failed for", entry.id, err);
        setError(
          t("history.errors.partialClear", {
            message: err?.message || t("common.error"),
          })
        );
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
            {t("history.title")} <span>{t("history.titleSpan")}</span>
          </h1>
          <p>{t("history.subtitle")}</p>
        </section>

        {error && <div className="dash-error">{error}</div>}

        {loading ? (
          <div className="loader">
            <div className="spinner" />
            <p>{t("history.loading")}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="history-empty">
            <div className="history-empty-icon">#</div>
            <h3>{t("history.noHistory")}</h3>
            <p>{t("history.noHistoryDesc")}</p>
            <button
              className="analyze"
              type="button"
              style={{ maxWidth: 240, margin: "0 auto" }}
              onClick={() => navigate("/dashboard")}
            >
              {t("nav.dashboard")}
            </button>
          </div>
        ) : (
          <>
            <div className="history-topbar">
              <span className="history-count">{t("history.analysisCount", { count: entries.length })}</span>
              <button type="button" className="history-clear-btn" onClick={clearHistory}>
                {t("history.clearAll")}
              </button>
            </div>

            <div className="history-list">
              {entries.map((entry) => {
                const isOpen = expanded === entry.id;
                const result = entry.aiResult || {};
                const urgency = result.urgency;

                return (
                  <div key={entry.id} className={`history-card ${isOpen ? "open" : ""}`}>
                    <div
                      className="history-card-header"
                      onClick={() => setExpanded(isOpen ? null : entry.id)}
                    >
                      <div className="history-card-meta">
                        <span className="history-date">{formatDate(entry.createdAt, i18n.language)}</span>
                        {urgency && (
                          <span
                            className="urgency-badge small"
                            style={{
                              background: (urgencyColor[urgency] || "#2ecc71") + "22",
                              color: urgencyColor[urgency] || "#2ecc71",
                              border: `1px solid ${(urgencyColor[urgency] || "#2ecc71")}44`,
                            }}
                          >
                            {urgency === "Urgent"
                              ? t("history.urgent")
                              : urgency === "Soon"
                                ? t("history.soon")
                                : t("history.routine")}
                          </span>
                        )}
                      </div>

                      <div className="history-card-symptoms">
                        {entry.symptoms?.slice(0, 5).map((symptom) => (
                          <span key={symptom} className="hist-symptom-tag">
                            {t(`dashboard.symptoms.list.${symptom}`, symptom)}
                          </span>
                        ))}
                        {entry.symptoms?.length > 5 && (
                          <span className="hist-symptom-tag muted">
                            {t("history.moreSymptoms", { count: entry.symptoms.length - 5 })}
                          </span>
                        )}
                      </div>

                      <div className="history-card-actions">
                        <span className="hist-toggle">{isOpen ? t("history.hide") : t("history.view")}</span>
                        <button
                          type="button"
                          className="hist-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteEntry(entry.id);
                          }}
                          disabled={deletingId === entry.id}
                          title={t("history.delete")}
                          aria-label={t("history.delete")}
                        >
                          {deletingId === entry.id ? "..." : "x"}
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="history-detail">
                        {result.advice && (
                          <div className="ai-advice" style={{ marginBottom: 16 }}>
                            <span className="advice-icon">i</span>
                            <p>{result.advice}</p>
                          </div>
                        )}

                        {entry.mlHint?.disease && (
                          <div className="ai-advice" style={{ marginBottom: 16 }}>
                            <span className="advice-icon">AI</span>
                            <p>
                              {t("history.modelHintLabel")}: <strong>{entry.mlHint.disease}</strong>
                              {typeof entry.mlHint.confidence === "number" && (
                                <> ({Math.round(entry.mlHint.confidence * 100)}%)</>
                              )}
                            </p>
                          </div>
                        )}

                        <h4 className="history-sub">{t("history.possibleConditions")}</h4>
                        {result.conditions?.map((condition, index) => (
                          <div className="condition" key={index} style={{ marginBottom: 10 }}>
                            <div className="condition-header">
                              <h3>{condition.name}</h3>
                              <span
                                className="likelihood"
                                style={{
                                  color: likelihoodColor[condition.likelihood] || "#f39c12",
                                  background:
                                    (likelihoodColor[condition.likelihood] || "#f39c12") + "15",
                                }}
                              >
                                {getLikelihoodLabel(condition.likelihood)}
                              </span>
                            </div>
                            <p>{condition.description}</p>
                            {condition.specialist && (
                              <div className="specialist-tag">
                                <span>
                                  {t("dashboard.results.recommendation")}: {condition.specialist}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}

                        {result.disclaimer && (
                          <div className="disclaimer" style={{ marginTop: 8 }}>
                            <span>!</span>
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
