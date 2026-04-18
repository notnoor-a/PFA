import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import AppNavbar from "../components/AppNavbar";
import { apiFetch } from "../lib/api";
import "../styles/dash.css";

/* ─── Symptom list ─── */
const SYMPTOMS = [
  "Headache", "Fever", "Fatigue", "Cough", "Sore throat", "Nausea",
  "Shortness of breath", "Chest pain", "Back pain", "Dizziness",
  "Rash", "Joint pain", "Vomiting", "Loss of appetite", "Blurred vision",
];

const DOCTOR_DIRECTORY = [
  { id: "doc-1", name: "Dr. Salma Benyahia", specialty: "Cardiology", clinic: "El Biar Heart Center", city: "Algiers", lat: 36.7683, lng: 3.0410, phone: "+213 21 55 10 10" },
  { id: "doc-2", name: "Dr. Mehdi Bouzid", specialty: "General Medicine", clinic: "Hydra Family Clinic", city: "Algiers", lat: 36.7458, lng: 3.0419, phone: "+213 21 60 44 11" },
  { id: "doc-3", name: "Dr. Ines Hamdi", specialty: "Dermatology", clinic: "Bab Ezzouar Skin Center", city: "Algiers", lat: 36.7197, lng: 3.1836, phone: "+213 21 24 88 67" },
  { id: "doc-4", name: "Dr. Yacine Mansouri", specialty: "Neurology", clinic: "Constantine NeuroCare", city: "Constantine", lat: 36.3650, lng: 6.6147, phone: "+213 31 91 55 02" },
  { id: "doc-5", name: "Dr. Farah Kerroum", specialty: "Pulmonology", clinic: "Oran Lung Clinic", city: "Oran", lat: 35.6971, lng: -0.6308, phone: "+213 41 51 27 90" },
  { id: "doc-6", name: "Dr. Ahmed Ouali", specialty: "Gastroenterology", clinic: "Setif Digestive Center", city: "Setif", lat: 36.1902, lng: 5.4137, phone: "+213 36 72 08 14" },
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

/* ─── Dashboard ─── */
export default function Dashboard() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [mlHint, setMlHint] = useState(null);
  const [error, setError] = useState("");
  const [nearbyDoctors, setNearbyDoctors] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");

  // Auth guard
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/login");
      else setAuthChecked(true);
    });
    return unsub;
  }, [navigate]);

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
    setMlHint(null);
    setNearbyDoctors([]);
    setNearbyError("");

    const symptoms = [...selected];

    try {
      const data = await apiFetch("/predict", {
        method: "POST",
        body: { symptoms },
      });

      if (!data || !data.aiResult) {
        throw new Error("Malformed response from server.");
      }

      setAiResult(data.aiResult);
      setMlHint(data.mlHint || null);
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
        const ranked = DOCTOR_DIRECTORY.map((doctor) => ({
          ...doctor,
          distanceKm: haversineKm(latitude, longitude, doctor.lat, doctor.lng),
        }))
          .filter((doctor) => wantedSpecialties.has(doctor.specialty))
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

            {aiResult.advice && (
              <div className="ai-advice">
                <span className="advice-icon">💬</span>
                <p>{aiResult.advice}</p>
              </div>
            )}

            {mlHint?.disease && (
              <div className="ai-advice" style={{ marginTop: 8 }}>
                <span className="advice-icon">🔬</span>
                <p>
                  Statistical model hint: <strong>{mlHint.disease}</strong>
                  {typeof mlHint.confidence === "number" && (
                    <> ({Math.round(mlHint.confidence * 100)}% confidence)</>
                  )}
                </p>
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
                    <div key={doctor.id} className="nearby-card">
                      <h3>{doctor.name}</h3>
                      <p>{doctor.specialty}</p>
                      <span>
                        {doctor.clinic}, {doctor.city}
                      </span>
                      <small>{doctor.distanceKm.toFixed(1)} km away</small>
                      <small>{doctor.phone}</small>
                    </div>
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
