import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import AppNavbar from "../components/AppNavbar";
import { apiFetch } from "../lib/api";
import { DEFAULT_DOCTORS, normalizeDoctorDoc } from "../lib/doctors";
import { loadIsAdminByUid } from "../lib/admin";
import { useTranslation } from "react-i18next";
import "../styles/dash.css";

const SYMPTOMS = [
  "Headache",
  "Fever",
  "Fatigue",
  "Cough",
  "Sore throat",
  "Nausea",
  "Shortness of breath",
  "Chest pain",
  "Back pain",
  "Dizziness",
  "Rash",
  "Joint pain",
  "Vomiting",
  "Loss of appetite",
  "Blurred vision",
];

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return r * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [authChecked, setAuthChecked] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [error, setError] = useState("");
  const [nearbyDoctors, setNearbyDoctors] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");
  const [doctorDirectory, setDoctorDirectory] = useState(DEFAULT_DOCTORS);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login");
      } else {
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

  const toggleTag = (symptom) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(symptom)) next.delete(symptom);
      else next.add(symptom);
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

  const removeSymptom = (symptom) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(symptom);
      return next;
    });
  };

  const runDiagnosis = async () => {
    if (!selected.size) {
      setError(t("dashboard.symptoms.selectAtLeastOne"));
      return;
    }

    setError("");
    setLoading(true);
    setAiResult(null);
    setAnalysisMessage("");
    setNearbyDoctors([]);
    setNearbyError("");

    try {
      const data = await apiFetch("/predict", {
        method: "POST",
        body: { symptoms: [...selected] },
      });

      if (!data || !data.aiResult) {
        throw new Error(t("dashboard.errors.malformedResponse"));
      }

      setAiResult(data.aiResult);
      setAnalysisMessage(data.message || "");
    } catch (err) {
      console.error("/predict failed:", err);
      setError(err?.message || t("dashboard.errors.analysisFailed"));
    } finally {
      setLoading(false);
    }
  };

  const urgencyColor = {
    Routine: "#2ecc71",
    Soon: "#f39c12",
    Urgent: "#e74c3c",
  };
  const likelihoodColor = { High: "#e74c3c", Medium: "#f39c12", Low: "#2ecc71" };

  const getLikelihoodLabel = (value) => {
    const normalized = String(value || "").toLowerCase();
    if (normalized === "high") return t("common.likelihood.high");
    if (normalized === "medium") return t("common.likelihood.medium");
    return t("common.likelihood.low");
  };

  const suggestNearbyDoctors = () => {
    if (!aiResult) return;
    if (!navigator.geolocation) {
      setNearbyError(t("dashboard.nearby.noLocation"));
      setNearbyDoctors([]);
      return;
    }

    setNearbyLoading(true);
    setNearbyError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const userLat = Number(latitude);
        const userLng = Number(longitude);

        if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
          setNearbyDoctors([]);
          setNearbyError(t("dashboard.nearby.locationError"));
          setNearbyLoading(false);
          return;
        }

        const wantedSpecialties = inferSpecialties(aiResult, [...selected]);
        const ranked = doctorDirectory
          .filter((doctor) => Number.isFinite(doctor.lat) && Number.isFinite(doctor.lng))
          .map((doctor) => ({
            ...doctor,
            distanceKm: haversineKm(userLat, userLng, doctor.lat, doctor.lng),
            matchesSymptoms: wantedSpecialties.has(doctor.specialty),
          }))
          .sort(
            (a, b) =>
              a.distanceKm - b.distanceKm ||
              Number(b.matchesSymptoms) - Number(a.matchesSymptoms)
          )
          .slice(0, 4);

        if (!ranked.length) {
          setNearbyError(t("dashboard.nearby.noDoctors"));
          setNearbyDoctors([]);
        } else {
          setNearbyDoctors(ranked);
        }
        setNearbyLoading(false);
      },
      (geoError) => {
        const code = geoError?.code;
        if (code === 1) {
          setNearbyError(t("dashboard.nearby.permissionDenied"));
        } else if (code === 2) {
          setNearbyError(t("dashboard.nearby.locationUnavailable"));
        } else if (code === 3) {
          setNearbyError(t("dashboard.nearby.locationTimeout"));
        } else {
          setNearbyError(t("dashboard.nearby.locationError"));
        }
        setNearbyDoctors([]);
        setNearbyLoading(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  if (!authChecked) return null;

  return (
    <>
      <AppNavbar />
      <div className="dashboard">
        <section className="top">
          <h1>
            {t("dashboard.title")} <span>{t("dashboard.titleSuffix")}</span>
          </h1>
          <p>{t("dashboard.subtitle")}</p>
        </section>

        <div className="card">
          <h2>{t("dashboard.symptoms.title")}</h2>

          <div className="tags">
            {SYMPTOMS.map((symptom) => (
              <button
                key={symptom}
                type="button"
                className={`tag ${selected.has(symptom) ? "active" : ""}`}
                onClick={() => toggleTag(symptom)}
              >
                {t(`dashboard.symptoms.list.${symptom}`, symptom)}
              </button>
            ))}
          </div>

          <div className="input-row">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
              placeholder={t("dashboard.symptoms.customPlaceholder")}
            />
            <button type="button" onClick={addCustom}>
              + {t("common.add")}
            </button>
          </div>

          {selected.size > 0 && (
            <div className="selected">
              {[...selected].map((symptom) => (
                <span key={symptom}>
                  {t(`dashboard.symptoms.list.${symptom}`, symptom)}
                  <button type="button" onClick={() => removeSymptom(symptom)} aria-label={t("common.delete")}>
                    x
                  </button>
                </span>
              ))}
            </div>
          )}

          {error && <div className="dash-error">{error}</div>}

          <button className="analyze" type="button" onClick={runDiagnosis} disabled={loading}>
            {loading ? t("dashboard.symptoms.analyzing") : t("dashboard.symptoms.analyze")}
          </button>
        </div>

        {loading && (
          <div className="loader">
            <div className="spinner" />
            <p>{t("dashboard.symptoms.analyzing")}</p>
          </div>
        )}

        {aiResult && (
          <div className="results">
            <div className="result-header">
              <h2>{t("dashboard.results.title")}</h2>
              <span
                className="urgency-badge"
                style={{
                  background: (urgencyColor[aiResult.urgency] || "#2ecc71") + "22",
                  color: urgencyColor[aiResult.urgency] || "#2ecc71",
                  border: `1px solid ${(urgencyColor[aiResult.urgency] || "#2ecc71")}44`,
                }}
              >
                {aiResult.urgency === "Urgent"
                  ? t("dashboard.results.urgent")
                  : aiResult.urgency === "Soon"
                    ? t("dashboard.results.soon")
                    : t("dashboard.results.routine")}
              </span>
            </div>

            {analysisMessage && (
              <div
                className="ai-advice"
                style={{
                  marginBottom: 12,
                  border: "1px solid rgba(52, 152, 219, 0.25)",
                  background: "rgba(52, 152, 219, 0.08)",
                }}
              >
                <span className="advice-icon">AI</span>
                <p>{analysisMessage}</p>
              </div>
            )}

            {aiResult.advice && (
              <div className="ai-advice">
                <span className="advice-icon">i</span>
                <p>{aiResult.advice}</p>
              </div>
            )}

            <h2>{t("dashboard.results.possibleConditions")}</h2>
            {aiResult.conditions?.map((condition, index) => (
              <div className="condition" key={index}>
                <div className="condition-header">
                  <h3>{condition.name}</h3>
                  <span
                    className="likelihood"
                    style={{
                      color: likelihoodColor[condition.likelihood] || "#f39c12",
                      background: (likelihoodColor[condition.likelihood] || "#f39c12") + "15",
                    }}
                  >
                    {getLikelihoodLabel(condition.likelihood)}
                  </span>
                </div>
                <p>{condition.description}</p>
                {condition.specialist && (
                  <div className="specialist-tag">
                    <span>{t("dashboard.results.recommendation")}: {condition.specialist}</span>
                  </div>
                )}
              </div>
            ))}

            {aiResult.disclaimer && (
              <div className="disclaimer">
                <span>!</span>
                <p>{aiResult.disclaimer}</p>
              </div>
            )}

            <div className="nearby-wrap">
              <div className="nearby-head">
                <h2>{t("dashboard.nearby.title")}</h2>
                <button
                  type="button"
                  className="history-clear-btn"
                  onClick={suggestNearbyDoctors}
                  disabled={nearbyLoading}
                >
                  {nearbyLoading ? t("dashboard.nearby.finding") : t("dashboard.nearby.findNearby")}
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
                      onClick={() =>
                        navigate(`/appointments?doctorId=${encodeURIComponent(doctor.id)}`)
                      }
                    >
                      <h3>{doctor.name}</h3>
                      <p>{doctor.specialty}</p>
                      <span>{[doctor.clinic, doctor.city].filter(Boolean).join(", ")}</span>
                      <small>
                        {Number.isFinite(doctor.distanceKm)
                          ? `${doctor.distanceKm.toFixed(1)} ${t("dashboard.nearby.km")}`
                          : t("common.noData")}
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
