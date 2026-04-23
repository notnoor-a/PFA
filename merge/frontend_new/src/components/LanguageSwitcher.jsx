import { useTranslation } from "react-i18next";
import { useEffect } from "react";

const LANGUAGES = [
  { code: "en", label: "EN", flag: "🇬🇧" },
  { code: "fr", label: "FR", flag: "🇫🇷" },
  { code: "ar", label: "ع", flag: "🇹🇳" },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.split("-")[0] || "en";

  // Apply RTL direction for Arabic
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
    <div className="lang-switcher" role="group" aria-label="Language selector">
      {LANGUAGES.map(({ code, label, flag }) => (
        <button
          key={code}
          className={`lang-btn ${currentLang === code ? "lang-btn--active" : ""}`}
          onClick={() => handleChange(code)}
          title={code === "en" ? "English" : code === "fr" ? "Français" : "العربية"}
          aria-pressed={currentLang === code}
        >
          <span className="lang-flag">{flag}</span>
          <span className="lang-label">{label}</span>
        </button>
      ))}
    </div>
  );
}