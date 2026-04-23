import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/LanguageSwitcher";
import "../styles/quest.css";

export default function QuestPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="quest-page">
      <div style={{ position: "fixed", top: "16px", right: "16px", zIndex: 100 }}>
        <LanguageSwitcher />
      </div>

      <div className="quest-card">
        <h1>+ {t("nav.brandName")}</h1>

        <p>{t("learn.heroSubtitle")}</p>

        <div className="quest-actions">
          <button onClick={() => navigate("/login")} className="btn primary" type="button">
            {t("learn.getStarted")}
          </button>

          <button type="button" className="btn outline" onClick={() => navigate("/learn")}>
            {t("quest.learnMore")}
          </button>
        </div>
      </div>
    </div>
  );
}
