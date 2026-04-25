import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

const EXPERTS = [
  { emoji: "🎯", label: "Content Strategist", desc: "Brand positioning & content roadmaps", color: "#4f8ef7" },
  { emoji: "✍️", label: "Copywriter",         desc: "Compelling copy that converts",        color: "#34d399" },
  { emoji: "🔍", label: "SEO Expert",          desc: "Rank higher, reach further",           color: "#fbbf24" },
  { emoji: "📱", label: "Social Media",        desc: "Viral posts & hashtag strategy",       color: "#f472b6" },
  { emoji: "📊", label: "Campaign Analyst",    desc: "Data-driven campaign insights",        color: "#c084fc" },
];

const FEATURES = [
  { icon: "⚡", title: "Real-time Streaming",    desc: "Watch your content generate token by token with live SSE streaming." },
  { icon: "🎙️", title: "Voice Input",            desc: "Speak your brief. Groq Whisper transcribes instantly." },
  { icon: "🖼️", title: "Image Generation",       desc: "Stable Diffusion images from a single text prompt." },
  { icon: "📄", title: "PDF & DOCX Export",      desc: "Download polished reports ready to share with clients." },
  { icon: "🧠", title: "Memory Context",          desc: "Agents remember your conversation history for coherent outputs." },
  { icon: "📈", title: "Admin Analytics",         desc: "Track token usage, response times, and agent performance." },
];

const STEPS = [
  { n: "01", title: "Pick Your Expert",         desc: "Choose from 5 specialized agents — Strategist, Copywriter, SEO, Social, or Analyst." },
  { n: "02", title: "Type or Speak Your Brief", desc: "Use the keyboard or hit the mic button — Whisper AI transcribes your voice instantly." },
  { n: "03", title: "Watch It Generate",        desc: "3 sub-agents (analyst → specialist → reviewer) collaborate. Tokens stream in real time." },
  { n: "04", title: "Export & Ship",            desc: "Download as PDF or DOCX, or copy straight from the chat. Done." },
];

function useTypewriter(words, speed = 85) {
  const [text, setText] = useState("");
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = words[wordIdx];
    const timeout = setTimeout(() => {
      setText(current.substring(0, charIdx));
      if (!deleting && charIdx < current.length) {
        setCharIdx(c => c + 1);
      } else if (deleting && charIdx > 0) {
        setCharIdx(c => c - 1);
      } else if (!deleting && charIdx === current.length) {
        setTimeout(() => setDeleting(true), 1400);
      } else {
        setDeleting(false);
        setWordIdx(i => (i + 1) % words.length);
      }
    }, deleting ? speed / 2 : speed);
    return () => clearTimeout(timeout);
  }, [charIdx, deleting, wordIdx, words, speed]);

  return text;
}

function StatCounter({ value, label, color }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const observed = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !observed.current) {
        observed.current = true;
        const target = parseInt(value.replace(/\D/g, ""));
        if (!target) { setCount(value); return; }
        let cur = 0;
        const step = Math.max(1, Math.floor(target / 60));
        const t = setInterval(() => {
          cur = Math.min(cur + step, target);
          setCount(cur);
          if (cur >= target) clearInterval(t);
        }, 16);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  const suffix = value.replace(/[\d,]/g, "");
  const isText = isNaN(parseInt(value));

  return (
    <div ref={ref} style={{ textAlign: "center" }}>
      <div style={{ fontSize: "clamp(28px,5vw,44px)", fontWeight: 800, color, fontFamily: "'Clash Display', 'Space Grotesk', sans-serif", lineHeight: 1.1 }}>
        {isText ? value : `${count.toLocaleString()}${suffix}`}
      </div>
      <div style={{ fontSize: "clamp(11px,2vw,13px)", color: "rgba(148,163,184,0.5)", marginTop: 8, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const typed = useTypewriter(["Strategies", "Blog Posts", "Ad Copy", "Hashtags", "Campaigns", "Reports"]);
  const [scrolled, setScrolled] = useState(false);
  const [activeExpert, setActiveExpert] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setActiveExpert(i => (i + 1) % EXPERTS.length), 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      background: "#07090f",
      color: "#e8edf5",
      minHeight: "100vh",
      fontFamily: "'DM Sans', sans-serif",
      overflowX: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { -webkit-font-smoothing: antialiased; }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #1e2d45; border-radius: 99px; }

        a { text-decoration: none; color: inherit; }

        @keyframes fadeUp    { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
        @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulse-dot { 0%,100%{transform:scale(1);opacity:0.7} 50%{transform:scale(1.4);opacity:1} }
        @keyframes float     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes shimmer   { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes spin-slow { to{transform:rotate(360deg)} }
        @keyframes gradMove  { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes slideIn   { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }

        .nav-link {
          font-size: 13px;
          font-weight: 500;
          color: rgba(148,163,184,0.6);
          transition: color 0.2s;
          letter-spacing: 0.02em;
        }
        .nav-link:hover { color: #e8edf5; }

        .card-agent {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 18px;
          padding: 22px 20px;
          transition: all 0.25s ease;
          cursor: default;
          position: relative;
          overflow: hidden;
        }
        .card-agent:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.12);
          transform: translateY(-4px);
        }
        .card-agent::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 18px;
          opacity: 0;
          transition: opacity 0.3s;
        }
        .card-agent:hover::before { opacity: 1; }

        .card-feature {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 18px;
          padding: 26px 24px;
          transition: all 0.25s ease;
        }
        .card-feature:hover {
          background: rgba(79,142,247,0.06);
          border-color: rgba(79,142,247,0.15);
          transform: translateY(-4px);
        }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 13px 28px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          background: #4f8ef7;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.2s;
          letter-spacing: 0.01em;
        }
        .btn-primary:hover {
          background: #6ba3f8;
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(79,142,247,0.3);
        }

        .btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 13px 28px;
          border-radius: 12px;
          cursor: pointer;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: #e8edf5;
          font-size: 14px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.2s;
        }
        .btn-ghost:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.15);
        }

        .tag-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 14px;
          border-radius: 999px;
          background: rgba(79,142,247,0.1);
          border: 1px solid rgba(79,142,247,0.2);
          font-size: 11px;
          font-weight: 600;
          color: rgba(148,185,255,0.8);
          letter-spacing: 0.03em;
          margin-bottom: 28px;
        }

        .grid-bg {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(79,142,247,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(79,142,247,0.025) 1px, transparent 1px);
          background-size: 56px 56px;
          pointer-events: none;
        }

        .noise-overlay {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: 0.025;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          background-size: 200px 200px;
        }

        .section-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(148,163,184,0.35);
          margin-bottom: 14px;
        }

        .section-title {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: clamp(26px, 4vw, 44px);
          line-height: 1.1;
          letter-spacing: -0.02em;
          color: #e8edf5;
        }

        /* Mobile nav overlay */
        .mobile-menu {
          position: fixed;
          inset: 0;
          z-index: 200;
          background: rgba(7,9,15,0.97);
          backdrop-filter: blur(20px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 32px;
          animation: slideIn 0.2s ease;
        }

        /* Responsive helpers */
        @media (max-width: 768px) {
          .hero-btns { flex-direction: column !important; align-items: stretch !important; }
          .hero-btns button, .hero-btns .btn-primary, .hero-btns .btn-ghost { width: 100% !important; justify-content: center; }
          .stats-grid { grid-template-columns: repeat(3,1fr) !important; gap: 24px !important; }
          .agents-grid { grid-template-columns: 1fr 1fr !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .footer-inner { flex-direction: column !important; gap: 16px !important; text-align: center !important; }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .agents-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Noise overlay */}
      <div className="noise-overlay" />

      {/* Mobile menu */}
      {menuOpen && (
        <div className="mobile-menu" onClick={() => setMenuOpen(false)}>
          {["Features", "Experts", "How it Works"].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g, "-")}`}
              style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", color: "#e8edf5" }}
              onClick={() => setMenuOpen(false)}
            >{l}</a>
          ))}
          <button className="btn-primary" onClick={() => navigate("/auth")} style={{ marginTop: 8, fontSize: 16, padding: "14px 40px" }}>
            Sign In →
          </button>
        </div>
      )}

      {/* ── Navbar ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 clamp(16px, 5vw, 48px)", height: 60,
        background: scrolled ? "rgba(7,9,15,0.9)" : "transparent",
        backdropFilter: scrolled ? "blur(24px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.05)" : "none",
        transition: "all 0.3s ease",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: "linear-gradient(135deg,#4f8ef7,#34d399)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
          }}>⚡</div>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, color: "#e8edf5" }}>
            Content<span style={{ color: "#4f8ef7" }}>AI</span>
          </span>
        </div>

        {/* Desktop nav */}
        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            {["Features", "Experts", "How it Works"].map(l => (
              <a key={l} className="nav-link" href={`#${l.toLowerCase().replace(/ /g, "-")}`}>{l}</a>
            ))}
          </div>
        )}

        {/* Desktop CTA */}
        {!isMobile && (
          <button className="btn-primary" onClick={() => navigate("/auth")} style={{ padding: "8px 20px", fontSize: 13 }}>
            Sign In →
          </button>
        )}

        {/* Hamburger — mobile only */}
        {isMobile && (
          <button onClick={() => setMenuOpen(v => !v)} style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", gap: 5, padding: 4,
          }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ width: 22, height: 2, background: "#e8edf5", borderRadius: 2, display: "block" }} />
            ))}
          </button>
        )}
      </nav>

      {/* ── Hero ── */}
      <section style={{
        position: "relative", minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "clamp(80px,12vw,120px) clamp(16px,5vw,48px) clamp(60px,8vw,80px)",
        overflow: "hidden",
      }}>
        <div className="grid-bg" />

        {/* Glow blobs */}
        <div style={{ position: "absolute", width: "50vw", height: "50vw", maxWidth: 600, maxHeight: 600, top: -80, left: -120, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,142,247,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: "40vw", height: "40vw", maxWidth: 500, maxHeight: 500, bottom: -60, right: -80, borderRadius: "50%", background: "radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 860, width: "100%", textAlign: "center" }}>
          {/* Badge */}
          <div style={{ animation: "fadeUp 0.5s both", display: "flex", justifyContent: "center" }}>
            <div className="tag-badge">
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", animation: "pulse-dot 2s infinite", display: "inline-block" }} />
              5 AI Agents · Real-time Streaming · Voice Input
            </div>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(34px, 6.5vw, 74px)",
            lineHeight: 1.06,
            letterSpacing: "-0.03em",
            marginBottom: "clamp(16px,3vw,24px)",
            animation: "fadeUp 0.5s 0.1s both",
          }}>
            AI Agents That Write<br />
            Your{" "}
            <span style={{
              background: "linear-gradient(90deg, #4f8ef7, #34d399, #fbbf24, #4f8ef7)",
              backgroundSize: "300% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "gradMove 5s ease infinite",
            }}>
              {typed || "\u00A0"}
            </span>
            <span style={{ color: "#4f8ef7", animation: "blink 1s step-end infinite", WebkitTextFillColor: "#4f8ef7" }}>|</span>
          </h1>

          <p style={{
            fontSize: "clamp(14px,2.5vw,17px)",
            color: "rgba(148,163,184,0.6)",
            maxWidth: 540, margin: "0 auto clamp(28px,5vw,40px)",
            lineHeight: 1.75,
            animation: "fadeUp 0.5s 0.2s both",
            fontWeight: 400,
          }}>
            A multi-agent content platform where 5 expert AI agents collaborate to produce
            strategies, copy, SEO plans, social posts, and campaign reports — in seconds.
          </p>

          {/* CTAs */}
          <div className="hero-btns" style={{
            display: "flex", gap: 10, justifyContent: "center",
            animation: "fadeUp 0.5s 0.3s both",
            flexWrap: "wrap",
          }}>
            <button className="btn-primary" onClick={() => navigate("/auth")} style={{ fontSize: 14, padding: "13px 28px" }}>
              Start Creating Free →
            </button>
            <button className="btn-ghost" onClick={() => navigate("/auth")} style={{ fontSize: 14 }}>
              Sign In
            </button>
          </div>

          {/* Agent preview card */}
          <div style={{
            marginTop: "clamp(36px,6vw,60px)",
            padding: "18px 20px",
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 18,
            maxWidth: 420, width: "100%",
            margin: "clamp(36px,6vw,60px) auto 0",
            backdropFilter: "blur(16px)",
            animation: "fadeUp 0.5s 0.4s both",
            textAlign: "left",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", animation: "pulse-dot 1.8s infinite", display: "inline-block" }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(148,163,184,0.4)", textTransform: "uppercase" }}>Active Agent</span>
            </div>
            <div key={activeExpert} style={{ display: "flex", alignItems: "center", gap: 14, animation: "slideIn 0.3s ease" }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: `${EXPERTS[activeExpert].color}18`,
                border: `1px solid ${EXPERTS[activeExpert].color}30`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
              }}>
                {EXPERTS[activeExpert].emoji}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: EXPERTS[activeExpert].color, fontFamily: "'Space Grotesk',sans-serif", marginBottom: 3 }}>
                  {EXPERTS[activeExpert].label}
                </div>
                <div style={{ fontSize: 12, color: "rgba(148,163,184,0.4)", lineHeight: 1.4 }}>
                  {EXPERTS[activeExpert].desc}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14, height: 2, background: "rgba(255,255,255,0.04)", borderRadius: 2 }}>
              <div style={{
                height: "100%", borderRadius: 2,
                background: EXPERTS[activeExpert].color,
                width: "62%", transition: "background 0.4s",
                opacity: 0.7,
              }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "clamp(40px,6vw,64px) clamp(16px,5vw,48px)" }}>
          <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 32 }}>
            <StatCounter value="5"    label="Specialized AI Agents"    color="#4f8ef7" />
            <StatCounter value="3"    label="Sub-agents per Expert"    color="#34d399" />
            <StatCounter value="100%" label="Streaming Token-by-Token" color="#fbbf24" />
          </div>
        </div>
      </div>

      {/* ── Experts ── */}
      <section id="experts" style={{ padding: "clamp(60px,8vw,100px) clamp(16px,5vw,48px)", position: "relative" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "clamp(36px,5vw,60px)" }}>
            <div className="section-label">The Team</div>
            <h2 className="section-title">
              5 Expert Agents.<br />
              <span style={{ color: "rgba(148,163,184,0.25)" }}>One Workspace.</span>
            </h2>
          </div>
          <div className="agents-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14 }}>
            {EXPERTS.map((expert, i) => (
              <div key={expert.label} className="card-agent" style={{ animation: `fadeUp 0.5s ${i * 0.08}s both`, borderLeft: `2px solid ${expert.color}50` }}>
                <div style={{ fontSize: 26, marginBottom: 12 }}>{expert.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e8edf5", marginBottom: 6, fontFamily: "'Space Grotesk',sans-serif" }}>
                  {expert.label}
                </div>
                <div style={{ fontSize: 12, color: "rgba(148,163,184,0.4)", lineHeight: 1.6 }}>{expert.desc}</div>
                <div style={{ marginTop: 14 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: `${expert.color}12`, color: expert.color, letterSpacing: "0.06em" }}>
                    ACTIVE
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{
        padding: "clamp(60px,8vw,100px) clamp(16px,5vw,48px)",
        background: "rgba(255,255,255,0.01)",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "clamp(36px,5vw,60px)" }}>
            <div className="section-label">Capabilities</div>
            <h2 className="section-title">Everything Built In</h2>
            <p style={{ fontSize: "clamp(13px,2vw,15px)", color: "rgba(148,163,184,0.45)", marginTop: 14, maxWidth: 440, margin: "14px auto 0", lineHeight: 1.7 }}>
              Built for a final semester project — but engineered to actually work well.
            </p>
          </div>
          <div className="features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {FEATURES.map((feature, i) => (
              <div key={feature.title} className="card-feature" style={{ animation: `fadeUp 0.5s ${i * 0.07}s both` }}>
                <div style={{ fontSize: 26, marginBottom: 14 }}>{feature.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e8edf5", marginBottom: 8, fontFamily: "'Space Grotesk',sans-serif" }}>
                  {feature.title}
                </div>
                <div style={{ fontSize: 13, color: "rgba(148,163,184,0.4)", lineHeight: 1.65 }}>{feature.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" style={{ padding: "clamp(60px,8vw,100px) clamp(16px,5vw,48px)" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "clamp(40px,6vw,64px)" }}>
            <div className="section-label">Workflow</div>
            <h2 className="section-title">How It Works</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {STEPS.map((step, i) => (
              <div key={step.n} style={{ display: "flex", gap: "clamp(16px,4vw,28px)", position: "relative" }}>
                {i < STEPS.length - 1 && (
                  <div style={{ position: "absolute", left: 19, top: 44, bottom: -8, width: 1, background: "rgba(79,142,247,0.12)" }} />
                )}
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: "rgba(79,142,247,0.08)",
                  border: "1px solid rgba(79,142,247,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: "#4f8ef7", fontFamily: "'Space Grotesk',sans-serif",
                  letterSpacing: "0.04em",
                }}>{step.n}</div>
                <div style={{ paddingBottom: "clamp(28px,4vw,44px)" }}>
                  <div style={{ fontSize: "clamp(14px,2.5vw,15px)", fontWeight: 700, color: "#e8edf5", marginBottom: 6, fontFamily: "'Space Grotesk',sans-serif" }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: "clamp(12px,2vw,13px)", color: "rgba(148,163,184,0.45)", lineHeight: 1.75 }}>
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        padding: "clamp(60px,8vw,100px) clamp(16px,5vw,48px)",
        textAlign: "center",
        position: "relative", overflow: "hidden",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(600px,90vw)", height: "min(600px,90vw)", borderRadius: "50%", background: "radial-gradient(circle, rgba(79,142,247,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 540, margin: "0 auto" }}>
          <div className="section-label" style={{ textAlign: "center" }}>Final Semester Project</div>
          <h2 style={{
            fontFamily: "'Space Grotesk',sans-serif",
            fontSize: "clamp(28px,5vw,52px)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            marginBottom: 16,
          }}>
            Ready to Create?
          </h2>
          <p style={{ fontSize: "clamp(13px,2vw,15px)", color: "rgba(148,163,184,0.45)", marginBottom: "clamp(28px,4vw,40px)", lineHeight: 1.7 }}>
            Join the workspace. Your first content is one message away.
          </p>
          <button className="btn-primary" onClick={() => navigate("/auth")} style={{ fontSize: 15, padding: "14px 40px" }}>
            Get Started Free →
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "28px clamp(16px,5vw,48px)" }}>
        <div className="footer-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: "linear-gradient(135deg,#4f8ef7,#34d399)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>⚡</div>
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, color: "#e8edf5" }}>
              Content<span style={{ color: "#4f8ef7" }}>AI</span>
            </span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(148,163,184,0.25)" }}>© 2026 ContentAI Planner</div>
          <div style={{ fontSize: 12, color: "rgba(148,163,184,0.25)" }}>Built with CrewAI · NVIDIA · FastAPI</div>
        </div>
      </footer>
    </div>
  );
}
