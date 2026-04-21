import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import emailjs from "@emailjs/browser";
import { collection, onSnapshot } from "firebase/firestore";
import AppNavbar from "../components/AppNavbar";
import { auth, db } from "../lib/firebase";
import { DEFAULT_DOCTORS, normalizeDoctorDoc } from "../lib/doctors";
import { loadIsAdminByUid } from "../lib/admin";
import "../styles/dash.css";

export default function Appointments() {
  const navigate = useNavigate();
  const location = useLocation();
  const preferredDoctorId = new URLSearchParams(location.search).get("doctorId") || "";
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState({ kind: "", message: "" });
  const [error, setError] = useState("");
  const [doctors, setDoctors] = useState(DEFAULT_DOCTORS);
  const [isAdmin, setIsAdmin] = useState(false);
  const [form, setForm] = useState({
    doctorId: preferredDoctorId || DEFAULT_DOCTORS[0].id,
    date: "",
    time: "",
    reason: "",
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        navigate("/login");
        return;
      }

      const admin = await loadIsAdminByUid(user.uid);
      setIsAdmin(admin);
      if (admin) {
        navigate("/doctors");
        return;
      }
      setAuthChecked(true);
    });

    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (isAdmin) return;

    const doctorsRef = collection(db, "doctors");

    const unsubscribe = onSnapshot(
      doctorsRef,
      (snapshot) => {
        const loadedDoctors = snapshot.docs
          .map(normalizeDoctorDoc)
          .filter((doctor) => doctor.isActive);

        const availableDoctors = loadedDoctors.length > 0 ? loadedDoctors : DEFAULT_DOCTORS;
        setDoctors(availableDoctors);

        setForm((current) => {
          const desiredDoctorId = current.doctorId || preferredDoctorId;
          const selectionStillExists = availableDoctors.some((doctor) => doctor.id === desiredDoctorId);

          return {
            ...current,
            doctorId: selectionStillExists ? desiredDoctorId : (availableDoctors[0]?.id || ""),
          };
        });
      },
      () => {
        setDoctors(DEFAULT_DOCTORS);
      }
    );

    return unsubscribe;
  }, [preferredDoctorId, isAdmin]);

  const selectedDoctor = doctors.find((doctor) => doctor.id === form.doctorId);
  const doctorLat = Number(selectedDoctor?.lat);
  const doctorLng = Number(selectedDoctor?.lng);
  const hasDoctorCoordinates = Number.isFinite(doctorLat) && Number.isFinite(doctorLng);
  const mapEmbedUrl = hasDoctorCoordinates
    ? `https://maps.google.com/maps?q=${doctorLat},${doctorLng}&z=15&output=embed`
    : "";
  const directionsUrl = hasDoctorCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${doctorLat},${doctorLng}`
    : "";
  const currentUser = auth.currentUser;

  const requestAppointment = async (e) => {
    e.preventDefault();
    setError("");
    setBanner({ kind: "", message: "" });

    if (!currentUser) {
      setError("You must be signed in to request an appointment.");
      return;
    }

    if (!form.date || !form.time || !form.reason.trim()) {
      setError("Please complete all fields.");
      return;
    }

    const selectedDateTime = new Date(`${form.date}T${form.time}`);
    if (Number.isNaN(selectedDateTime.getTime()) || selectedDateTime < new Date()) {
      setError("Please choose a future appointment date and time.");
      return;
    }

    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    if (!serviceId || !templateId || !publicKey) {
      setError(
        "Missing EmailJS environment keys (VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY)."
      );
      return;
    }

    setLoading(true);
    try {
      await emailjs.send(
        serviceId,
        templateId,
        {
          doctor_name: selectedDoctor?.name || "Doctor",
          doctor_email: selectedDoctor?.email || "",
          patient_name: currentUser.displayName || "Patient",
          patient_email: currentUser.email || "",
          appointment_date: form.date,
          appointment_time: form.time,
          reason: form.reason.trim(),
          specialty: selectedDoctor?.specialty || "General Medicine",
          reply_instruction:
            "Please reply directly to this email to agree on the final appointment time.",
        },
        { publicKey }
      );

      setBanner({
        kind: "success",
        message: `Request sent to ${selectedDoctor?.name || "the doctor"}. They can reply to confirm the appointment.`,
      });
      setForm((prev) => ({ ...prev, date: "", time: "", reason: "" }));
    } catch (err) {
      setError(err.message || "Failed to send appointment request.");
    } finally {
      setLoading(false);
    }
  };

  if (!authChecked) return null;

  return (
    <>
      <AppNavbar />
      <div className="dashboard appointment-page">
        <section className="top">
          <h1>
            Request an <span>Appointment</span>
          </h1>
          <p>
            This page only starts the conversation. We send the request by email,
            then the doctor and patient can agree on the final time by replying.
          </p>
        </section>

        {error && <div className="dash-error">{error}</div>}
        {banner.message && <div className={`dash-${banner.kind}`}>{banner.message}</div>}

        <div className="card appointment-card">
          <h2>Send request</h2>
          <form className="auth-form" onSubmit={requestAppointment}>
            <select
              className="styled-select"
              value={form.doctorId}
              onChange={(e) => setForm((p) => ({ ...p, doctorId: e.target.value }))}
            >
              {doctors.map((doctor) => (
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

            {selectedDoctor && (
              <div className="doctor-location-card">
                <div className="doctor-location-head">
                  <h3>Doctor location</h3>
                  <span>
                    {[selectedDoctor.clinic, selectedDoctor.city].filter(Boolean).join(" - ") ||
                      "Location details unavailable"}
                  </span>
                </div>

                {hasDoctorCoordinates ? (
                  <>
                    <div className="doctor-map-wrap">
                      <iframe
                        title={`Map for ${selectedDoctor.name || "selected doctor"}`}
                        src={mapEmbedUrl}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                    <a
                      className="map-directions-btn"
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Directions In Google Maps
                    </a>
                  </>
                ) : (
                  <p className="doctor-location-fallback">
                    Directions are unavailable for this doctor right now because map coordinates are missing.
                  </p>
                )}
              </div>
            )}

            <button className="analyze" type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send appointment request"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
