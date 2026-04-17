import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

import QuestPage  from "./Quest";
import AuthSwipe  from "./login";
import Dashboard  from "./dashboard";
import Learn      from "./learn";
import History    from "./history";

/* ─── Protected Route ─── */
function ProtectedRoute({ children }) {
  const [status, setStatus] = useState("loading"); // "loading" | "auth" | "unauth"

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setStatus(user ? "auth" : "unauth");
    });
    return unsub;
  }, []);

  if (status === "loading") {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f2747",
        color: "rgba(255,255,255,0.5)",
        fontFamily: "DM Sans, sans-serif",
        fontSize: "0.95rem",
        gap: "12px"
      }}>
        <div style={{
          width: 24, height: 24,
          border: "3px solid rgba(255,255,255,0.15)",
          borderTop: "3px solid #4bc0e0",
          borderRadius: "50%",
          animation: "spin 0.9s linear infinite"
        }} />
        Loading…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (status === "unauth") return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<QuestPage />} />
        <Route path="/login"   element={<AuthSwipe />} />
        <Route path="/learn"   element={<Learn />} />

        {/* Protected */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/history"   element={<ProtectedRoute><History /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
