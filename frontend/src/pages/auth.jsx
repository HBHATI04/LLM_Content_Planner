import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

export default function Auth() {
  const [activeTab, setActiveTab] = useState("signin");
  const [errors, setErrors] = useState({});

  // ✅ Separate captcha states
  const [loginCaptcha, setLoginCaptcha] = useState(null);
  const [signupCaptcha, setSignupCaptcha] = useState(null);

  const navigate = useNavigate();
  const cardRef = useRef();

  // ================= PARALLAX =================
  const handleMouseMove = (e) => {
    if (window.innerWidth < 768) return;
    const card = cardRef.current;
    if (!card) return;

    const x = (window.innerWidth / 2 - e.clientX) / 30;
    const y = (window.innerHeight / 2 - e.clientY) / 30;

    card.style.transform = `rotateY(${x}deg) rotateX(${y}deg)`;
  };

  // ================= PASSWORD VALIDATION =================
  const validatePassword = (password) => {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*]/.test(password),
    };
  };

  // ================= LOGIN =================
  const login = async (e) => {
    e.preventDefault();
    setErrors({});

    if (!loginCaptcha) {
      setErrors({ general: "Please complete CAPTCHA" });
      return;
    }

    const form = new FormData(e.target);
    const email = form.get("email");
    const password = form.get("password");

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          captcha: loginCaptcha,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        navigate(data.user.isAdmin ? "/admin" : "/dashboard");
      } else {
        setErrors({ general: data.message || "Login failed" });
      }
    } catch {
      setErrors({ general: "Server not reachable" });
    }

    setLoginCaptcha(null);
  };

  // ================= SIGNUP =================
  const signup = async (e) => {
    e.preventDefault();
    setErrors({});

    if (!signupCaptcha) {
      setErrors({ general: "Please complete CAPTCHA" });
      return;
    }

    const form = new FormData(e.target);
    const name = form.get("name");
    const email = form.get("email");
    const password = form.get("password");
    const confirmPassword = form.get("confirmPassword");
    const profession = form.get("profession");

    let newErrors = {};
    const rules = validatePassword(password);

    if (!rules.length)
      newErrors.password = "At least 8 characters required";
    else if (!rules.uppercase)
      newErrors.password = "Must include uppercase letter";
    else if (!rules.number)
      newErrors.password = "Must include number";
    else if (!rules.special)
      newErrors.password = "Must include special character";

    if (password !== confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";

    if (!profession) {
      newErrors.profession = "Please select a profession";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          profession,
          captcha: signupCaptcha,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setActiveTab("signin");
      } else {
        setErrors({ general: data.message || "Signup failed" });
      }
    } catch {
      setErrors({ general: "Server not reachable" });
    }

    setSignupCaptcha(null);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="min-h-screen flex items-center justify-center px-4 py-6 bg-gradient-to-br from-[#0f2027] via-[#203a43] to-[#2c5364] text-white"
    >
      {/* CARD */}
      <div
        ref={cardRef}
        className="w-full max-w-5xl backdrop-blur-xl bg-white/10 rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden transition-transform duration-200"
      >
        {/* LEFT */}
        <div className="md:w-1/2 p-8 md:p-12 bg-gradient-to-br from-purple-600 to-cyan-400 flex flex-col justify-center text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            LLM Content Planner
          </h1>
          <p className="text-sm md:text-base">
            Plan, generate, and scale content using AI.
          </p>
        </div>

        {/* RIGHT */}
        <div className="md:w-1/2 p-8 md:p-12 bg-black/40">
          {/* TABS */}
          <div className="flex mb-6">
            <button
              onClick={() => {
                setActiveTab("signin");
                setLoginCaptcha(null);
              }}
              className={`flex-1 pb-2 font-semibold border-b-2 ${activeTab === "signin"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent"
                }`}
            >
              Sign In
            </button>

            <button
              onClick={() => {
                setActiveTab("signup");
                setSignupCaptcha(null);
              }}
              className={`flex-1 pb-2 font-semibold border-b-2 ${activeTab === "signup"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent"
                }`}
            >
              Sign Up
            </button>
          </div>

          {errors.general && (
            <p className="text-red-400 text-sm text-center mb-3">
              {errors.general}
            </p>
          )}

          {/* SIGN IN */}
          {activeTab === "signin" && (
            <form onSubmit={login} className="space-y-4 animate-fadeIn">
              <input
                name="email"
                type="email"
                placeholder="Email"
                className="w-full p-3 rounded-lg bg-white/10"
              />

              <input
                name="password"
                type="password"
                placeholder="Password"
                className="w-full p-3 rounded-lg bg-white/10"
              />

              {/* CAPTCHA */}
              <div className="flex justify-center">
                <ReCAPTCHA
                  sitekey="6LcRQHEsAAAAANWKt632AdNjecSWCVRgOj99o22L"
                  onChange={(token) => setLoginCaptcha(token)}
                  theme="dark"
                />
              </div>

              <button className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-400 to-purple-600">
                Sign In
              </button>

              <p className="text-xs text-center opacity-80">
                Welcome back 🚀
              </p>

              <p className="text-center text-cyan-400 animate-pulse text-sm">
                🤖 AI agents standing by…
              </p>

              {/* GOOGLE */}
              <a
                href={`${API_BASE}/api/auth/google`}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white text-black font-semibold"
              >
                <img
                  src="https://developers.google.com/identity/images/g-logo.png"
                  alt="google"
                  className="w-5 h-5"
                />
                Continue with Google
              </a>
            </form>
          )}

          {/* SIGN UP */}
          {activeTab === "signup" && (
            <form onSubmit={signup} className="space-y-4 animate-slideUp">
              <input
                name="name"
                type="text"
                placeholder="Full Name"
                className="w-full p-3 rounded-lg bg-white/10"
              />

              <input
                name="email"
                type="email"
                placeholder="Email"
                className="w-full p-3 rounded-lg bg-white/10"
              />

              <input
                name="password"
                type="password"
                placeholder="Password"
                className="w-full p-3 rounded-lg bg-white/10"
              />

              {errors.password && (
                <p className="text-red-400 text-xs">{errors.password}</p>
              )}

              <input
                name="confirmPassword"
                type="password"
                placeholder="Confirm Password"
                className="w-full p-3 rounded-lg bg-white/10"
              />

              {errors.confirmPassword && (
                <p className="text-red-400 text-xs">
                  {errors.confirmPassword}
                </p>
              )}

              <select
                name="profession"
                className="w-full p-3 rounded-lg bg-white/10 text-white"
                defaultValue=""
              >
                <option value="" disabled className="text-black">
                  Select Profession
                </option>
                <option value="student" className="text-black">Student</option>
                <option value="teacher" className="text-black">Teacher</option>
                <option value="engineer" className="text-black">Engineer</option>
                <option value="doctor" className="text-black">Researcher</option>
              </select>

              {errors.profession && (
                <p className="text-red-400 text-xs">{errors.profession}</p>
              )}

              {/* CAPTCHA */}
              <div className="flex justify-center">
                <ReCAPTCHA
                  sitekey="6LcRQHEsAAAAANWKt632AdNjecSWCVRgOj99o22L"
                  onChange={(token) => setSignupCaptcha(token)}
                  theme="dark"
                />
              </div>

              <button className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-400 to-purple-600">
                Create Account
              </button>

              <p className="text-xs text-center opacity-80">
                Start planning content with AI ✨
              </p>

              <p className="text-center text-cyan-400 animate-pulse text-sm">
                🧠 Crew agents warming up…
              </p>
            </form>
          )}
        </div>
      </div>

      {/* ANIMATIONS */}
      <style>
        {`
        @keyframes fadeIn {
          from {opacity:0; transform:translateY(20px);}
          to {opacity:1; transform:translateY(0);}
        }
        .animate-fadeIn { animation: fadeIn 0.6s ease; }

        @keyframes slideUp {
          from {opacity:0; transform:translateY(20px);}
          to {opacity:1; transform:translateY(0);}
        }
        .animate-slideUp { animation: slideUp 0.6s ease; }
        `}
      </style>
    </div>
  );
}
