import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, onSnapshot, serverTimestamp } from "firebase/firestore";
import AppNavbar from "../components/AppNavbar";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { loadIsAdminByUid } from "../lib/admin";
import { DEFAULT_DOCTORS, normalizeDoctorDoc } from "../lib/doctors";
import "../styles/dash.css";

const INITIAL_FORM = {
  name: "",
  email: "",
  specialty: "",
  clinic: "",
  city: "",
  message: "",
};

export default function Doctors() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState({ kind: "", message: "" });
  const [sending, setSending] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [doctorDirectory, setDoctorDirectory] = useState(DEFAULT_DOCTORS);
  const [adminUser, setAdminUser] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate("/login");
        return;
      }

      const isAdmin = await loadIsAdminByUid(currentUser.uid);
      setAdminUser(isAdmin);
      setAuthChecked(true);
    });

    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (!adminUser) return;

    const unsubscribe = onSnapshot(collection(db, "doctors"), (snapshot) => {
      const loadedDoctors = snapshot.docs
        .map(normalizeDoctorDoc)
        .filter((doctor) => doctor.isActive);

      setDoctorDirectory(loadedDoctors.length > 0 ? loadedDoctors : DEFAULT_DOCTORS);
    });

    return unsubscribe;
  }, [adminUser]);

  const submitRequest = async (event) => {
    event.preventDefault();
    setStatus({ kind: "", message: "" });

    if (!form.name.trim() || !form.email.trim() || !form.specialty.trim()) {
      setStatus({ kind: "error", message: "Please complete your name, email, and specialty." });
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

      setStatus({
        kind: "success",
        message: "Your request has been saved. An admin can review it and approve it from the requests page.",
      });
      setForm(INITIAL_FORM);
    } catch (err) {
      setStatus({ kind: "error", message: err.message || "Failed to send request." });
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
              Doctors <span>List</span>
            </h1>
            <p>These are the doctors currently available in the app.</p>
          </section>

          <section className="card">
            <h2>Active doctors</h2>
            <div className="doctor-list">
              {doctorDirectory.map((doctor) => (
                <div className="doctor-item" key={doctor.id}>
                  <div>
                    <strong>{doctor.name}</strong>
                    <p>{doctor.specialty}</p>
                  </div>
                  <div>
                    <span>{doctor.clinic || "Clinic not listed"}</span>
                    <small>
                      {doctor.city || "City not listed"}
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
            Our <span>Doctors</span>
          </h1>
          <p>
            If you are a doctor and want to be added, use the request form below.
          </p>
        </section>

        <section className="card appointment-card">
          <h2>Request to join</h2>
          <p>
            Send your details and we will review them before adding you to the doctor directory.
          </p>

          {status.message && <div className={`dash-${status.kind}`}>{status.message}</div>}

          <form className="auth-form" onSubmit={submitRequest}>
            <div className="double-row">
              <input
                type="text"
                placeholder="Full name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
              <input
                type="email"
                placeholder="Professional email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>

            <div className="double-row">
              <input
                type="text"
                placeholder="Specialty"
                value={form.specialty}
                onChange={(event) => setForm((current) => ({ ...current, specialty: event.target.value }))}
              />
              <input
                type="text"
                placeholder="Clinic or hospital"
                value={form.clinic}
                onChange={(event) => setForm((current) => ({ ...current, clinic: event.target.value }))}
              />
            </div>

            <input
              type="text"
              placeholder="City"
              value={form.city}
              onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
            />

            <textarea
              className="styled-textarea"
              rows={5}
              placeholder="Short message for the admin team"
              value={form.message}
              onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
            />

            <button className="analyze" type="submit" disabled={sending}>
              {sending ? "Sending..." : "Request addition"}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}