import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function AppNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  const isActive = (path) => (location.pathname === path ? "active" : "");

  return (
    <nav className="navbar">
      <div className="navbar-brand" onClick={() => navigate("/dashboard")}>
        <span className="nav-logo">⚕</span>
        <span>Smart Medic</span>
      </div>

      <div className="navbar-links">
        <button
          className={`nav-link ${isActive("/dashboard")}`}
          onClick={() => navigate("/dashboard")}
        >
          Dashboard
        </button>
        <button
          className={`nav-link ${isActive("/appointments")}`}
          onClick={() => navigate("/appointments")}
        >
          Appointments
        </button>
        <button
          className={`nav-link ${isActive("/history")}`}
          onClick={() => navigate("/history")}
        >
          History
        </button>
      </div>

      <div className="navbar-user">
        <div
          className="nav-avatar"
          onClick={() => navigate("/profile")}
          title="Open profile"
        >
          {user?.photoURL ? (
            <img
              className="nav-avatar-image"
              src={user.photoURL}
              alt="Profile"
            />
          ) : (
            user?.displayName?.[0]?.toUpperCase() ||
            user?.email?.[0]?.toUpperCase() ||
            "U"
          )}
        </div>
      </div>
    </nav>
  );
}
