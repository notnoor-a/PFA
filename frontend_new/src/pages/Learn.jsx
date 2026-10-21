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
    { icon: "01", key: "instantAnalysis" },
    { icon: "02", key: "smartAI" },
    { icon: "03", key: "specialistMatching" },
    { icon: "04", key: "privateSecure" },
    { icon: "05", key: "alwaysAvailable" },
    { icon: "06", key: "detailedReports" },
  ];

  const steps = [
    { num: "01", key: "selectSymptoms" },
    { num: "02", key: "aiAnalyzes" },
    { num: "03", key: "getResults" },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.1 }
    );

    cardsRef.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const addRef = (el, index) => {
    cardsRef.current[index] = el;
  };

  return (
    <div className="learn-page">
      <nav className="learn-nav">
        <div className="learn-nav-brand" onClick={() => navigate("/")}>
          <span>+</span> {t("nav.brandName")}
        </div>
        <div className="learn-nav-links" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <LanguageSwitcher />
          <button onClick={() => navigate("/login")} className="learn-nav-cta" type="button">
            {t("learn.getStarted")}
          </button>
        </div>
      </nav>

      <section className="learn-hero">
        <div className="learn-hero-badge">{t("learn.heroBadge")}</div>
        <h1 className="learn-hero-title">
          {t("learn.heroTitle")}
          <br />
          <span className="learn-gradient-text">{t("learn.heroTitleEmphasis")}</span>
        </h1>
        <p className="learn-hero-sub">{t("learn.heroSubtitle")}</p>
        <div className="learn-hero-actions">
          <button className="learn-btn-primary" onClick={() => navigate("/login")} type="button">
            {t("learn.getStarted")}
          </button>
          <button className="learn-btn-ghost" onClick={() => navigate("/dashboard")} type="button">
            {t("nav.dashboard")}
          </button>
        </div>

        <div className="learn-hero-stats">
          <div className="learn-stat">
            <span className="learn-stat-num">15+</span>
            <span className="learn-stat-label">{t("learn.stats.symptoms")}</span>
          </div>
          <div className="learn-stat-divider" />
          <div className="learn-stat">
            <span className="learn-stat-num">AI</span>
            <span className="learn-stat-label">{t("learn.stats.analysis")}</span>
          </div>
          <div className="learn-stat-divider" />
          <div className="learn-stat">
            <span className="learn-stat-num">24/7</span>
            <span className="learn-stat-label">{t("learn.stats.availability")}</span>
          </div>
        </div>
      </section>

      <section className="learn-section">
        <div className="learn-section-label">{t("learn.sectionProcess")}</div>
        <h2 className="learn-section-title">{t("learn.howItWorksTitle")}</h2>
        <div className="learn-steps">
          {steps.map((step, index) => (
            <div
              key={step.key}
              className="learn-step fade-in-up"
              ref={(el) => addRef(el, index)}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="learn-step-num">{step.num}</div>
              <div className="learn-step-content">
                <h3>{t(`learn.steps.${step.key}.title`)}</h3>
                <p>{t(`learn.steps.${step.key}.desc`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="learn-section learn-features-section">
        <div className="learn-section-label">{t("learn.sectionFeatures")}</div>
        <h2 className="learn-section-title">{t("learn.featuresTitle")}</h2>
        <div className="learn-features-grid">
          {features.map((feature, index) => (
            <div
              key={feature.key}
              className="learn-feature-card fade-in-up"
              ref={(el) => addRef(el, index + 10)}
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              <div className="learn-feature-icon">{feature.icon}</div>
              <h3>{t(`learn.features.${feature.key}.title`)}</h3>
              <p>{t(`learn.features.${feature.key}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="learn-disclaimer-section">
        <div className="learn-disclaimer">
          <div className="learn-disclaimer-icon">!</div>
          <div>
            <h3>{t("learn.disclaimer.title")}</h3>
            <p>{t("learn.disclaimer.body")}</p>
          </div>
        </div>
      </section>

      <section className="learn-cta-section">
        <h2>{t("learn.ctaTitle")}</h2>
        <p>{t("learn.ctaBody")}</p>
        <button className="learn-btn-primary large" onClick={() => navigate("/login")} type="button">
          {t("learn.startNow")}
        </button>
      </section>

      <footer className="learn-footer">
        <span>+ {t("nav.brandName")}</span>
        <span>{t("learn.footer", { year: new Date().getFullYear() })}</span>
      </footer>
    </div>
  );
}
