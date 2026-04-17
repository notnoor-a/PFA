import { useState } from "react";
import "./dash.css";

export default function Dashboard() {
  const [selected, setSelected] = useState(new Set());
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(false);

  const toggleTag = (symptom) => {
    const newSet = new Set(selected);
    newSet.has(symptom) ? newSet.delete(symptom) : newSet.add(symptom);
    setSelected(newSet);
  };

  const addCustom = () => {
    if (!custom.trim()) return;
    const newSet = new Set(selected);
    newSet.add(custom.trim());
    setSelected(newSet);
    setCustom("");
  };

  const removeSymptom = (s) => {
    const newSet = new Set(selected);
    newSet.delete(s);
    setSelected(newSet);
  };

  const runDiagnosis = () => {
    if (!selected.size) return alert("Please select symptoms");
    setLoading(true);
    setResults(false);

    setTimeout(() => {
      setLoading(false);
      setResults(true);
    }, 1500);
  };

  const symptoms = [
    "Headache","Fever","Fatigue","Cough","Sore throat","Nausea",
    "Shortness of breath","Chest pain","Back pain","Dizziness",
    "Rash","Joint pain","Vomiting","Loss of appetite","Blurred vision"
  ];

  const conditions = [
    { name: "Influenza (Flu)", match: 88, desc: "Viral respiratory illness", specs: ["GP","Infectious"], tags: ["Viral"] },
    { name: "Common Cold", match: 70, desc: "Mild viral infection", specs: ["GP"], tags: ["Viral"] },
    { name: "Migraine", match: 84, desc: "Severe headache condition", specs: ["Neurologist"], tags: ["Chronic"] }
  ];

  const doctors = [
    { name: "Dr. Sana Khelifi", spec: "GP", dist: "0.8 km", avail: true },
    { name: "Dr. Amine Ben Slama", spec: "Cardiologist", dist: "1.4 km", avail: true },
    { name: "Dr. Leila Mhiri", spec: "Neurologist", dist: "2.1 km", avail: false },
    { name: "Dr. Karim Trabelsi", spec: "Pulmonologist", dist: "2.6 km", avail: true },
  ];

  return (
    <div className="dashboard">

      {/* TOP */}
      <section className="top">
        <h1>What are you feeling today?</h1>
        <p>Describe your symptoms and get AI suggestions</p>
      </section>

      {/* CARD */}
      <div className="card">

        <h2>Select symptoms</h2>

        {/* TAGS */}
        <div className="tags">
          {symptoms.map((s) => (
            <button
              key={s}
              className={`tag ${selected.has(s) ? "active" : ""}`}
              onClick={() => toggleTag(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {/* CUSTOM */}
        <div className="input-row">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Add symptom..."
          />
          <button onClick={addCustom}>+ Add</button>
        </div>

        {/* SELECTED */}
        <div className="selected">
          {[...selected].map((s) => (
            <span key={s}>
              {s}
              <button onClick={() => removeSymptom(s)}>×</button>
            </span>
          ))}
        </div>

        {/* ACTION */}
        <button className="analyze" onClick={runDiagnosis}>
          Analyze Symptoms
        </button>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="loader">
          <div className="spinner"></div>
          Analyzing...
        </div>
      )}

      {/* RESULTS */}
      {results && (
        <div className="results">

          <h2>Possible Conditions</h2>

          {conditions.map((c) => (
            <div className="condition" key={c.name}>
              <h3>{c.name} ({c.match}%)</h3>
              <p>{c.desc}</p>

              <div className="tags-small">
                {c.specs.map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
            </div>
          ))}

          <h2>Doctors near you</h2>

          <div className="docs">
            {doctors.map((d) => (
              <div className="doc" key={d.name}>
                <h4>{d.name}</h4>
                <p>{d.spec}</p>
                <span>{d.dist}</span>
                <div>{d.avail ? "Available" : "Busy"}</div>
              </div>
            ))}
          </div>

        </div>
      )}

    </div>
  );
}