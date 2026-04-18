import { useNavigate } from "react-router-dom";
import "./quest.css";

export default function QuestPage() {
  const navigate = useNavigate();

  return (
    <div className="quest-page">

      <div className="quest-card">

        <h1>🩺 Welcome to Smart Medic</h1>

        <p>
          Your AI health assistant that helps you understand symptoms and find doctors nearby.
        </p>

        <div className="quest-actions">

          <button onClick={() => navigate("/login")} className="btn primary">
            Get Started
          </button>

          <button type="button" className="btn outline" onClick={() => navigate("/learn")}>
  Learn More
</button>

        </div>

      </div>

    </div>
  );
}