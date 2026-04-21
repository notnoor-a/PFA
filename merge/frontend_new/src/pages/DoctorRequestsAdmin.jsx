import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, addDoc, collection, onSnapshot, query, serverTimestamp, updateDoc, orderBy } from "firebase/firestore";
import AppNavbar from "../components/AppNavbar";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { loadIsAdminByUid } from "../lib/admin";
import "../styles/dash.css";

function formatDate(value) {
  if (!value) return "Just now";
  if (typeof value.toDate === "function") {
    return value.toDate().toLocaleString();
  }
  if (value?.seconds) {
    return new Date(value.seconds * 1000).toLocaleString();
  }
  return "Just now";
}

export default function DoctorRequestsAdmin() {
  const navigate = useNavigate();
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

  if (!authChecked) return null;
  if (!adminUser) return null;

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
      setStatus({ kind: "error", message: err.message || "Could not approve request." });
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
      setStatus({ kind: "error", message: err.message || "Could not reject request." });
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
            Doctor <span>Requests</span>
          </h1>
          <p>Review pending doctor requests and approve them into the live doctors directory.</p>
        </section>

        {status.message && <div className={`dash-${status.kind}`}>{status.message}</div>}

        <div className="card">
          <h2>Pending requests</h2>
          {requests.length === 0 ? (
            <p className="profile-sub">No doctor requests yet.</p>
          ) : (
            <div className="appointment-list">
              {requests.map((requestEntry) => (
                <div key={requestEntry.id} className="appointment-item">
                  <div className="appointment-main">
                    <h3>{requestEntry.name}</h3>
                    <p>{requestEntry.specialty}</p>
                    <span>{requestEntry.email}</span>
                    <small>
                      {requestEntry.clinic || "Clinic not listed"}
                      {requestEntry.city ? ` - ${requestEntry.city}` : ""}
                    </small>
                    <small>Status: {requestEntry.status || "pending"}</small>
                    <small>Submitted: {formatDate(requestEntry.submittedAt)}</small>
                  </div>

                  <div className="appointment-actions">
                    {requestEntry.status === "approved" ? (
                      <span className="appointment-status approved">Approved</span>
                    ) : requestEntry.status === "rejected" ? (
                      <span className="appointment-status cancelled">Rejected</span>
                    ) : (
                      <>
                        <button
                          className="history-clear-btn"
                          type="button"
                          onClick={() => approveRequest(requestEntry)}
                          disabled={busyId === requestEntry.id}
                        >
                          Approve
                        </button>
                        <button
                          className="history-clear-btn cancel"
                          type="button"
                          onClick={() => rejectRequest(requestEntry)}
                          disabled={busyId === requestEntry.id}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}