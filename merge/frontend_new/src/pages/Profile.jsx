import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, updatePassword, updateProfile as updateAuthProfile } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import AppNavbar from "../components/AppNavbar";
import { auth, db, storage } from "../lib/firebase";
import { loadIsAdminByUid } from "../lib/admin";
import { useTranslation } from "react-i18next";
import "../styles/dash.css";

function calculateAge(dateStr) {
  if (!dateStr) return 0;
  const birth = new Date(dateStr);
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function resizeAndCropImage(file, targetSize = 512) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = Math.floor((img.width - side) / 2);
        const sy = Math.floor((img.height - side) / 2);
        const canvas = document.createElement("canvas");
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvasUnavailable"));
          return;
        }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, targetSize, targetSize);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("imageProcessingFailed"));
              return;
            }
            resolve(blob);
          },
          "image/jpeg",
          0.9
        );
      };
      img.onerror = () => reject(new Error("invalidImageFile"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("couldNotReadFile"));
    reader.readAsDataURL(file);
  });
}

export default function Profile() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState({ name: "", email: "", birthDate: "", photoURL: "" });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [uid, setUid] = useState(auth.currentUser?.uid || "");

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        navigate("/login");
        return;
      }
      const isAdmin = await loadIsAdminByUid(user.uid);
      if (isAdmin) {
        navigate("/doctors");
        return;
      }
      setUid(user.uid);
      setAuthChecked(true);
    });
    return unsub;
  }, [navigate]);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      const data = snap.data() || {};
      const authEmail = auth.currentUser?.email || "";
      setProfile({
        name: data.name || auth.currentUser?.displayName || "",
        email: authEmail || data.email || "",
        birthDate: data.birthDate || "",
        photoURL: data.photoURL || auth.currentUser?.photoURL || "",
      });
    });
    return unsub;
  }, [uid]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");
    if (!uid) return;

    const trimmedName = profile.name.trim();

    if (trimmedName.length < 2) {
      setError(t("profile.errors.nameShort"));
      return;
    }
    if (profile.birthDate && calculateAge(profile.birthDate) < 13) {
      setError(t("profile.errors.ageTooYoung"));
      return;
    }

    setProfileBusy(true);
    try {
      await setDoc(
        doc(db, "users", uid),
        {
          name: trimmedName,
          birthDate: profile.birthDate || "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      if (auth.currentUser && trimmedName) {
        await updateAuthProfile(auth.currentUser, { displayName: trimmedName });
      }
      setStatus(t("profile.success.profileUpdated"));
    } catch (err) {
      setError(err.message || t("profile.errors.profileFailed"));
    } finally {
      setProfileBusy(false);
    }
  };

  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !uid) return;

    setError("");
    setStatus("");
    setPhotoBusy(true);
    try {
      if (!file.type.startsWith("image/")) throw new Error(t("profile.errors.notImageFile"));
      const processedBlob = await resizeAndCropImage(file);
      const fileRef = ref(storage, `users/${uid}/avatar-${Date.now()}.jpg`);
      await uploadBytes(fileRef, processedBlob, { contentType: "image/jpeg" });
      const photoURL = await getDownloadURL(fileRef);
      await setDoc(doc(db, "users", uid), { photoURL, updatedAt: serverTimestamp() }, { merge: true });
      if (auth.currentUser) await updateAuthProfile(auth.currentUser, { photoURL });
      setStatus(t("profile.success.photoUploaded"));
    } catch (err) {
      const code = err?.message;
      if (code && code in {
        canvasUnavailable: true,
        imageProcessingFailed: true,
        invalidImageFile: true,
        couldNotReadFile: true,
      }) {
        setError(t(`profile.errors.${code}`));
      } else {
        setError(err.message || t("profile.errors.photoFailed"));
      }
    } finally {
      setPhotoBusy(false);
      event.target.value = "";
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!newPassword || newPassword.length < 6) {
      setError(t("profile.errors.passwordShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("profile.errors.passwordMismatch"));
      return;
    }
    if (!auth.currentUser) return;

    setPasswordBusy(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setStatus(t("profile.success.passwordChanged"));
    } catch (err) {
      setError(err.message || t("profile.errors.passwordFailed"));
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  if (!authChecked) return null;

  return (
    <>
      <AppNavbar />
      <div className="dashboard profile-page">
        <section className="top">
          <h1>
            {t("profile.title")} <span>{t("profile.titleMark")}</span>
          </h1>
          <p>{t("profile.subtitle")}</p>
        </section>

        {error && <div className="dash-error">{error}</div>}
        {status && <div className="dash-success">{status}</div>}

        <div className="profile-grid">
          <div className="card profile-card">
            <h2>{t("profile.personalInfo")}</h2>
            <div className="profile-avatar-wrap">
              <img
                className="profile-avatar"
                src={profile.photoURL || "https://placehold.co/120x120/1B3F72/ffffff?text=U"}
                alt={t("profile.avatarAlt")}
              />
              <label className="btn small" htmlFor="profile-photo-input">
                {photoBusy ? t("common.loading") : t("profile.uploadPhoto")}
              </label>
              <input
                id="profile-photo-input"
                type="file"
                accept="image/*"
                onChange={uploadPhoto}
                disabled={photoBusy}
              />
            </div>

            <form className="auth-form" onSubmit={saveProfile}>
              <input
                type="text"
                placeholder={t("profile.name")}
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              />
              <input
                type="email"
                placeholder={t("profile.email")}
                value={profile.email}
                readOnly
              />
              <input
                type="date"
                value={profile.birthDate}
                onChange={(e) => setProfile((p) => ({ ...p, birthDate: e.target.value }))}
              />
              <button className="analyze" type="submit" disabled={profileBusy}>
                {profileBusy ? t("profile.saving") : t("profile.saveChanges")}
              </button>
            </form>
          </div>

          <div className="card profile-card">
            <h2>{t("profile.changePassword")}</h2>
            <p className="profile-sub">{t("profile.passwordHelp")}</p>
            <form className="auth-form" onSubmit={savePassword}>
              <input
                type="password"
                placeholder={t("profile.newPassword")}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <input
                type="password"
                placeholder={t("profile.confirmNewPassword")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button className="analyze" type="submit" disabled={passwordBusy}>
                {passwordBusy ? t("common.loading") : t("profile.changePassword")}
              </button>
            </form>
          </div>
        </div>

        <div className="profile-bottom-actions">
          <button type="button" className="profile-signout-btn" onClick={handleLogout}>
            {t("nav.signOut")}
          </button>
        </div>
      </div>
    </>
  );
}
