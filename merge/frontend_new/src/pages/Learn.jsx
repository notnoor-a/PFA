import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/LanguageSwitcher";
import "../styles/learn.css";

export default function Learn() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const cardsRef = useRef([]);

  const features = [
    { icon: "⚡", key: "instantAnalysis" },
    { icon: "🧠", key: "smartAI" },
    { icon: "👨‍⚕️", key: "specialistMatching" },
    { icon: "🔒", key: "privateSecure" },
    { icon: "🌍", key: "alwaysAvailable" },
    { icon: "📋", key: "detailedReports" },
  ];

  const steps = [
    { num: "01", key: "selectSymptoms" },
    { num: "02", key: "aiAnalyzes" },
    { num: "03", key: "getResults" },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); });
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
          <span>⚕</span> {t("nav.brandName")}
        </div>
        <div className="learn-nav-links" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <LanguageSwitcher />
          <button onClick={() => navigate("/login")} className="learn-nav-cta">
            {t("learn.getStarted")}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="learn-hero">
        <div className="learn-hero-badge">AI-Powered Health Assistant</div>
        <h1 className="learn-hero-title">
          {t("learn.heroTitle")}
          <br />
          <span className="learn-gradient-text">before you see a doctor</span>
        </h1>
        <p className="learn-hero-sub">{t("learn.heroSubtitle")}</p>
        <div className="learn-hero-actions">
          <button className="learn-btn-primary" onClick={() => navigate("/login")}>
            {t("learn.getStarted")} →
          </button>
          <button className="learn-btn-ghost" onClick={() => navigate("/dashboard")}>
            {t("nav.dashboard")}
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
        <h2 className="learn-section-title">{t("learn.howItWorksTitle")}</h2>
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
                <h3>{t(`learn.steps.${s.key}.title`)}</h3>
                <p>{t(`learn.steps.${s.key}.desc`)}</p>
              </div>
              {i < steps.length - 1 && <div className="learn-step-arrow">→</div>}
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="learn-section learn-features-section">
        <div className="learn-section-label">Features</div>
        <h2 className="learn-section-title">{t("learn.featuresTitle")}</h2>
        <div className="learn-features-grid">
          {features.map((f, i) => (
            <div
              key={i}
              className="learn-feature-card fade-in-up"
              ref={(el) => addRef(el, i + 10)}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="learn-feature-icon">{f.icon}</div>
              <h3>{t(`learn.features.${f.key}.title`)}</h3>
              <p>{t(`learn.features.${f.key}.desc`)}</p>
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
              Smart Medic is an informational tool and does not provide medical
              diagnosis, treatment, or professional medical advice. Always
              consult a qualified and licensed healthcare professional for any
              medical condition or health concerns. In case of emergency,
              contact emergency services immediately.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="learn-cta-section">
        <h2>Ready to understand your health?</h2>
        <p>Join Smart Medic today and get instant AI-powered symptom analysis.</p>
        <button className="learn-btn-primary large" onClick={() => navigate("/login")}>
          {t("learn.startNow")} →
        </button>
      </section>

      {/* FOOTER */}
      <footer className="learn-footer">
        <span>⚕ {t("nav.brandName")}</span>
        <span>© {new Date().getFullYear()} — AI Health Assistant</span>
      </footer>
    </div>
  );
}
