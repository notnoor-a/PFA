import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import emailjs from "@emailjs/browser";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import AppNavbar from "../components/AppNavbar";
import { auth, db } from "../lib/firebase";
import "../styles/dash.css";

const DOCTORS = [
  { id: "dr-haddad", name: "Dr. Yasmine Haddad", specialty: "Cardiology", email: "dr.haddad@smartmedic.example" },
  { id: "dr-benali", name: "Dr. Karim Benali", specialty: "Dermatology", email: "dr.benali@smartmedic.example" },
  { id: "dr-rahmani", name: "Dr. Salim Rahmani", specialty: "Neurology", email: "dr.rahmani@smartmedic.example" },
  { id: "dr-meziane", name: "Dr. Lina Meziane", specialty: "General Medicine", email: "dr.meziane@smartmedic.example" },
];

export default function Appointments() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [uid, setUid] = useState(auth.currentUser?.uid || "");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [actionBusyId, setActionBusyId] = useState("");
  const [rescheduleState, setRescheduleState] = useState({ id: "", date: "", time: "" });
  const [form, setForm] = useState({
    doctorId: DOCTORS[0].id,
    date: "",
    time: "",
    reason: "",
  });

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate("/login");
        return;
      }
      setUid(user.uid);
      setAuthChecked(true);
    });
    return unsub;
  }, [navigate]);

  const selectedDoctor = DOCTORS.find((d) => d.id === form.doctorId);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "appointments"),
      where("patientUid", "==", uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setAppointments(list);
    });
    return unsub;
  }, [uid]);

  const bookAppointment = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");
    if (!form.date || !form.time || !form.reason.trim()) {
      setError("Please complete all fields.");
      return;
    }
    const selectedDateTime = new Date(`${form.date}T${form.time}`);
    if (Number.isNaN(selectedDateTime.getTime()) || selectedDateTime < new Date()) {
      setError("Please choose a future appointment date and time.");
      return;
    }

    if (!selectedDoctor || !auth.currentUser) return;

    setLoading(true);
    try {
      await addDoc(collection(db, "appointments"), {
        patientUid: auth.currentUser.uid,
        patientName: auth.currentUser.displayName || "",
        patientEmail: auth.currentUser.email || "",
        doctorId: selectedDoctor.id,
        doctorName: selectedDoctor.name,
        doctorEmail: selectedDoctor.email,
        specialty: selectedDoctor.specialty,
        date: form.date,
        time: form.time,
        reason: form.reason.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
      });

      const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
      const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

      if (!serviceId || !templateId || !publicKey) {
        throw new Error(
          "Missing EmailJS environment keys (VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY)."
        );
      }

      await emailjs.send(
        serviceId,
        templateId,
        {
          doctor_name: selectedDoctor.name,
          doctor_email: selectedDoctor.email,
          patient_name: auth.currentUser.displayName || "Patient",
          patient_email: auth.currentUser.email || "",
          appointment_date: form.date,
          appointment_time: form.time,
          reason: form.reason.trim(),
          specialty: selectedDoctor.specialty,
        },
        { publicKey }
      );

      setStatus(`Appointment booked and email sent to ${selectedDoctor.name}.`);
      setForm((prev) => ({ ...prev, date: "", time: "", reason: "" }));
    } catch (err) {
      setError(err.message || "Failed to book appointment.");
    } finally {
      setLoading(false);
    }
  };

  const cancelAppointment = async (id) => {
    setActionBusyId(id);
    setError("");
    setStatus("");
    try {
      await updateDoc(doc(db, "appointments", id), {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      });
      setStatus("Appointment cancelled.");
    } catch (err) {
      setError(err.message || "Could not cancel appointment.");
    } finally {
      setActionBusyId("");
    }
  };

  const openReschedule = (entry) => {
    setRescheduleState({ id: entry.id, date: entry.date || "", time: entry.time || "" });
  };

  const saveReschedule = async () => {
    if (!rescheduleState.id || !rescheduleState.date || !rescheduleState.time) {
      setError("Please fill date and time for reschedule.");
      return;
    }
    const selectedDateTime = new Date(`${rescheduleState.date}T${rescheduleState.time}`);
    if (Number.isNaN(selectedDateTime.getTime()) || selectedDateTime < new Date()) {
      setError("Please choose a future schedule.");
      return;
    }

    setActionBusyId(rescheduleState.id);
    setError("");
    setStatus("");
    try {
      await updateDoc(doc(db, "appointments", rescheduleState.id), {
        date: rescheduleState.date,
        time: rescheduleState.time,
        status: "rescheduled",
        updatedAt: serverTimestamp(),
      });
      setStatus("Appointment rescheduled.");
      setRescheduleState({ id: "", date: "", time: "" });
    } catch (err) {
      setError(err.message || "Could not reschedule appointment.");
    } finally {
      setActionBusyId("");
    }
  };

  if (!authChecked) return null;

  return (
    <>
      <AppNavbar />
      <div className="dashboard appointment-page">
        <section className="top">
          <h1>
            Book an <span>Appointment</span>
          </h1>
          <p>Choose your doctor, schedule your visit, and notify the doctor by email.</p>
        </section>

        {error && <div className="dash-error">{error}</div>}
        {status && <div className="dash-success">{status}</div>}

        <div className="card appointment-card">
          <h2>Appointment details</h2>
          <form className="auth-form" onSubmit={bookAppointment}>
            <select
              className="styled-select"
              value={form.doctorId}
              onChange={(e) => setForm((p) => ({ ...p, doctorId: e.target.value }))}
            >
              {DOCTORS.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name} - {doctor.specialty}
                </option>
              ))}
            </select>

            <div className="double-row">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              />
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
              />
            </div>

            <textarea
              className="styled-textarea"
              rows={5}
              placeholder="Reason for visit"
              value={form.reason}
              onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
            />

            <div className="doctor-preview">
              <h3>Selected doctor</h3>
              <p>{selectedDoctor?.name}</p>
              <span>{selectedDoctor?.specialty}</span>
            </div>

            <button className="analyze" type="submit" disabled={loading}>
              {loading ? "Booking..." : "Book appointment"}
            </button>
          </form>
        </div>

        <div className="card appointment-card my-appointments-card">
          <h2>My appointments</h2>
          {appointments.length === 0 ? (
            <p className="profile-sub">You have no appointments yet.</p>
          ) : (
            <div className="appointment-list">
              {appointments.map((entry) => (
                <div key={entry.id} className="appointment-item">
                  <div className="appointment-main">
                    <h3>{entry.doctorName}</h3>
                    <p>{entry.specialty}</p>
                    <span>
                      {entry.date} at {entry.time}
                    </span>
                    <small>{entry.reason}</small>
                  </div>
                  <div className="appointment-actions">
                    <span className={`appointment-status ${entry.status || "pending"}`}>
                      {entry.status || "pending"}
                    </span>
                    {entry.status !== "cancelled" && (
                      <>
                        <button
                          className="history-clear-btn"
                          type="button"
                          onClick={() => openReschedule(entry)}
                          disabled={actionBusyId === entry.id}
                        >
                          Reschedule
                        </button>
                        <button
                          className="history-clear-btn cancel"
                          type="button"
                          onClick={() => cancelAppointment(entry.id)}
                          disabled={actionBusyId === entry.id}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {rescheduleState.id && (
            <div className="reschedule-box">
              <h3>Reschedule appointment</h3>
              <div className="double-row">
                <input
                  type="date"
                  value={rescheduleState.date}
                  onChange={(e) =>
                    setRescheduleState((p) => ({ ...p, date: e.target.value }))
                  }
                />
                <input
                  type="time"
                  value={rescheduleState.time}
                  onChange={(e) =>
                    setRescheduleState((p) => ({ ...p, time: e.target.value }))
                  }
                />
              </div>
              <div className="reschedule-actions">
                <button
                  className="analyze"
                  type="button"
                  onClick={saveReschedule}
                  disabled={actionBusyId === rescheduleState.id}
                >
                  {actionBusyId === rescheduleState.id
                    ? "Saving..."
                    : "Save new schedule"}
                </button>
                <button
                  className="history-clear-btn"
                  type="button"
                  onClick={() => setRescheduleState({ id: "", date: "", time: "" })}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
