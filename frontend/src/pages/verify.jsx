import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

export default function Verify() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/auth/verify/${token}`
        );

        const data = await res.json();

        if (res.ok) {
          setStatus("success");
          setMessage(data.message || "Account verified successfully");
        } else {
          setStatus("error");
          setMessage(data.message || "Verification failed");
        }
      } catch {
        setStatus("error");
        setMessage("Server not reachable");
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">

      {/* Glow Background */}
      <div className="absolute inset-0 -z-10 blur-3xl opacity-30 bg-gradient-to-r from-blue-500 via-purple-600 to-blue-500 animate-pulseSlow"></div>

      {/* CARD */}
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 text-center animate-fadeIn">

        {/* LOADING */}
        {status === "loading" && (
          <>
            <div className="text-4xl mb-4 animate-spin">⏳</div>
            <h1 className="text-lg md:text-xl font-semibold">
              Verifying your account...
            </h1>
            <p className="text-sm opacity-70 mt-2">
              Please wait while we confirm your email
            </p>
          </>
        )}

        {/* SUCCESS */}
        {status === "success" && (
          <>
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-lg md:text-xl font-semibold text-green-400">
              Verification Successful
            </h1>
            <p className="text-sm mt-2 opacity-80">{message}</p>

            <button
              onClick={() => navigate("/")}
              className="mt-6 w-full py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-600 hover:scale-105 transition"
            >
              Go to Login
            </button>
          </>
        )}

        {/* ERROR */}
        {status === "error" && (
          <>
            <div className="text-4xl mb-4">❌</div>
            <h1 className="text-lg md:text-xl font-semibold text-red-400">
              Verification Failed
            </h1>
            <p className="text-sm mt-2 opacity-80">{message}</p>

            <button
              onClick={() => navigate("/")}
              className="mt-6 w-full py-2 rounded-xl bg-gradient-to-r from-red-500 to-pink-600 hover:scale-105 transition"
            >
              Back to Login
            </button>
          </>
        )}
      </div>

      {/* ANIMATION */}
      <style>
        {`
        @keyframes fadeIn {
          from {opacity:0; transform:translateY(20px);}
          to {opacity:1; transform:translateY(0);}
        }
        .animate-fadeIn {
          animation: fadeIn 0.6s ease;
        }
        `}
      </style>
    </div>
  );
}