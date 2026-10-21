import { useTranslation } from "react-i18next";
import { useEffect } from "react";

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "ar", label: "AR" },
];

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const currentLang = i18n.language?.split("-")[0] || "en";

  useEffect(() => {
    const dir = currentLang === "ar" ? "rtl" : "ltr";
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", currentLang);
  }, [currentLang]);

  const handleChange = (code) => {
    i18n.changeLanguage(code);
    localStorage.setItem("smartmedic_lang", code);
  };

  return (
    <div className="lang-switcher" role="group" aria-label={t("lang.select")}>
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          className={`lang-btn ${currentLang === code ? "lang-btn--active" : ""}`}
          onClick={() => handleChange(code)}
          title={t(`lang.${code}`)}
          aria-label={t(`lang.${code}`)}
          aria-pressed={currentLang === code}
        >
          <span className="lang-label">{label}</span>
        </button>
      ))}
    </div>
  );
}
