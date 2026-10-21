import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  doc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  orderBy,
  runTransaction,
} from "firebase/firestore";
import AppNavbar from "../components/AppNavbar";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { loadIsAdminByUid } from "../lib/admin";
import { formatCoordinateLabel } from "../lib/doctors";
import { useTranslation } from "react-i18next";
import "../styles/dash.css";

function formatDate(value, lang) {
  if (!value) return null;
  const locale = lang === "ar" ? "ar-TN" : lang === "fr" ? "fr-FR" : "en-GB";
  if (typeof value.toDate === "function") return value.toDate().toLocaleString(locale);
  if (value?.seconds) return new Date(value.seconds * 1000).toLocaleString(locale);
  return null;
}

function getDoctorDocIdFromRequest(requestId) {
  return `doctor_from_request_${requestId}`;
}

function buildDoctorPayload(requestData, requestId, reviewerUid) {
  const lat = requestData.lat ?? null;
  const lng = requestData.lng ?? null;
  const locationLabel =
    String(requestData.locationLabel || "").trim() || formatCoordinateLabel(lat, lng);

  return {
    name: requestData.name || "",
    specialty: requestData.specialty || "",
    email: requestData.email || "",
    clinic: requestData.clinic || "",
    city: requestData.city || "",
    phone: requestData.phone || "",
    lat,
    lng,
    locationLabel,
    isActive: true,
    sourceRequestId: requestId,
    submittedByUid: requestData.submittedByUid || null,
    createdAt: serverTimestamp(),
    approvedAt: serverTimestamp(),
    approvedByUid: reviewerUid || null,
  };
}

function formatRequestLocation(requestEntry) {
  const stored = String(requestEntry.locationLabel || "").trim();
  if (stored) return stored;
  return formatCoordinateLabel(requestEntry.lat, requestEntry.lng);
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
      if (!user) {
        navigate("/login");
        return;
      }
      const isAdmin = await loadIsAdminByUid(user.uid);
      setAdminUser(isAdmin);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (!authChecked) return;
    if (!adminUser) {
      navigate("/doctors");
      return;
    }
    const requestsQuery = query(collection(db, "doctorRequests"), orderBy("submittedAt", "desc"));
    const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      setRequests(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    });
    return unsubscribe;
  }, [authChecked, adminUser, navigate]);

  if (!authChecked || !adminUser) return null;

  const getStatusLabel = (statusCode) => {
    const normalized = String(statusCode || "pending").toLowerCase();
    if (normalized === "approved") return t("doctorRequests.status.approved");
    if (normalized === "rejected") return t("doctorRequests.status.rejected");
    return t("doctorRequests.status.pending");
  };

  const approveRequest = async (requestEntry) => {
    setBusyId(requestEntry.id);
    setStatus({ kind: "", message: "" });
    try {
      const reviewerUid = auth.currentUser?.uid || null;
      const requestRef = doc(db, "doctorRequests", requestEntry.id);
      const doctorRef = doc(db, "doctors", getDoctorDocIdFromRequest(requestEntry.id));

      const transactionResult = await runTransaction(db, async (transaction) => {
        const requestSnap = await transaction.get(requestRef);
        if (!requestSnap.exists()) {
          throw new Error(t("doctorRequests.errors.approveFailed"));
        }

        const requestData = requestSnap.data() || {};
        const currentStatus = String(requestData.status || "pending").toLowerCase();
        if (currentStatus !== "pending") {
          if (currentStatus === "approved") {
            const doctorSnap = await transaction.get(doctorRef);
            if (!doctorSnap.exists()) {
              transaction.set(
                doctorRef,
                buildDoctorPayload(requestData, requestEntry.id, reviewerUid),
                { merge: true }
              );
            }
          }
          return { transitioned: false, status: currentStatus };
        }

        transaction.set(
          doctorRef,
          buildDoctorPayload(requestData, requestEntry.id, reviewerUid),
          { merge: true }
        );
        transaction.update(requestRef, {
          status: "approved",
          reviewedAt: serverTimestamp(),
          reviewedByUid: reviewerUid,
        });
        return { transitioned: true, status: "approved" };
      });

      if (transactionResult.transitioned) {
        setStatus({
          kind: "success",
          message: t("doctorRequests.messages.approvedAdded", { name: requestEntry.name }),
        });
      } else if (transactionResult.status === "approved") {
        setStatus({
          kind: "success",
          message: `${requestEntry.name}: ${t("doctorRequests.approved")}`,
        });
      } else {
        setStatus({
          kind: "warning",
          message: `${t("doctorRequests.statusLabel")}: ${getStatusLabel(transactionResult.status)}`,
        });
      }
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
      const reviewerUid = auth.currentUser?.uid || null;
      const requestRef = doc(db, "doctorRequests", requestEntry.id);

      const transactionResult = await runTransaction(db, async (transaction) => {
        const requestSnap = await transaction.get(requestRef);
        if (!requestSnap.exists()) {
          throw new Error(t("doctorRequests.errors.rejectFailed"));
        }

        const requestData = requestSnap.data() || {};
        const currentStatus = String(requestData.status || "pending").toLowerCase();
        if (currentStatus !== "pending") {
          return { transitioned: false, status: currentStatus };
        }

        transaction.update(requestRef, {
          status: "rejected",
          reviewedAt: serverTimestamp(),
          reviewedByUid: reviewerUid,
        });
        return { transitioned: true, status: "rejected" };
      });

      if (transactionResult.transitioned) {
        setStatus({
          kind: "warning",
          message: t("doctorRequests.messages.rejected", { name: requestEntry.name }),
        });
      } else {
        setStatus({
          kind: "warning",
          message: `${t("doctorRequests.statusLabel")}: ${getStatusLabel(transactionResult.status)}`,
        });
      }
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
                const requestLocation = formatRequestLocation(requestEntry);
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
                      <small>
                        {t("doctorRequests.statusLabel")}: {getStatusLabel(requestEntry.status)}
                      </small>
                      <small>
                        {t("doctorRequests.submittedLabel")}: {submittedLabel || t("doctorRequests.justNow")}
                      </small>
                      <small>
                        {t("doctorRequests.locationLabel")}:{" "}
                        {requestLocation || t("doctorRequests.locationMissing")}
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
