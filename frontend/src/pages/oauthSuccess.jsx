import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

export default function OAuthSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const isAdmin = params.get("isAdmin") === "true";

    if (!token) {
      navigate("/");
      return;
    }

    // Store token first
    localStorage.setItem("token", token);

    // Fetch full user data using the token
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
          navigate(data.user.isAdmin ? "/admin" : "/dashboard");
        } else {
          navigate("/");
        }
      })
      .catch(() => {
        // Fallback to URL param if /me fails
        navigate(isAdmin ? "/admin" : "/dashboard");
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
      <span className="animate-pulse">Signing you in…</span>
    </div>
  );
}