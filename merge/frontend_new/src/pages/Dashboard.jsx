import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import AppNavbar from "../components/AppNavbar";
import { apiFetch } from "../lib/api";
import { db } from "../lib/firebase";
import { DEFAULT_DOCTORS, normalizeDoctorDoc } from "../lib/doctors";
import { loadIsAdminByUid } from "../lib/admin";
import "../styles/dash.css";

/* ─── Symptom list ─── */
const SYMPTOMS = [
  "Headache", "Fever", "Fatigue", "Cough", "Sore throat", "Nausea",
  "Shortness of breath", "Chest pain", "Back pain", "Dizziness",
  "Rash", "Joint pain", "Vomiting", "Loss of appetite", "Blurred vision",
];

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function inferSpecialties(aiResult, selectedSymptoms) {
  const fromAi = (aiResult?.conditions || [])
    .map((c) => String(c.specialist || "").toLowerCase())
    .join(" ");
  const fromSymptoms = selectedSymptoms.join(" ").toLowerCase();
  const text = `${fromAi} ${fromSymptoms}`;
  const spec = new Set(["General Medicine"]);
  if (/cardio|chest pain/.test(text)) spec.add("Cardiology");
  if (/skin|rash|derma/.test(text)) spec.add("Dermatology");
  if (/neuro|dizziness|blurred vision/.test(text)) spec.add("Neurology");
  if (/respir|shortness of breath|cough|lung/.test(text)) spec.add("Pulmonology");
  if (/gastro|nausea|vomiting|appetite/.test(text)) spec.add("Gastroenterology");
  return spec;
}

function formatAiSource(source) {
  const raw = String(source || "").toLowerCase();
  if (raw === "gemini") return "Gemini AI";
  if (raw === "groq") return "Groq AI";
  return "Fallback logic";
}

function formatTestProvider(provider) {
  const raw = String(provider || "auto").toLowerCase();
  if (raw === "gemini") return "Gemini";
  if (raw === "groq") return "Groq";
  if (raw === "groq-primary") return "Groq primary model";
  if (raw === "groq-fallback-1") return "Groq fallback model #1";
  if (raw === "groq-fallback-2") return "Groq fallback model #2";
  if (raw === "fallback" || raw === "rules") return "Fallback rules";
  return "Auto";
}

/* ─── Dashboard ─── */
export default function Dashboard() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [analysisMeta, setAnalysisMeta] = useState(null);
  const [testProvider, setTestProvider] = useState("auto");
  const [error, setError] = useState("");
  const [nearbyDoctors, setNearbyDoctors] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");
  const [doctorDirectory, setDoctorDirectory] = useState(DEFAULT_DOCTORS);
  const [isAdmin, setIsAdmin] = useState(false);

  // Auth guard
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) navigate("/login");
      else {
        const admin = await loadIsAdminByUid(user.uid);
        setIsAdmin(admin);
        if (admin) {
          navigate("/doctors");
          return;
        }
        setAuthChecked(true);
      }
    });
    return unsub;
  }, [navigate]);

  useEffect(() => {
    if (isAdmin) return;

    const unsubscribe = onSnapshot(
      collection(db, "doctors"),
      (snapshot) => {
        const loadedDoctors = snapshot.docs
          .map(normalizeDoctorDoc)
          .filter((doctor) => doctor.isActive);

        setDoctorDirectory(loadedDoctors.length > 0 ? loadedDoctors : DEFAULT_DOCTORS);
      },
      () => {
        setDoctorDirectory(DEFAULT_DOCTORS);
      }
    );

    return unsubscribe;
  }, [isAdmin]);

  const toggleTag = (s) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const addCustom = () => {
    const trimmed = custom.trim();
    if (!trimmed) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.add(trimmed);
      return next;
    });
    setCustom("");
  };

  const removeSymptom = (s) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(s);
      return next;
    });
  };

  const runDiagnosis = async () => {
    if (!selected.size) {
      setError("Please select at least one symptom.");
      return;
    }
    setError("");
    setLoading(true);
    setAiResult(null);
    setAnalysisMeta(null);
    setNearbyDoctors([]);
    setNearbyError("");

    const symptoms = [...selected];

    try {
      const data = await apiFetch("/predict", {
        method: "POST",
        body: {
          symptoms,
          provider: testProvider,
        },
      });

      if (!data || !data.aiResult) {
        throw new Error("Malformed response from server.");
      }

      setAiResult(data.aiResult);
      setAnalysisMeta({
        aiSource: data.aiSource || "unknown",
        cached: Boolean(data.cached),
        throttled: Boolean(data.throttled),
        message: data.message || "",
      });
    } catch (err) {
      console.error("/predict failed:", err);
      setError(
        err?.message ||
          "Analysis failed. Please check the backend is running and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const urgencyColor = {
    Routine: "#2ecc71",
    Soon: "#f39c12",
    Urgent: "#e74c3c",
  };
  const likelColor = { High: "#e74c3c", Medium: "#f39c12", Low: "#2ecc71" };

  const suggestNearbyDoctors = () => {
    if (!aiResult) return;
    if (!navigator.geolocation) {
      setNearbyError("Geolocation is not supported by your browser.");
      return;
    }
    setNearbyLoading(true);
    setNearbyError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const wantedSpecialties = inferSpecialties(aiResult, [...selected]);
        const ranked = doctorDirectory
          .filter((doctor) => wantedSpecialties.has(doctor.specialty))
          .map((doctor) => ({
            ...doctor,
            distanceKm:
              Number.isFinite(doctor.lat) && Number.isFinite(doctor.lng)
                ? haversineKm(latitude, longitude, doctor.lat, doctor.lng)
                : Number.POSITIVE_INFINITY,
          }))
          .sort((a, b) => a.distanceKm - b.distanceKm)
          .slice(0, 4);

        if (!ranked.length) {
          setNearbyError("No nearby doctors found for your symptoms yet.");
          setNearbyDoctors([]);
        } else {
          setNearbyDoctors(ranked);
        }
        setNearbyLoading(false);
      },
      (geoError) => {
        const code = geoError?.code;
        if (code === 1) {
          setNearbyError(
            "Location permission denied. Enable location permission for this site and your browser."
          );
        } else if (code === 2) {
          setNearbyError(
            "Location unavailable right now. Check your device location services and try again."
          );
        } else if (code === 3) {
          setNearbyError("Location request timed out. Please try again.");
        } else {
          setNearbyError("Could not access location. Please try again.");
        }
        setNearbyLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  if (!authChecked) return null;

  return (
    <>
      <AppNavbar />
      <div className="dashboard">
        <section className="top">
          <h1>
            What are you feeling <span>today?</span>
          </h1>
          <p>Select your symptoms and let our AI analyze possible conditions</p>
        </section>

        <div className="card">
          <h2>Select Symptoms</h2>

          <div className="tags">
            {SYMPTOMS.map((s) => (
              <button
                key={s}
                className={`tag ${selected.has(s) ? "active" : ""}`}
                onClick={() => toggleTag(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="input-row">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
              placeholder="Add a custom symptom…"
            />
            <button onClick={addCustom}>+ Add</button>
          </div>

          <div
            style={{
              display: "grid",
              gap: 6,
              marginBottom: 14,
            }}
          >
            <label style={{ fontSize: "0.86rem", fontWeight: 600, color: "#4b5b72" }}>
              Temporary test provider
            </label>
            <select
              value={testProvider}
              onChange={(e) => setTestProvider(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #d8e1ee",
                background: "#fff",
                color: "#1a2433",
                fontSize: "0.92rem",
              }}
            >
              <option value="auto">Auto (Gemini → Groq → fallback)</option>
              <option value="gemini">Gemini only</option>
              <option value="groq">Groq only</option>
              <option value="groq-primary">Groq primary model only</option>
              <option value="groq-fallback-1">Groq fallback #1 only</option>
              <option value="groq-fallback-2">Groq fallback #2 only</option>
              <option value="fallback">Fallback rules only</option>
            </select>
            <small style={{ color: "#6f7b8f" }}>
              Current mode: {formatTestProvider(testProvider)}
            </small>
          </div>

          {selected.size > 0 && (
            <div className="selected">
              {[...selected].map((s) => (
                <span key={s}>
                  {s}
                  <button onClick={() => removeSymptom(s)}>×</button>
                </span>
              ))}
            </div>
          )}

          {error && <div className="dash-error">{error}</div>}

          <button
            className="analyze"
            onClick={runDiagnosis}
            disabled={loading}
          >
            {loading ? "Analyzing…" : "Analyze Symptoms with AI"}
          </button>
        </div>

        {loading && (
          <div className="loader">
            <div className="spinner"></div>
            <p>AI is analyzing your symptoms…</p>
          </div>
        )}

        {aiResult && (
          <div className="results">
            <div className="result-header">
              <h2>AI Analysis</h2>
              <span
                className="urgency-badge"
                style={{
                  background:
                    (urgencyColor[aiResult.urgency] || "#2ecc71") + "22",
                  color: urgencyColor[aiResult.urgency] || "#2ecc71",
                  border: `1px solid ${(urgencyColor[aiResult.urgency] || "#2ecc71")}44`,
                }}
              >
                {aiResult.urgency === "Urgent"
                  ? "⚠ "
                  : aiResult.urgency === "Soon"
                  ? "⏱ "
                  : "✓ "}
                {aiResult.urgency}
              </span>
            </div>

            {analysisMeta && (
              <div
                className="ai-advice"
                style={{
                  marginBottom: 12,
                  border: "1px solid rgba(52, 152, 219, 0.25)",
                  background: "rgba(52, 152, 219, 0.08)",
                }}
              >
                <span className="advice-icon">🤖</span>
                <p>
                  Source: {formatAiSource(analysisMeta.aiSource)}
                  {analysisMeta.cached ? " (cached)" : ""}
                  {analysisMeta.throttled ? " (throttled)" : ""}
                  {analysisMeta.message ? ` — ${analysisMeta.message}` : ""}
                </p>
              </div>
            )}

            {aiResult.advice && (
              <div className="ai-advice">
                <span className="advice-icon">💬</span>
                <p>{aiResult.advice}</p>
              </div>
            )}

            <h2>Possible Conditions</h2>
            {aiResult.conditions?.map((c, i) => (
              <div className="condition" key={i}>
                <div className="condition-header">
                  <h3>{c.name}</h3>
                  <span
                    className="likelihood"
                    style={{
                      color: likelColor[c.likelihood] || "#f39c12",
                      background:
                        (likelColor[c.likelihood] || "#f39c12") + "15",
                    }}
                  >
                    {c.likelihood} likelihood
                  </span>
                </div>
                <p>{c.description}</p>
                {c.specialist && (
                  <div className="specialist-tag">
                    <span>👨‍⚕️ Recommended: {c.specialist}</span>
                  </div>
                )}
              </div>
            ))}

            {aiResult.disclaimer && (
              <div className="disclaimer">
                <span>⚠️</span>
                <p>{aiResult.disclaimer}</p>
              </div>
            )}

            <div className="nearby-wrap">
              <div className="nearby-head">
                <h2>Doctors Near You</h2>
                <button
                  className="history-clear-btn"
                  onClick={suggestNearbyDoctors}
                  disabled={nearbyLoading}
                >
                  {nearbyLoading ? "Finding..." : "Suggest doctors near me"}
                </button>
              </div>
              {nearbyError && <div className="dash-error">{nearbyError}</div>}
              {nearbyDoctors.length > 0 && (
                <div className="nearby-grid">
                  {nearbyDoctors.map((doctor) => (
                    <button
                      key={doctor.id}
                      type="button"
                      className="nearby-card"
                      onClick={() => navigate(`/appointments?doctorId=${encodeURIComponent(doctor.id)}`)}
                    >
                      <h3>{doctor.name}</h3>
                      <p>{doctor.specialty}</p>
                      <span>
                        {doctor.clinic}, {doctor.city}
                      </span>
                      <small>
                        {Number.isFinite(doctor.distanceKm)
                          ? `${doctor.distanceKm.toFixed(1)} km away`
                          : "Doctor available"
                        }
                      </small>
                      <small>{doctor.phone}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
