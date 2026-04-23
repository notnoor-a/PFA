import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { loadIsAdminByUid } from "../lib/admin";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";

export default function AppNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [user, setUser] = useState(auth.currentUser);
  const [adminUser, setAdminUser] = useState(null);
  const [userProfile, setUserProfile] = useState({ photoURL: "" });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u?.uid) {
        setAdminUser(false);
        return;
      }
      const isAdmin = await loadIsAdminByUid(u.uid);
      setAdminUser(isAdmin);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      const data = snap.data() || {};
      setUserProfile({
        photoURL: data.photoURL || "",
      });
    });
    return unsub;
  }, [user?.uid]);

  const isActive = (path) => (location.pathname === path ? "active" : "");

  if (adminUser === null) {
    return <nav className="navbar"><div className="navbar-brand" /></nav>;
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand" onClick={() => navigate(adminUser ? "/doctors" : "/dashboard")}>
        <span className="nav-logo">⚕</span>
        <span>{t("nav.brandName")}</span>
      </div>

      <div className="navbar-links">
        {adminUser ? (
          <>
            <button
              className={`nav-link ${isActive("/doctors")}`}
              onClick={() => navigate("/doctors")}
            >
              {t("nav.doctors")}
            </button>
            <button
              className={`nav-link ${isActive("/doctor-requests")}`}
              onClick={() => navigate("/doctor-requests")}
            >
              {t("nav.reviewRequests")}
            </button>
          </>
        ) : (
          <>
            <button
              className={`nav-link ${isActive("/dashboard")}`}
              onClick={() => navigate("/dashboard")}
            >
              {t("nav.dashboard")}
            </button>
            <button
              className={`nav-link ${isActive("/appointments")}`}
              onClick={() => navigate("/appointments")}
            >
              {t("nav.appointments")}
            </button>
            {user && (
              <button
                className={`nav-link ${isActive("/doctors")}`}
                onClick={() => navigate("/doctors")}
              >
                {t("nav.doctors")}
              </button>
            )}
            <button
              className={`nav-link ${isActive("/history")}`}
              onClick={() => navigate("/history")}
            >
              {t("nav.history")}
            </button>
          </>
        )}
      </div>

      <div className="navbar-user">
        <LanguageSwitcher />
        {adminUser ? (
          <button className="nav-logout" onClick={() => signOut(auth).then(() => navigate("/login"))}>
            {t("nav.signOut")}
          </button>
        ) : (
          <div
            className="nav-avatar"
            onClick={() => navigate("/profile")}
            title={t("nav.profile")}
          >
            {userProfile?.photoURL ? (
              <img
                className="nav-avatar-image"
                src={userProfile.photoURL}
                alt="Profile"
              />
            ) : (
              user?.displayName?.[0]?.toUpperCase() ||
              user?.email?.[0]?.toUpperCase() ||
              "U"
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

