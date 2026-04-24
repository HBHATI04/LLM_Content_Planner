import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

const EXPERTS = [
  { emoji: "🎯", label: "Content Strategist", desc: "Brand positioning & content roadmaps", color: "#3b82f6" },
  { emoji: "✍️", label: "Copywriter",         desc: "Compelling copy that converts",        color: "#06d6a0" },
  { emoji: "🔍", label: "SEO Expert",          desc: "Rank higher, reach further",           color: "#f59e0b" },
  { emoji: "📱", label: "Social Media",        desc: "Viral posts & hashtag strategy",       color: "#ec4899" },
  { emoji: "📊", label: "Campaign Analyst",    desc: "Data-driven campaign insights",        color: "#a855f7" },
];

const FEATURES = [
  { icon: "⚡", title: "Real-time Streaming",    desc: "Watch your content generate token by token with live SSE streaming." },
  { icon: "🎙️", title: "Voice Input",            desc: "Speak your brief. Groq Whisper transcribes instantly." },
  { icon: "🖼️", title: "Image Generation",       desc: "Stable Diffusion images from a single text prompt." },
  { icon: "📄", title: "PDF & DOCX Export",      desc: "Download polished reports ready to share with clients." },
  { icon: "🧠", title: "Memory Context",          desc: "Agents remember your conversation history for coherent outputs." },
  { icon: "📈", title: "Admin Analytics",         desc: "Track token usage, response times, and agent performance." },
];

function useTypewriter(words, speed = 90) {
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
        setTimeout(() => setDeleting(true), 1200);
      } else {
        setDeleting(false);
        setWordIdx(i => (i + 1) % words.length);
      }
    }, deleting ? speed / 2 : speed);
    return () => clearTimeout(timeout);
  }, [charIdx, deleting, wordIdx, words, speed]);

  return text;
}

function FloatingOrb({ style }) {
  return <div className="absolute rounded-full blur-3xl pointer-events-none" style={style} />;
}

function AgentCard({ expert, index }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        animation: `fadeUp 0.5s ${index * 0.08}s both`,
        background: hovered ? `${expert.color}12` : "rgba(255,255,255,0.03)",
        border: `1px solid ${hovered ? expert.color + "40" : "rgba(255,255,255,0.07)"}`,
        borderLeft: `3px solid ${expert.color}`,
        borderRadius: 16,
        padding: "20px 22px",
        cursor: "default",
        transition: "all 0.25s ease",
        transform: hovered ? "translateY(-3px)" : "none",
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 10 }}>{expert.emoji}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#e2eaf5", marginBottom: 6, fontFamily: "'Syne', sans-serif" }}>
        {expert.label}
      </div>
      <div style={{ fontSize: 12, color: "rgba(99,179,237,0.5)", lineHeight: 1.5 }}>{expert.desc}</div>
    </div>
  );
}

function FeatureCard({ feature, index }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        animation: `fadeUp 0.5s ${index * 0.07}s both`,
        background: hovered ? "rgba(59,130,246,0.07)" : "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 16,
        padding: "24px",
        transition: "all 0.25s ease",
        transform: hovered ? "translateY(-4px)" : "none",
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 12 }}>{feature.icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#e2eaf5", marginBottom: 8, fontFamily: "'Syne', sans-serif" }}>
        {feature.title}
      </div>
      <div style={{ fontSize: 13, color: "rgba(99,179,237,0.45)", lineHeight: 1.6 }}>{feature.desc}</div>
    </div>
  );
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
  return (
    <div ref={ref} style={{ textAlign: "center" }}>
      <div style={{ fontSize: 42, fontWeight: 800, color, fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>
        {count.toLocaleString()}{suffix}
      </div>
      <div style={{ fontSize: 13, color: "rgba(99,179,237,0.4)", marginTop: 8 }}>{label}</div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const typed = useTypewriter(["Strategies", "Campaigns", "Blog Posts", "Hashtags", "Ad Copy", "Reports"]);
  const [scrolled, setScrolled] = useState(false);
  const [activeExpert, setActiveExpert] = useState(0);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  // Rotate expert preview
  useEffect(() => {
    const t = setInterval(() => setActiveExpert(i => (i + 1) % EXPERTS.length), 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      background: "#060a10",
      color: "#e2eaf5",
      minHeight: "100vh",
      fontFamily: "'DM Sans', sans-serif",
      overflowX: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes pulse2 { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes gradShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        * { -webkit-font-smoothing: antialiased; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #1e2a3a; border-radius: 99px; }
        html { scroll-behavior: smooth; }
        a { text-decoration: none; }
      `}</style>

      {/* ── Navbar ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 64,
        background: scrolled ? "rgba(6,10,16,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(99,179,237,0.08)" : "none",
        transition: "all 0.3s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: "linear-gradient(135deg,#3b82f6,#06d6a0)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
          }}>⚡</div>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: "#e2eaf5" }}>
            Content<span style={{ color: "#3b82f6" }}>AI</span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {["Features", "Experts", "How it Works"].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g,"-")}`} style={{ fontSize: 13, color: "rgba(99,179,237,0.55)", transition: "color 0.2s" }}
              onMouseEnter={e => e.target.style.color = "#e2eaf5"}
              onMouseLeave={e => e.target.style.color = "rgba(99,179,237,0.55)"}
            >{l}</a>
          ))}
          <button onClick={() => navigate("/auth")} style={{
            padding: "8px 20px", borderRadius: 10,
            background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)",
            color: "#60a5fa", fontSize: 13, fontWeight: 600, cursor: "pointer",
            transition: "all 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(59,130,246,0.22)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(59,130,246,0.12)"; }}
          >Sign In</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "100px 48px 60px", overflow: "hidden" }}>
        {/* Background orbs */}
        <FloatingOrb style={{ width: 600, height: 600, top: -100, left: -200, background: "rgba(59,130,246,0.07)" }} />
        <FloatingOrb style={{ width: 400, height: 400, bottom: 0, right: -100, background: "rgba(6,214,160,0.05)" }} />
        <FloatingOrb style={{ width: 300, height: 300, top: "40%", left: "60%", background: "rgba(168,85,247,0.04)" }} />

        {/* Grid pattern */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: "linear-gradient(rgba(99,179,237,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,179,237,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 900, textAlign: "center" }}>
          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 16px", borderRadius: 999,
            background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
            fontSize: 12, fontWeight: 600, color: "#60a5fa",
            marginBottom: 32, animation: "fadeUp 0.5s both",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#06d6a0", animation: "pulse2 2s infinite" }} />
            5 Specialized AI Agents · Real-time Streaming · Voice Input
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: "'Syne', sans-serif", fontWeight: 800,
            fontSize: "clamp(36px, 6vw, 72px)", lineHeight: 1.08,
            margin: "0 0 24px", animation: "fadeUp 0.5s 0.1s both",
            letterSpacing: "-1px",
          }}>
            AI Agents That Write<br />
            Your <span style={{
              background: "linear-gradient(90deg, #3b82f6, #06d6a0, #f59e0b)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              animation: "gradShift 4s ease infinite",
            }}>{typed || "\u00A0"}</span>
            <span style={{ color: "#3b82f6", animation: "pulse2 1s infinite" }}>|</span>
          </h1>

          <p style={{
            fontSize: 17, color: "rgba(99,179,237,0.55)", maxWidth: 560, margin: "0 auto 40px",
            lineHeight: 1.7, animation: "fadeUp 0.5s 0.2s both",
          }}>
            A multi-agent content platform where 5 expert AI agents collaborate to produce
            strategies, copy, SEO plans, social posts, and campaign reports — in seconds.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", animation: "fadeUp 0.5s 0.3s both" }}>
            <button onClick={() => navigate("/auth")} style={{
              padding: "14px 32px", borderRadius: 12, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              color: "#fff", fontSize: 14, fontWeight: 700,
              boxShadow: "0 0 32px rgba(59,130,246,0.35)",
              transition: "all 0.2s", fontFamily: "'DM Sans', sans-serif",
            }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "none"}
            >
              Start Creating Free →
            </button>
            <button onClick={() => navigate("/auth")} style={{
              padding: "14px 32px", borderRadius: 12, cursor: "pointer",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#e2eaf5", fontSize: 14, fontWeight: 600,
              transition: "all 0.2s", fontFamily: "'DM Sans', sans-serif",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
            >
              Sign In
            </button>
          </div>

          {/* Live agent preview */}
          <div style={{
            marginTop: 60, padding: "20px 24px",
            background: "rgba(13,21,32,0.8)", border: "1px solid rgba(99,179,237,0.1)",
            borderRadius: 16, maxWidth: 480, margin: "60px auto 0",
            backdropFilter: "blur(12px)", animation: "fadeUp 0.5s 0.4s both",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#06d6a0", animation: "pulse2 1.5s infinite" }} />
              <span style={{ fontSize: 11, color: "rgba(99,179,237,0.4)", fontFamily: "'DM Sans',monospace" }}>
                ACTIVE AGENT
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, transition: "all 0.4s" }}>
              <span style={{ fontSize: 32 }}>{EXPERTS[activeExpert].emoji}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: EXPERTS[activeExpert].color, fontFamily: "'Syne',sans-serif" }}>
                  {EXPERTS[activeExpert].label}
                </div>
                <div style={{ fontSize: 12, color: "rgba(99,179,237,0.4)", marginTop: 2 }}>
                  {EXPERTS[activeExpert].desc}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14, height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 2,
                background: EXPERTS[activeExpert].color,
                width: "65%", transition: "background 0.4s",
                animation: "gradShift 2s ease infinite",
              }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ padding: "60px 48px", borderTop: "1px solid rgba(99,179,237,0.06)", borderBottom: "1px solid rgba(99,179,237,0.06)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 40 }}>
          <StatCounter value="5"    label="Specialized AI Agents"    color="#3b82f6" />
          <StatCounter value="3"    label="Sub-agents per Expert"    color="#06d6a0" />
          <StatCounter value="100%" label="Streaming Token-by-Token" color="#f59e0b" />
        </div>
      </section>

      {/* ── Experts ── */}
      <section id="experts" style={{ padding: "100px 48px", position: "relative" }}>
        <FloatingOrb style={{ width: 500, height: 500, top: "50%", right: -200, background: "rgba(168,85,247,0.04)" }} />
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "2px", color: "rgba(99,179,237,0.35)", textTransform: "uppercase", marginBottom: 16 }}>
              The Team
            </div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>
              5 Expert Agents.<br />
              <span style={{ color: "rgba(99,179,237,0.3)" }}>One Workspace.</span>
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16 }}>
            {EXPERTS.map((e, i) => <AgentCard key={e.label} expert={e} index={i} />)}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: "100px 48px", background: "rgba(255,255,255,0.01)", borderTop: "1px solid rgba(99,179,237,0.06)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "2px", color: "rgba(99,179,237,0.35)", textTransform: "uppercase", marginBottom: 16 }}>
              Built Different
            </div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>
              Everything You Need
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
            {FEATURES.map((f, i) => <FeatureCard key={f.title} feature={f} index={i} />)}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" style={{ padding: "100px 48px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "2px", color: "rgba(99,179,237,0.35)", textTransform: "uppercase", marginBottom: 16 }}>
            Workflow
          </div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, margin: "0 0 60px", letterSpacing: "-0.5px" }}>
            How It Works
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { n: "01", title: "Pick Your Expert",       desc: "Choose from 5 specialized agents — Strategist, Copywriter, SEO, Social, or Analyst." },
              { n: "02", title: "Type or Speak Your Brief", desc: "Use the keyboard or hit the mic button — Whisper AI transcribes your voice instantly." },
              { n: "03", title: "Watch It Generate",      desc: "3 sub-agents (analyst → specialist → reviewer) collaborate. Tokens stream in real time." },
              { n: "04", title: "Export & Ship",          desc: "Download as PDF or DOCX, or copy straight from the chat. Done." },
            ].map((step, i) => (
              <div key={step.n} style={{ display: "flex", gap: 24, textAlign: "left", position: "relative" }}>
                {/* Line */}
                {i < 3 && (
                  <div style={{ position: "absolute", left: 19, top: 44, bottom: -20, width: 1, background: "rgba(59,130,246,0.15)" }} />
                )}
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: "#3b82f6", fontFamily: "'Syne',sans-serif",
                }}>{step.n}</div>
                <div style={{ paddingBottom: 40 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#e2eaf5", marginBottom: 6, fontFamily: "'Syne',sans-serif" }}>{step.title}</div>
                  <div style={{ fontSize: 13, color: "rgba(99,179,237,0.45)", lineHeight: 1.7 }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: "100px 48px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <FloatingOrb style={{ width: 600, height: 600, top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "rgba(59,130,246,0.06)" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{
            fontFamily: "'Syne',sans-serif", fontSize: "clamp(32px,5vw,64px)",
            fontWeight: 800, margin: "0 0 20px", letterSpacing: "-1px",
          }}>
            Ready to Create?
          </h2>
          <p style={{ fontSize: 16, color: "rgba(99,179,237,0.45)", marginBottom: 40 }}>
            Join the workspace. Your first content is one message away.
          </p>
          <button onClick={() => navigate("/auth")} style={{
            padding: "16px 48px", borderRadius: 14, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg,#3b82f6,#06d6a0)",
            color: "#fff", fontSize: 16, fontWeight: 700,
            boxShadow: "0 0 60px rgba(59,130,246,0.3)",
            fontFamily: "'DM Sans',sans-serif",
            transition: "all 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 0 80px rgba(59,130,246,0.5)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 0 60px rgba(59,130,246,0.3)"; }}
          >
            Get Started Free →
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: "1px solid rgba(99,179,237,0.06)",
        padding: "32px 48px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: "linear-gradient(135deg,#3b82f6,#06d6a0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>⚡</div>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14, color: "#e2eaf5" }}>
            Content<span style={{ color: "#3b82f6" }}>AI</span>
          </span>
        </div>
        <div style={{ fontSize: 12, color: "rgba(99,179,237,0.25)" }}>© 2026 ContentAI Planner. All rights reserved.</div>
        <div style={{ fontSize: 12, color: "rgba(99,179,237,0.25)" }}>Built with CrewAI · NVIDIA · FastAPI</div>
      </footer>
    </div>
  );
}