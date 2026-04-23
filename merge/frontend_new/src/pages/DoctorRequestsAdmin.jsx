import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, addDoc, collection, onSnapshot, query, serverTimestamp, updateDoc, orderBy } from "firebase/firestore";
import AppNavbar from "../components/AppNavbar";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { loadIsAdminByUid } from "../lib/admin";
import { useTranslation } from "react-i18next";
import "../styles/dash.css";

function formatDate(value, lang) {
  if (!value) return null;
  const locale = lang === "ar" ? "ar-TN" : lang === "fr" ? "fr-FR" : "en-GB";
  if (typeof value.toDate === "function") return value.toDate().toLocaleString(locale);
  if (value?.seconds) return new Date(value.seconds * 1000).toLocaleString(locale);
  return null;
}

export default function DoctorRequestsAdmin() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [busyId, setBusyId] = useState("");
  const [status, setStatus] = useState({ kind: "", message: "" });
  const [authChecked, setAuthChecked] = useState(false);
  const [adminUser, setAdminUser] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate("/login"); return; }
      const isAdmin = await loadIsAdminByUid(user.uid);
      setAdminUser(isAdmin);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (!authChecked) return;
    if (!adminUser) { navigate("/doctors"); return; }
    const requestsQuery = query(collection(db, "doctorRequests"), orderBy("submittedAt", "desc"));
    const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      setRequests(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    });
    return unsubscribe;
  }, [authChecked, adminUser, navigate]);

  if (!authChecked || !adminUser) return null;

  const approveRequest = async (requestEntry) => {
    setBusyId(requestEntry.id);
    setStatus({ kind: "", message: "" });
    try {
      await addDoc(collection(db, "doctors"), {
        name: requestEntry.name,
        specialty: requestEntry.specialty,
        email: requestEntry.email,
        clinic: requestEntry.clinic || "",
        city: requestEntry.city || "",
        phone: requestEntry.phone || "",
        lat: requestEntry.lat ?? null,
        lng: requestEntry.lng ?? null,
        isActive: true,
        sourceRequestId: requestEntry.id,
        createdAt: serverTimestamp(),
        approvedAt: serverTimestamp(),
        approvedByUid: auth.currentUser?.uid || null,
      });
      await updateDoc(doc(db, "doctorRequests", requestEntry.id), {
        status: "approved",
        reviewedAt: serverTimestamp(),
        reviewedByUid: auth.currentUser?.uid || null,
      });
      setStatus({ kind: "success", message: `${requestEntry.name} was approved and added to the doctors list.` });
    } catch (err) {
      setStatus({ kind: "error", message: err.message || t("doctorRequests.errors.approveFailed") });
    } finally {
      setBusyId("");
    }
  };

  const rejectRequest = async (requestEntry) => {
    setBusyId(requestEntry.id);
    setStatus({ kind: "", message: "" });
    try {
      await updateDoc(doc(db, "doctorRequests", requestEntry.id), {
        status: "rejected",
        reviewedAt: serverTimestamp(),
        reviewedByUid: auth.currentUser?.uid || null,
      });
      setStatus({ kind: "warning", message: `${requestEntry.name} was rejected.` });
    } catch (err) {
      setStatus({ kind: "error", message: err.message || t("doctorRequests.errors.rejectFailed") });
    } finally {
      setBusyId("");
    }
  };

  return (
    <>
      <AppNavbar />
      <div className="dashboard">
        <section className="top">
          <h1>
            {t("doctorRequests.title")} <span>{t("doctorRequests.titleSpan")}</span>
          </h1>
          <p>{t("doctorRequests.subtitle")}</p>
        </section>

        {status.message && <div className={`dash-${status.kind}`}>{status.message}</div>}

        <div className="card">
          <h2>{t("doctorRequests.pendingRequests")}</h2>
          {requests.length === 0 ? (
            <p className="profile-sub">{t("doctorRequests.noRequests")}</p>
          ) : (
            <div className="appointment-list">
              {requests.map((requestEntry) => {
                const submittedLabel = formatDate(requestEntry.submittedAt, i18n.language);
                return (
                  <div key={requestEntry.id} className="appointment-item">
                    <div className="appointment-main">
                      <h3>{requestEntry.name}</h3>
                      <p>{requestEntry.specialty}</p>
                      <span>{requestEntry.email}</span>
                      <small>
                        {requestEntry.clinic || t("doctorRequests.clinicNotListed")}
                        {requestEntry.city ? ` - ${requestEntry.city}` : ""}
                      </small>
                      <small>Status: {requestEntry.status || "pending"}</small>
                      <small>
                        Submitted: {submittedLabel || t("doctorRequests.justNow")}
                      </small>
                    </div>

                    <div className="appointment-actions">
                      {requestEntry.status === "approved" ? (
                        <span className="appointment-status approved">{t("doctorRequests.approved")}</span>
                      ) : requestEntry.status === "rejected" ? (
                        <span className="appointment-status cancelled">{t("doctorRequests.rejected")}</span>
                      ) : (
                        <>
                          <button
                            className="history-clear-btn"
                            type="button"
                            onClick={() => approveRequest(requestEntry)}
                            disabled={busyId === requestEntry.id}
                          >
                            {t("doctorRequests.approve")}
                          </button>
                          <button
                            className="history-clear-btn cancel"
                            type="button"
                            onClick={() => rejectRequest(requestEntry)}
                            disabled={busyId === requestEntry.id}
                          >
                            {t("doctorRequests.reject")}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
