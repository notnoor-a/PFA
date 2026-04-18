import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "./firebase";
import { signOut } from "firebase/auth";
import "./dash.css";

/* ─── Shared Navbar (used by Dashboard & History) ─── */
export function AppNavbar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const user      = auth.currentUser;
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path ? "active" : "";

  return (
    <nav className="navbar">
      <div className="navbar-brand" onClick={() => navigate("/dashboard")}>
        <span className="nav-logo">⚕</span>
        <span>Smart Medic</span>
      </div>

      <div className="navbar-links">
        <button className={`nav-link ${isActive("/dashboard")}`} onClick={() => navigate("/dashboard")}>
          Dashboard
        </button>
        <button className={`nav-link ${isActive("/history")}`} onClick={() => navigate("/history")}>
          History
        </button>
      </div>

      <div className="navbar-user">
        <div className="nav-avatar" onClick={() => setMenuOpen(!menuOpen)}>
          {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
        </div>
        {menuOpen && (
          <>
            <div className="nav-overlay" onClick={() => setMenuOpen(false)} />
            <div className="nav-dropdown">
              <p className="nav-email">{user?.displayName || user?.email || "User"}</p>
              <button onClick={handleLogout} className="nav-logout">Sign Out</button>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}

/* ─── Symptom list ─── */
const SYMPTOMS = [
  "Headache","Fever","Fatigue","Cough","Sore throat","Nausea",
  "Shortness of breath","Chest pain","Back pain","Dizziness",
  "Rash","Joint pain","Vomiting","Loss of appetite","Blurred vision"
];

/* ─── Dashboard ─── */
export default function Dashboard() {
  const [selected, setSelected] = useState(new Set());
  const [custom, setCustom]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [error, setError]       = useState("");

  const toggleTag = (s) => {
    const n = new Set(selected);
    n.has(s) ? n.delete(s) : n.add(s);
    setSelected(n);
  };

  const addCustom = () => {
    if (!custom.trim()) return;
    const n = new Set(selected);
    n.add(custom.trim());
    setSelected(n);
    setCustom("");
  };

  const removeSymptom = (s) => {
    const n = new Set(selected);
    n.delete(s);
    setSelected(n);
  };

  const saveToHistory = (symptoms, result) => {
    try {
      const prev = JSON.parse(localStorage.getItem("sm_history") || "[]");
      const entry = {
        id: Date.now(),
        date: new Date().toISOString(),
        symptoms: [...symptoms],
        result,
      };
      localStorage.setItem("sm_history", JSON.stringify([entry, ...prev].slice(0, 50)));
    } catch (_) {}
  };

  const runDiagnosis = async () => {
    if (!selected.size) { setError("Please select at least one symptom."); return; }
    setError("");
    setLoading(true);
    setAiResult(null);

    const symptomList = [...selected].join(", ");

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are a medical AI assistant. Given symptoms, provide a helpful non-alarmist analysis.
Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "conditions": [
    { "name": string, "likelihood": "High"|"Medium"|"Low", "description": string, "specialist": string }
  ],
  "advice": string,
  "urgency": "Routine"|"Soon"|"Urgent",
  "disclaimer": string
}
Provide 2-4 conditions. Keep descriptions to 1 sentence.`,
          messages: [{ role: "user", content: `My symptoms: ${symptomList}` }]
        })
      });

      const data  = await response.json();
      const text  = data.content?.[0]?.text || "";

      let parsed;
      try { parsed = JSON.parse(text); }
      catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
        else throw new Error("Parse error");
      }

      setAiResult(parsed);
      saveToHistory(selected, parsed);
    } catch (err) {
      setError("Analysis failed. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const urgencyColor  = { Routine: "#2ecc71", Soon: "#f39c12", Urgent: "#e74c3c" };
  const likelColor    = { High: "#e74c3c",    Medium: "#f39c12", Low: "#2ecc71" };

  return (
    <>
      <AppNavbar />
      <div className="dashboard">

        <section className="top">
          <h1>What are you feeling <span>today?</span></h1>
          <p>Select your symptoms and let our AI analyze possible conditions</p>
        </section>

        <div className="card">
          <h2>Select Symptoms</h2>

          <div className="tags">
            {SYMPTOMS.map((s) => (
              <button key={s} className={`tag ${selected.has(s) ? "active" : ""}`} onClick={() => toggleTag(s)}>
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
                <span key={s}>{s}<button onClick={() => removeSymptom(s)}>×</button></span>
              ))}
            </div>
          )}

          {error && <div className="dash-error">{error}</div>}

          <button className="analyze" onClick={runDiagnosis} disabled={loading}>
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
              <span className="urgency-badge" style={{
                background: urgencyColor[aiResult.urgency] + "22",
                color: urgencyColor[aiResult.urgency],
                border: `1px solid ${urgencyColor[aiResult.urgency]}44`
              }}>
                {aiResult.urgency === "Urgent" ? "⚠ " : aiResult.urgency === "Soon" ? "⏱ " : "✓ "}
                {aiResult.urgency}
              </span>
            </div>

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
                  <span className="likelihood" style={{
                    color: likelColor[c.likelihood],
                    background: likelColor[c.likelihood] + "15"
                  }}>
                    {c.likelihood} likelihood
                  </span>
                </div>
                <p>{c.description}</p>
                {c.specialist && (
                  <div className="specialist-tag"><span>👨‍⚕️ Recommended: {c.specialist}</span></div>
                )}
              </div>
            ))}

            {aiResult.disclaimer && (
              <div className="disclaimer">
                <span>⚠️</span>
                <p>{aiResult.disclaimer}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}