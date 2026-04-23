import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, onSnapshot, serverTimestamp } from "firebase/firestore";
import AppNavbar from "../components/AppNavbar";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { loadIsAdminByUid } from "../lib/admin";
import { DEFAULT_DOCTORS, normalizeDoctorDoc } from "../lib/doctors";
import { useTranslation } from "react-i18next";
import "../styles/dash.css";

const INITIAL_FORM = { name: "", email: "", specialty: "", clinic: "", city: "", message: "" };

export default function Doctors() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState({ kind: "", message: "" });
  const [sending, setSending] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [doctorDirectory, setDoctorDirectory] = useState(DEFAULT_DOCTORS);
  const [adminUser, setAdminUser] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { navigate("/login"); return; }
      const isAdmin = await loadIsAdminByUid(currentUser.uid);
      setAdminUser(isAdmin);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (!adminUser) return;
    const unsubscribe = onSnapshot(collection(db, "doctors"), (snapshot) => {
      const loadedDoctors = snapshot.docs.map(normalizeDoctorDoc).filter((d) => d.isActive);
      setDoctorDirectory(loadedDoctors.length > 0 ? loadedDoctors : DEFAULT_DOCTORS);
    });
    return unsubscribe;
  }, [adminUser]);

  const submitRequest = async (event) => {
    event.preventDefault();
    setStatus({ kind: "", message: "" });
    if (!form.name.trim() || !form.email.trim() || !form.specialty.trim()) {
      setStatus({ kind: "error", message: t("doctors.errors.completeFields") });
      return;
    }
    setSending(true);
    try {
      await addDoc(collection(db, "doctorRequests"), {
        name: form.name.trim(),
        email: form.email.trim(),
        specialty: form.specialty.trim(),
        clinic: form.clinic.trim(),
        city: form.city.trim(),
        message: form.message.trim(),
        status: "pending",
        submittedByUid: auth.currentUser?.uid || null,
        submittedAt: serverTimestamp(),
        reviewedAt: null,
        reviewedByUid: null,
      });
      setStatus({ kind: "success", message: t("doctors.requestSaved") });
      setForm(INITIAL_FORM);
    } catch (err) {
      setStatus({ kind: "error", message: err.message || t("doctors.errors.sendFailed") });
    } finally {
      setSending(false);
    }
  };

  if (!authChecked) return null;

  if (adminUser) {
    return (
      <>
        <AppNavbar />
        <div className="dashboard doctors-page">
          <section className="top">
            <h1>
              {t("doctors.listTitle")} <span>{t("doctors.listTitleSpan")}</span>
            </h1>
            <p>{t("doctors.listSubtitle")}</p>
          </section>

          <section className="card">
            <h2>{t("doctors.activeDoctors")}</h2>
            <div className="doctor-list">
              {doctorDirectory.map((doctor) => (
                <div className="doctor-item" key={doctor.id}>
                  <div>
                    <strong>{doctor.name}</strong>
                    <p>{doctor.specialty}</p>
                  </div>
                  <div>
                    <span>{doctor.clinic || t("doctors.clinicNotListed")}</span>
                    <small>
                      {doctor.city || t("doctors.cityNotListed")}
                      {doctor.phone ? ` - ${doctor.phone}` : ""}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <AppNavbar />
      <div className="dashboard doctors-page">
        <section className="top">
          <h1>
            {t("doctors.requestTitle")} <span>{t("doctors.requestTitleSpan")}</span>
          </h1>
          <p>If you are a doctor and want to be added, use the request form below.</p>
        </section>

        <section className="card appointment-card">
          <h2>{t("doctors.requestJoin")}</h2>
          <p>Send your details and we will review them before adding you to the doctor directory.</p>

          {status.message && <div className={`dash-${status.kind}`}>{status.message}</div>}

          <form className="auth-form" onSubmit={submitRequest}>
            <div className="double-row">
              <input
                type="text"
                placeholder={t("doctors.namePlaceholder")}
                value={form.name}
                onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              />
              <input
                type="email"
                placeholder={t("doctors.emailPlaceholder")}
                value={form.email}
                onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
              />
            </div>
            <div className="double-row">
              <input
                type="text"
                placeholder={t("doctors.specialtyPlaceholder")}
                value={form.specialty}
                onChange={(e) => setForm((c) => ({ ...c, specialty: e.target.value }))}
              />
              <input
                type="text"
                placeholder={t("doctors.clinicPlaceholder")}
                value={form.clinic}
                onChange={(e) => setForm((c) => ({ ...c, clinic: e.target.value }))}
              />
            </div>
            <input
              type="text"
              placeholder={t("doctors.cityPlaceholder")}
              value={form.city}
              onChange={(e) => setForm((c) => ({ ...c, city: e.target.value }))}
            />
            <textarea
              className="styled-textarea"
              rows={5}
              placeholder="Short message for the admin team"
              value={form.message}
              onChange={(e) => setForm((c) => ({ ...c, message: e.target.value }))}
            />
            <button className="analyze" type="submit" disabled={sending}>
              {sending ? t("common.loading") : t("doctors.sendRequest")}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
