import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./index.css";

export default function AuthSwipe() {
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    date: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // simple validation
    if (!form.email || !form.password) {
      alert("Please fill required fields");
      return;
    }

    if (isSignUp && form.password !== form.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    // simulate login success
    navigate("/dashboard");
  };

  return (
    <div className={`auth-page ${isSignUp ? "signup-mode" : ""}`}>
      <div className="auth-card">

        {/* LEFT */}
        <div className="auth-panel auth-left">
          <h1>Smart Medic</h1>
          <h2>{isSignUp ? "Sign Up" : "Login"}</h2>

          <p>
            {isSignUp
              ? "Start your personal health journey with AI support"
              : "Access your personal health dashboard and AI medical assistant"}
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>

            {isSignUp &&
             (<input type="text" name="name" placeholder="Full Name" onChange={handleChange}/>)}

            <input type="email" name="email" placeholder="Email" onChange={handleChange}/>

            {isSignUp && (<input type="date" name="date" onChange={handleChange}/>)}

            <input type="password" name="password" placeholder="Password" onChange={handleChange} />

            {isSignUp && (
              <input type="password" name="confirmPassword" placeholder="Confirm Password" onChange={handleChange}/>
            )}

            <button type="submit" className="btn primary">
              {isSignUp ? "SIGN UP" : "Login"}
            </button>
          </form>
        </div>

        {/* RIGHT */}
        <div className="auth-panel auth-right">
          {!isSignUp ? (
            <>
              <h3>New Here?</h3>
              <p>Create an account and start using Smart Medic</p>

              <button type="button" className="btn outline" onClick={() => setIsSignUp(true)}>
                SIGN UP
              </button>
            </>
          ) : (
            <>
              <h3>You already have an account?</h3>
              <p>Login to continue your dashboard</p>

              <button type="button" className="btn outline" onClick={() => setIsSignUp(false)}>
                Login
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}