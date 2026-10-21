import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "../styles/index.css";

import { auth } from "../lib/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile as updateAuthProfile,
} from "firebase/auth";
import { ensureUserProfile, loadIsAdminByUid } from "../lib/admin";
import LanguageSwitcher from "../components/LanguageSwitcher";

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

function getGoogleAuthErrorMessage(err, t) {
  const code = err?.code || "";
  if (code === "auth/popup-blocked") return t("login.errors.popupBlocked");
  if (code === "auth/popup-closed-by-user") return t("login.errors.popupClosed");
  if (code === "auth/unauthorized-domain") return t("login.errors.unauthorizedDomain");
  if (code === "auth/operation-not-allowed") return t("login.errors.operationNotAllowed");
  if (code === "auth/account-exists-with-different-credential") return t("login.errors.accountExists");
  return err?.message || t("login.errors.googleFailed");
}

function getAuthErrorMessage(err, t) {
  const code = err?.code || "";
  if (code === "auth/invalid-credential") return t("login.errors.invalidCredentials");
  if (code === "auth/user-not-found") return t("login.errors.invalidCredentials");
  if (code === "auth/wrong-password") return t("login.errors.invalidCredentials");
  if (code === "auth/email-already-in-use") return t("login.errors.emailInUse");
  if (code === "auth/weak-password") return t("login.errors.weakPassword");
  return err?.message || t("login.errors.authFailed");
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9L37.4 9.3C34 6.2 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 19 12 24 12c3 0 5.7 1.1 7.8 2.9L37.4 9.3C34 6.2 29.2 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.4-5L31.8 34c-2.1 1.4-4.7 2-7.8 2-5.3 0-9.6-3.3-11.3-8l-6.6 5.1C9.6 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.5-2.6 4.7-4.9 6l5.6 4.9C40 35.3 43.7 30.1 43.7 24c0-1.3-.1-2.7-.1-4z" />
    </svg>
  );
}

function EyeIcon({ open }) {
  return open ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C6 20 2 12 2 12a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function AuthSwipe() {
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", date: "", password: "", confirmPassword: "" });

  const handleChange = (e) => {
    setError("");
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError(t("login.errors.requiredFields"));
      return;
    }
    if (isSignUp && (!form.name.trim() || !form.date)) {
      setError(t("login.errors.requiredFields"));
      return;
    }
    if (isSignUp && form.password !== form.confirmPassword) {
      setError(t("login.errors.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      let user;
      if (isSignUp) {
        const result = await createUserWithEmailAndPassword(auth, form.email, form.password);
        user = result.user;
        const trimmedName = form.name.trim();
        if (trimmedName) {
          await updateAuthProfile(user, { displayName: trimmedName });
        }
        await ensureUserProfile(user || auth.currentUser, {
          name: trimmedName,
          birthDate: form.date,
        });
      } else {
        const result = await signInWithEmailAndPassword(auth, form.email, form.password);
        user = result.user;
        await ensureUserProfile(user || auth.currentUser);
      }
      const isAdmin = await loadIsAdminByUid((user || auth.currentUser)?.uid);
      navigate(isAdmin ? "/doctors" : "/dashboard");
    } catch (err) {
      setError(getAuthErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      await ensureUserProfile(result.user, {
        name: result.user?.displayName || "",
      });
      const isAdmin = await loadIsAdminByUid(result.user.uid);
      navigate(isAdmin ? "/doctors" : "/dashboard");
    } catch (err) {
      const code = err?.code || "";
      if (code === "auth/popup-blocked") {
        setError(t("login.errors.popupBlocked"));
        await signInWithRedirect(auth, provider);
        return;
      }
      setError(getGoogleAuthErrorMessage(err, t));
    } finally {
      setGoogleLoading(false);
    }
  };

  const switchMode = (value) => {
    setIsSignUp(value);
    setError("");
    setForm({ name: "", email: "", date: "", password: "", confirmPassword: "" });
    setShowPassword(false);
    setShowConfirm(false);
  };

  return (
    <div className={`auth-page ${isSignUp ? "signup-mode" : ""}`}>
      <div style={{ position: "fixed", top: "16px", right: "16px", zIndex: 100 }}>
        <LanguageSwitcher />
      </div>

      <div className="auth-card">
        <div className="auth-panel auth-left">
          <h1>{t("nav.brandName")}</h1>
          <h2>{isSignUp ? t("login.signUp") : t("login.signIn")}</h2>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignUp && (
              <input name="name" placeholder={t("login.fullName")} onChange={handleChange} />
            )}

            <input type="email" name="email" placeholder={t("login.email")} onChange={handleChange} />

            {isSignUp && <input type="date" name="date" onChange={handleChange} />}

            <div className="input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder={t("login.password")}
                onChange={handleChange}
              />
              <button type="button" className="eye-toggle" onClick={() => setShowPassword(!showPassword)}>
                <EyeIcon open={showPassword} />
              </button>
            </div>

            {isSignUp && (
              <div className="input-wrapper">
                <input
                  type={showConfirm ? "text" : "password"}
                  name="confirmPassword"
                  placeholder={t("login.confirmPassword")}
                  onChange={handleChange}
                />
                <button type="button" className="eye-toggle" onClick={() => setShowConfirm(!showConfirm)}>
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
            )}

            {error && <div className="auth-error">{error}</div>}

            <button className="btn primary" disabled={loading}>
              {loading
                ? t("common.loading")
                : isSignUp
                  ? t("login.signUp").toUpperCase()
                  : t("login.signIn").toUpperCase()}
            </button>

            <div className="auth-divider"><span>{t("login.orContinueWith")}</span></div>

            <button type="button" className="btn google" onClick={handleGoogle} disabled={googleLoading}>
              <GoogleIcon />
              <span style={{ marginLeft: "8px" }}>
                {googleLoading ? t("common.loading") : t("login.continueWithGoogle")}
              </span>
            </button>
          </form>
        </div>

        <div className="auth-panel auth-right">
          {!isSignUp ? (
            <>
              <h3>{t("login.dontHaveAccount")}</h3>
              <button className="btn outline1" onClick={() => switchMode(true)}>
                {t("login.signUp")}
              </button>
            </>
          ) : (
            <>
              <h3>{t("login.alreadyHaveAccount")}</h3>
              <button className="btn outline1" onClick={() => switchMode(false)}>
                {t("login.signIn")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
