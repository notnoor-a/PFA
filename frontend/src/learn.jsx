import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./learn.css";

const features = [
  {
    icon: "⚡",
    title: "Instant Analysis",
    desc: "Get AI-powered symptom analysis in seconds, no waiting rooms, no appointments needed.",
  },
  {
    icon: "🧠",
    title: "Smart AI Engine",
    desc: "Powered by advanced large language models trained on vast medical knowledge bases.",
  },
  {
    icon: "👨‍⚕️",
    title: "Specialist Matching",
    desc: "We match your symptoms to the right type of specialist so you see the right doctor.",
  },
  {
    icon: "🔒",
    title: "Private & Secure",
    desc: "Your health data stays private. We never sell or share your personal information.",
  },
  {
    icon: "🌍",
    title: "Always Available",
    desc: "Access your health assistant 24/7, from anywhere in the world, on any device.",
  },
  {
    icon: "📋",
    title: "Detailed Reports",
    desc: "Receive clear, readable explanations of possible conditions and next steps.",
  },
];

const steps = [
  { num: "01", title: "Select Symptoms", desc: "Choose from common symptoms or type your own in natural language." },
  { num: "02", title: "AI Processes", desc: "Our AI analyzes your symptom profile against thousands of conditions." },
  { num: "03", title: "Get Results", desc: "Receive a list of possible conditions with likelihood scores." },
  { num: "04", title: "Find a Specialist", desc: "We guide you to the right type of doctor for follow-up care." },
];

export default function Learn() {
  const navigate = useNavigate();
  const cardsRef = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 }
    );

    cardsRef.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const addRef = (el, i) => { cardsRef.current[i] = el; };

  return (
    <div className="learn-page">

      {/* NAVBAR */}
      <nav className="learn-nav">
        <div className="learn-nav-brand" onClick={() => navigate("/")}>
          <span>⚕</span> Smart Medic
        </div>
        <div className="learn-nav-links">

          <button onClick={() => navigate("/login")} className="learn-nav-cta">Get Started</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="learn-hero">
        <div className="learn-hero-badge">AI-Powered Health Assistant</div>
        <h1 className="learn-hero-title">
          Understand your health<br />
          <span className="learn-gradient-text">before you see a doctor</span>
        </h1>
        <p className="learn-hero-sub">
          Smart Medic uses advanced AI to analyze your symptoms instantly, suggest possible
          conditions, and guide you to the right medical specialist — all in seconds.
        </p>
        <div className="learn-hero-actions">
          <button className="learn-btn-primary" onClick={() => navigate("/login")}>
            Start for Free →
          </button>
          <button className="learn-btn-ghost" onClick={() => navigate("/dashboard")}>
            Try Dashboard
          </button>
        </div>

        <div className="learn-hero-stats">
          <div className="learn-stat">
            <span className="learn-stat-num">15+</span>
            <span className="learn-stat-label">Symptoms covered</span>
          </div>
          <div className="learn-stat-divider" />
          <div className="learn-stat">
            <span className="learn-stat-num">AI</span>
            <span className="learn-stat-label">Powered analysis</span>
          </div>
          <div className="learn-stat-divider" />
          <div className="learn-stat">
            <span className="learn-stat-num">24/7</span>
            <span className="learn-stat-label">Always available</span>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="learn-section">
        <div className="learn-section-label">Process</div>
        <h2 className="learn-section-title">How Smart Medic works</h2>
        <div className="learn-steps">
          {steps.map((s, i) => (
            <div
              key={i}
              className="learn-step fade-in-up"
              ref={(el) => addRef(el, i)}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="learn-step-num">{s.num}</div>
              <div className="learn-step-content">
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
              {i < steps.length - 1 && <div className="learn-step-arrow">→</div>}
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="learn-section learn-features-section">
        <div className="learn-section-label">Features</div>
        <h2 className="learn-section-title">Everything you need</h2>
        <div className="learn-features-grid">
          {features.map((f, i) => (
            <div
              key={i}
              className="learn-feature-card fade-in-up"
              ref={(el) => addRef(el, i + 10)}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="learn-feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DISCLAIMER */}
      <section className="learn-disclaimer-section">
        <div className="learn-disclaimer">
          <div className="learn-disclaimer-icon">⚠️</div>
          <div>
            <h3>Important Disclaimer</h3>
            <p>
              Smart Medic is an informational tool and does not provide medical diagnosis, treatment, or professional
              medical advice. Always consult a qualified and licensed healthcare professional for any medical condition
              or health concerns. In case of emergency, contact emergency services immediately.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="learn-cta-section">
        <h2>Ready to understand your health?</h2>
        <p>Join Smart Medic today and get instant AI-powered symptom analysis.</p>
        <button className="learn-btn-primary large" onClick={() => navigate("/login")}>
          Create Free Account →
        </button>
      </section>

      {/* FOOTER */}
      <footer className="learn-footer">
        <span>⚕ Smart Medic</span>
        <span>© {new Date().getFullYear()} — AI Health Assistant</span>
      </footer>

    </div>
  );
}
