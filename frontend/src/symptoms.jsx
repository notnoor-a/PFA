import { useState } from "react";

export default function SymptomsPage() {
  const [symptoms, setSymptoms] = useState([1, 1, 0, 1]); // مثال
  const [result, setResult] = useState("");

  const handleCheck = async () => {
    const res = await fetch("http://localhost:3001/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ symptoms })
    });

    const data = await res.json();
    setResult(data.disease);
  };

  return (
    <div>
      <h2>AI Symptoms Checker</h2>

      <button onClick={handleCheck}>
        Analyze
      </button>

      <h3>{result}</h3>
    </div>
  );
}