import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { authFetch } from "../utils/api";

// ── Constants ─────────────────────────────────────────────────────────────────
const EXPERTS = [
  { key: "strategist", label: "Strategist", emoji: "🎯", color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  { key: "copywriter", label: "Copywriter", emoji: "✍️", color: "#06d6a0", bg: "rgba(6,214,160,0.15)" },
  { key: "seo", label: "SEO", emoji: "🔍", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  { key: "social", label: "Social", emoji: "📱", color: "#ec4899", bg: "rgba(236,72,153,0.15)" },
  { key: "analyst", label: "Analyst", emoji: "📊", color: "#a855f7", bg: "rgba(168,85,247,0.15)" },
];

const DEFAULT_STATS = {
  total_users: 0, total_runs: 0, avg_time: 0,
  strategist: 0, copywriter: 0, seo: 0, social: 0, analyst: 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function avatarColor(str = "") {
  const colors = [
    { bg: "rgba(59,130,246,0.2)", fg: "#60a5fa" },
    { bg: "rgba(6,214,160,0.2)", fg: "#34d399" },
    { bg: "rgba(245,158,11,0.2)", fg: "#fbbf24" },
    { bg: "rgba(236,72,153,0.2)", fg: "#f472b6" },
    { bg: "rgba(168,85,247,0.2)", fg: "#c084fc" },
  ];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function formatDateShort(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const fmtNum = (n) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K`
      : String(n ?? 0);

const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms || 0}ms`);

const fmtDateShortLocal = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const ANALYTICS_PERIODS = [
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
];

const EXPERT_META = {
  strategist: { label: "Strategist", color: "#3b82f6" },
  copywriter: { label: "Copywriter", color: "#06d6a0" },
  seo: { label: "SEO", color: "#f59e0b" },
  social: { label: "Social", color: "#ec4899" },
  analyst: { label: "Analyst", color: "#a855f7" },
};

// ── Animated counter ──────────────────────────────────────────────────────────
function useCounter(target) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let cur = 0;
    const step = Math.max(1, Math.floor(target / 50));
    const t = setInterval(() => {
      cur = Math.min(cur + step, target);
      setVal(cur);
      if (cur >= target) clearInterval(t);
    }, 16);
    return () => clearInterval(t);
  }, [target]);
  return val;
}

// ── Panel wrapper ─────────────────────────────────────────────────────────────
function Panel({ children, delay = 0, className = "" }) {
  return (
    <div className={`rounded-2xl border ${className}`}
      style={{ background: "#0d1520", borderColor: "rgba(99,179,237,0.08)", animation: `fadeUp 0.45s ${delay}s both` }}>
      {children}
    </div>
  );
}

function PanelHeader({ dot = "#3b82f6", title, right }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(99,179,237,0.06)" }}>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ background: dot, boxShadow: `0 0 8px ${dot}` }} />
        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: "12px", fontWeight: 700, color: "#e2eaf5" }}>{title}</span>
      </div>
      {right}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color, delay = 0 }) {
  const isNum = typeof value === "number";
  const count = useCounter(isNum ? value : 0);
  return (
    <div className="relative rounded-2xl p-5 overflow-hidden border"
      style={{ background: "#0d1520", borderColor: "rgba(99,179,237,0.08)", animation: `fadeUp 0.45s ${delay}s both` }}>
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-15 pointer-events-none"
        style={{ background: color }} />
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(99,179,237,0.4)", fontSize: "9px" }}>{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base" style={{ background: color + "22" }}>{icon}</div>
      </div>
      <div className="font-bold text-3xl mb-1" style={{ color, fontFamily: "'Space Mono',monospace" }}>
        {isNum ? count.toLocaleString() : value}
      </div>
      <div className="text-xs" style={{ color: "rgba(99,179,237,0.35)" }}>{sub}</div>
    </div>
  );
}

// ── Bar chart ─────────────────────────────────────────────────────────────────
function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-3 h-44 pt-2">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2">
          <span className="text-xs font-mono" style={{ color: d.color, fontFamily: "'Space Mono',monospace", fontSize: "11px" }}>{d.value}</span>
          <div className="w-full rounded-lg relative overflow-hidden" style={{ height: "110px", background: "rgba(255,255,255,0.04)" }}>
            <div className="absolute bottom-0 w-full rounded-lg transition-all duration-1000"
              style={{ height: `${(d.value / max) * 100}%`, background: `linear-gradient(180deg,${d.color}cc,${d.color}44)`, boxShadow: `0 0 10px ${d.color}44` }} />
          </div>
          <span style={{ color: "rgba(99,179,237,0.4)", fontFamily: "'Space Mono',monospace", fontSize: "9px" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function AgentBar({ label, value, total, color }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold uppercase w-20 shrink-0" style={{ color: "rgba(99,179,237,0.4)", fontFamily: "'Space Mono',monospace", fontSize: "9px", letterSpacing: "0.5px" }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}77` }} />
      </div>
      <span className="text-xs font-mono w-9 text-right shrink-0" style={{ color, fontFamily: "'Space Mono',monospace" }}>{pct}%</span>
    </div>
  );
}

// ── Search input ──────────────────────────────────────────────────────────────
function SearchInput({ value, onChange, placeholder = "Search…" }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="px-3 py-1.5 rounded-lg text-sm border outline-none transition-colors"
      style={{ background: "#111c2d", borderColor: "rgba(99,179,237,0.1)", color: "#e2eaf5", width: "200px", fontFamily: "'DM Sans',sans-serif" }}
      onFocus={e => e.target.style.borderColor = "#3b82f6"}
      onBlur={e => e.target.style.borderColor = "rgba(99,179,237,0.1)"} />
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ icon = "📭", text = "No data found" }) {
  return (
    <div className="text-center py-16" style={{ color: "rgba(99,179,237,0.3)" }}>
      <div className="text-4xl mb-3">{icon}</div>
      <div className="text-sm">{text}</div>
    </div>
  );
}

// ── PAGE: Dashboard ───────────────────────────────────────────────────────────
function PageDashboard({ stats, logs }) {
  const totalRuns = EXPERTS.reduce((s, e) => s + (stats[e.key] || 0), 0);
  const topExpert = EXPERTS.reduce((a, b) => (stats[a.key] || 0) > (stats[b.key] || 0) ? a : b);
  const chartData = EXPERTS.map(e => ({ label: e.label, value: stats[e.key] || 0, color: e.color }));

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats.total_users} sub="Registered accounts" icon="👤" color="#3b82f6" delay={0.05} />
        <StatCard label="Total Runs" value={totalRuns} sub="Agent executions" icon="⚡" color="#06d6a0" delay={0.1} />
        <StatCard label="Avg Response" value={stats.avg_time + "s"} sub="Per agent run" icon="⏱" color="#f59e0b" delay={0.15} />
        <StatCard label="Top Expert" value={topExpert.emoji + " " + topExpert.label} sub="Most used" icon="🏆" color="#ec4899" delay={0.2} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Panel delay={0.25} className="lg:col-span-3 p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ background: "#3b82f6", boxShadow: "0 0 8px #3b82f6" }} />
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: "12px", fontWeight: 700, color: "#e2eaf5" }}>Agent Usage</span>
          </div>
          <BarChart data={chartData} />
        </Panel>
        <Panel delay={0.3} className="lg:col-span-2 p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-2 h-2 rounded-full" style={{ background: "#06d6a0", boxShadow: "0 0 8px #06d6a0" }} />
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: "12px", fontWeight: 700, color: "#e2eaf5" }}>Expert Share</span>
          </div>
          <div className="space-y-4">
            {EXPERTS.map(e => <AgentBar key={e.key} label={e.label} value={stats[e.key] || 0} total={totalRuns} color={e.color} />)}
          </div>
        </Panel>
      </div>

      {/* Recent logs preview */}
      <Panel delay={0.35}>
        <PanelHeader dot="#f59e0b" title="Recent Executions" />
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(99,179,237,0.06)" }}>
                {["User", "Expert", "Prompt", "Date"].map(h => (
                  <th key={h} className="text-left px-5 py-3"
                    style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "rgba(99,179,237,0.35)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 8).map((log, i) => {
                const ac = avatarColor(log.user || "");
                const expert = EXPERTS.find(e => e.key === log.agent) || EXPERTS[0];
                return (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(99,179,237,0.04)", transition: "background .15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(59,130,246,0.04)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: ac.bg, color: ac.fg }}>{(log.user || "?")[0].toUpperCase()}</div>
                        <span className="text-xs truncate max-w-[120px]" style={{ color: "#e2eaf5" }}>{log.user}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: expert.bg, color: expert.color }}>{expert.emoji} {expert.label}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="truncate max-w-xs text-xs" style={{ color: "rgba(99,179,237,0.45)" }}>{log.prompt}</div>
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: "rgba(99,179,237,0.35)", whiteSpace: "nowrap" }}>{formatDate(log.date)}</td>
                  </tr>
                );
              })}
              {logs.length === 0 && <tr><td colSpan={4}><EmptyState text="No executions yet" /></td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// ── PAGE: Users ───────────────────────────────────────────────────────────────
function PageUsers({ users, onPromote, onDemote, loadingId }) {
  const [search, setSearch] = useState("");
  const filtered = users.filter(u =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Panel>
      <PanelHeader dot="#3b82f6" title={`Users (${users.length})`}
        right={<SearchInput value={search} onChange={setSearch} placeholder="🔍  Search users…" />} />
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(99,179,237,0.06)" }}>
              {["User", "Provider", "Status", "Joined", "Role", "Actions"].map(h => (
                <th key={h} className="text-left px-5 py-3"
                  style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "rgba(99,179,237,0.35)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={6}><EmptyState text="No users found" /></td></tr>
              : filtered.map((user, i) => {
                const ac = avatarColor(user.email || "");
                const isLoading = loadingId === user._id;
                return (
                  <tr key={user._id}
                    style={{ borderBottom: "1px solid rgba(99,179,237,0.04)", transition: "background .15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(59,130,246,0.04)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

                    {/* User */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                          style={{ background: ac.bg, color: ac.fg }}>
                          {(user.name || user.email || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-medium" style={{ color: "#e2eaf5" }}>{user.name || "—"}</div>
                          <div className="text-xs" style={{ color: "rgba(99,179,237,0.4)" }}>{user.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Provider */}
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full border" style={{ color: "rgba(99,179,237,0.5)", borderColor: "rgba(99,179,237,0.15)" }}>
                        {user.provider || "local"}
                      </span>
                    </td>

                    {/* Verified */}
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={user.isVerified
                          ? { background: "rgba(6,214,160,0.12)", color: "#34d399" }
                          : { background: "rgba(245,158,11,0.12)", color: "#fbbf24" }}>
                        {user.isVerified ? "✓ Verified" : "⏳ Pending"}
                      </span>
                    </td>

                    {/* Joined */}
                    <td className="px-5 py-3 text-xs" style={{ color: "rgba(99,179,237,0.4)", whiteSpace: "nowrap" }}>
                      {formatDateShort(user.createdAt)}
                    </td>

                    {/* Role */}
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={user.isAdmin
                          ? { background: "rgba(59,130,246,0.15)", color: "#60a5fa" }
                          : { background: "rgba(255,255,255,0.05)", color: "rgba(99,179,237,0.4)" }}>
                        {user.isAdmin ? "⚡ Admin" : "User"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3">
                      {isLoading ? (
                        <span className="text-xs" style={{ color: "rgba(99,179,237,0.4)" }}>updating…</span>
                      ) : user.isAdmin ? (
                        <button onClick={() => onDemote(user._id)}
                          className="text-xs px-3 py-1 rounded-lg transition-colors"
                          style={{ background: "rgba(236,72,153,0.1)", color: "#f472b6", border: "1px solid rgba(236,72,153,0.2)" }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(236,72,153,0.2)"}
                          onMouseLeave={e => e.currentTarget.style.background = "rgba(236,72,153,0.1)"}>
                          Demote
                        </button>
                      ) : (
                        <button onClick={() => onPromote(user._id)}
                          className="text-xs px-3 py-1 rounded-lg transition-colors"
                          style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(59,130,246,0.2)"}
                          onMouseLeave={e => e.currentTarget.style.background = "rgba(59,130,246,0.1)"}>
                          Promote
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ── PAGE: Logs ────────────────────────────────────────────────────────────────
function PageLogs({ logs }) {
  const [search, setSearch] = useState("");
  const [expertFilter, setExpertFilter] = useState("all");

  const filtered = logs.filter(l => {
    const matchSearch = !search || [l.user, l.agent, l.prompt].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const matchExpert = expertFilter === "all" || l.agent === expertFilter;
    return matchSearch && matchExpert;
  });

  return (
    <Panel>
      <PanelHeader dot="#f59e0b" title={`Execution Logs (${filtered.length})`}
        right={
          <div className="flex items-center gap-2">
            <select value={expertFilter} onChange={e => setExpertFilter(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-xs border outline-none"
              style={{ background: "#111c2d", borderColor: "rgba(99,179,237,0.1)", color: "#e2eaf5" }}>
              <option value="all">All Experts</option>
              {EXPERTS.map(e => <option key={e.key} value={e.key}>{e.emoji} {e.label}</option>)}
            </select>
            <SearchInput value={search} onChange={setSearch} placeholder="🔍  Search logs…" />
          </div>
        } />
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(99,179,237,0.06)" }}>
              {["User", "Expert", "Prompt", "Exec Time", "Date"].map(h => (
                <th key={h} className="text-left px-5 py-3"
                  style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "rgba(99,179,237,0.35)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={5}><EmptyState text="No logs match your search" /></td></tr>
              : filtered.map((log, i) => {
                const ac = avatarColor(log.user || "");
                const expert = EXPERTS.find(e => e.key === log.agent) || { label: log.agent, emoji: "🤖", color: "#999", bg: "rgba(150,150,150,0.1)" };
                return (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(99,179,237,0.04)", transition: "background .15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(59,130,246,0.04)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: ac.bg, color: ac.fg }}>{(log.user || "?")[0].toUpperCase()}</div>
                        <span className="text-xs truncate max-w-[140px]" style={{ color: "#e2eaf5" }}>{log.user}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: expert.bg, color: expert.color }}>{expert.emoji} {expert.label}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="truncate max-w-xs text-xs" style={{ color: "rgba(99,179,237,0.45)" }} title={log.prompt}>{log.prompt}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span style={{ fontFamily: "'Space Mono',monospace", fontSize: "12px", color: "#f59e0b" }}>{log.execution_time ?? 0}s</span>
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: "rgba(99,179,237,0.35)", whiteSpace: "nowrap" }}>{formatDate(log.date)}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function MiniBar({ value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", marginTop: 6 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, boxShadow: `0 0 6px ${color}88` }} />
    </div>
  );
}

function AStatCard({ label, value, icon, color, sub }) {
  return (
    <div style={{ background: "#0d1520", border: "1px solid rgba(99,179,237,0.08)", borderRadius: 16, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(99,179,237,0.35)", fontFamily: "'Space Mono',monospace" }}>{label}</span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "'Space Mono',monospace", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "rgba(99,179,237,0.3)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function SimpleLineChart({ data, dataKey, color, height = 100 }) {
  if (!data?.length) return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(99,179,237,0.2)", fontSize: 12 }}>No data</div>;
  const vals = data.map(d => d[dataKey] || 0);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals);
  const w = 100 / (vals.length - 1 || 1);

  const points = vals.map((v, i) => {
    const x = i * w;
    const y = height - ((v - min) / (max - min || 1)) * (height - 10) - 5;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: "100%", height }}>
      <defs>
        <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points} 100,${height}`} fill={`url(#grad-${dataKey})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function PageAnalytics({ authFetch }) {
  const [period, setPeriod]   = useState("7d");
  const [tab, setTab]         = useState("overview");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [charts, setCharts]     = useState(null);
  const [agents, setAgents]     = useState([]);
  const [users, setUsers]       = useState([]);
  const [errors, setErrors]     = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, ch, ag, us, er] = await Promise.all([
        authFetch("/analytics/overview").then(r => r.ok ? r.json() : null),
        authFetch(`/analytics/charts?period=${period}`).then(r => r.ok ? r.json() : null),
        authFetch(`/analytics/agents?period=${period}`).then(r => r.ok ? r.json() : []),
        authFetch(`/analytics/users?period=${period}`).then(r => r.ok ? r.json() : []),
        authFetch(`/analytics/errors?period=${period}`).then(r => r.ok ? r.json() : null),
      ]);
      setOverview(ov);
      setCharts(ch);
      setAgents(Array.isArray(ag) ? ag : []);
      setUsers(Array.isArray(us) ? us : []);
      setErrors(er);
    } catch (e) {
      console.error("Analytics fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { const id = setInterval(fetchAll, 30_000); return () => clearInterval(id); }, [fetchAll]);

  const ATABS = [
    { id: "overview",    icon: "◈", label: "Overview"    },
    { id: "tokens",      icon: "◉", label: "Tokens"      },
    { id: "performance", icon: "◎", label: "Performance" },
    { id: "agents",      icon: "◆", label: "Agents"      },
    { id: "users",       icon: "◇", label: "Users"       },
    { id: "errors",      icon: "◈", label: "Errors"      },
  ];

  // ── Sub-components scoped inside PageAnalytics ──────────────────────────

  // Better sparkline with hover tooltip
  function Sparkline({ data = [], dataKey, color, height = 90, label = "" }) {
    const [hovered, setHovered] = useState(null);
    if (!data.length) return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 24, opacity: 0.15 }}>📉</div>
        <div style={{ fontSize: 11, color: "rgba(99,179,237,0.2)" }}>No data yet</div>
      </div>
    );

    const vals  = data.map(d => d[dataKey] || 0);
    const max   = Math.max(...vals, 1);
    const min   = Math.min(...vals, 0);
    const range = max - min || 1;
    const W = 100, H = height - 20;

    const pts = vals.map((v, i) => ({
      x: (i / Math.max(vals.length - 1, 1)) * W,
      y: H - ((v - min) / range) * H + 10,
      v, label: data[i]?.date || "",
    }));

    const polyline = pts.map(p => `${p.x},${p.y}`).join(" ");
    const area     = `0,${H + 10} ${polyline} ${W},${H + 10}`;

    return (
      <div style={{ position: "relative" }}>
        {hovered !== null && (
          <div style={{
            position: "absolute", top: 0,
            left: `${Math.min(Math.max(pts[hovered]?.x - 10, 0), 75)}%`,
            background: "#0d1520", border: `1px solid ${color}44`,
            borderRadius: 8, padding: "6px 10px", fontSize: 11,
            color: "#e2eaf5", zIndex: 10, whiteSpace: "nowrap", pointerEvents: "none",
            boxShadow: `0 0 12px ${color}22`,
          }}>
            <div style={{ color, fontWeight: 700, fontFamily: "'Space Mono',monospace" }}>
              {typeof vals[hovered] === "number" && vals[hovered] >= 1000
                ? fmtNum(vals[hovered]) : vals[hovered]}
            </div>
            <div style={{ color: "rgba(99,179,237,0.4)", fontSize: 10, marginTop: 2 }}>
              {pts[hovered]?.label}
            </div>
          </div>
        )}
        <svg viewBox={`0 0 ${W} ${H + 20}`} preserveAspectRatio="none"
          style={{ width: "100%", height: height + 20, display: "block", overflow: "visible" }}>
          <defs>
            <linearGradient id={`sg-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#sg-${dataKey})`} />
          <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill={hovered === i ? color : "transparent"}
              stroke={hovered === i ? color : "transparent"} strokeWidth="1"
              style={{ cursor: "crosshair" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {/* X axis labels — first and last */}
        {data.length > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 9, color: "rgba(99,179,237,0.25)" }}>{data[0]?.date}</span>
            <span style={{ fontSize: 9, color: "rgba(99,179,237,0.25)" }}>{data[data.length - 1]?.date}</span>
          </div>
        )}
      </div>
    );
  }

  // Big stat card with trend indicator
  function BigStat({ label, value, icon, color, sub, trend }) {
    return (
      <div style={{
        background: "#0d1520", border: "1px solid rgba(99,179,237,0.08)",
        borderRadius: 16, padding: "22px 24px", position: "relative", overflow: "hidden",
        transition: "border-color 0.2s",
      }}
        onMouseEnter={e => e.currentTarget.style.borderColor = `${color}44`}
        onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(99,179,237,0.08)"}
      >
        {/* Top color bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.7 }} />
        {/* Glow orb */}
        <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: color, opacity: 0.06, filter: "blur(20px)" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "rgba(99,179,237,0.35)", fontFamily: "'Space Mono',monospace" }}>
            {label}
          </span>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
            {icon}
          </div>
        </div>

        <div style={{ fontSize: 30, fontWeight: 700, color, fontFamily: "'Space Mono',monospace", lineHeight: 1, marginBottom: 8 }}>
          {value}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "rgba(99,179,237,0.3)" }}>{sub}</span>
          {trend !== undefined && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
              background: trend >= 0 ? "rgba(6,214,160,0.12)" : "rgba(239,68,68,0.12)",
              color: trend >= 0 ? "#06d6a0" : "#ef4444",
            }}>
              {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
            </span>
          )}
        </div>
      </div>
    );
  }

  // Horizontal bar
  function HBar({ label, value, max, color, right }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "#e2eaf5", fontWeight: 500 }}>{label}</span>
          <span style={{ fontSize: 12, color, fontFamily: "'Space Mono',monospace", fontWeight: 700 }}>{right ?? value}</span>
        </div>
        <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`, borderRadius: 3,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: `0 0 8px ${color}66`,
          }} />
        </div>
      </div>
    );
  }

  // ── Overview ──────────────────────────────────────────────────────────────
  const OverviewTab = () => {
    const totalAgentMsgs = agents.reduce((s, a) => s + a.totalMessages, 0);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Stat cards — 4 col */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          <BigStat label="Total Messages"  value={fmtNum(overview?.totalMessages)}    icon="💬" color="#3b82f6" sub="All time" />
          <BigStat label="Total Tokens"    value={fmtNum(overview?.totalTokens)}       icon="🔤" color="#f59e0b" sub="All time" />
          <BigStat label="Avg Response"    value={fmtMs(overview?.avgResponseTimeMs)}  icon="⚡" color="#06d6a0" sub="Last 7 days" />
          <BigStat label="Error Rate"      value={`${overview?.errorRate || 0}%`}      icon="⚠️" color={overview?.errorRate > 5 ? "#ef4444" : "#06d6a0"} sub="Last 7 days" />
        </div>

        {/* Second row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          <BigStat label="Active Users"    value={fmtNum(overview?.activeUsers24h)}    icon="👤" color="#14b8a6" sub="Last 24h" />
          <BigStat label="Messages Today"  value={fmtNum(overview?.messagesLast24h)}   icon="📈" color="#6366f1" sub="Last 24h" />
          <BigStat label="Images Created"  value={fmtNum(overview?.imagesGenerated)}   icon="🖼️" color="#ec4899" sub="All time" />
          <BigStat label="Files Exported"  value={fmtNum(overview?.filesGenerated)}    icon="📄" color="#a855f7" sub="All time" />
        </div>

        {/* Charts row */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
          {/* Messages sparkline */}
          <div style={{ background: "#0d1520", border: "1px solid rgba(99,179,237,0.08)", borderRadius: 16, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(99,179,237,0.35)", marginBottom: 4 }}>Messages Over Time</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#3b82f6", fontFamily: "'Space Mono',monospace" }}>
                  {fmtNum(overview?.messagesLast7d)}
                  <span style={{ fontSize: 12, color: "rgba(99,179,237,0.35)", fontFamily: "'DM Sans',sans-serif", fontWeight: 400, marginLeft: 8 }}>last 7 days</span>
                </div>
              </div>
            </div>
            <Sparkline data={charts?.messagesByDay} dataKey="count" color="#3b82f6" height={100} />
          </div>

          {/* Agent share */}
          <div style={{ background: "#0d1520", border: "1px solid rgba(99,179,237,0.08)", borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(99,179,237,0.35)", marginBottom: 20 }}>
              Agent Share
            </div>
            {agents.length === 0
              ? <div style={{ textAlign: "center", padding: 20, color: "rgba(99,179,237,0.15)", fontSize: 12 }}>No data yet</div>
              : agents.map(a => {
                  const meta = EXPERT_META[a.expert] || { label: a.expert, color: "#6366f1" };
                  return <HBar key={a.expert} label={meta.label} value={a.totalMessages}
                    max={totalAgentMsgs} color={meta.color}
                    right={`${totalAgentMsgs > 0 ? Math.round((a.totalMessages / totalAgentMsgs) * 100) : 0}%`} />;
                })
            }
          </div>
        </div>

        {/* Errors vs messages */}
        <div style={{ background: "#0d1520", border: "1px solid rgba(99,179,237,0.08)", borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(99,179,237,0.35)", marginBottom: 20 }}>
            Errors / Day
          </div>
          <Sparkline data={charts?.errorsByDay} dataKey="count" color="#ef4444" height={80} />
        </div>
      </div>
    );
  };

  // ── Tokens ────────────────────────────────────────────────────────────────
  const TokensTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#0d1520", border: "1px solid rgba(99,179,237,0.08)", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(99,179,237,0.35)" }}>
            Token Usage / Day
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#f59e0b", fontFamily: "'Space Mono',monospace" }}>
            {fmtNum(overview?.totalTokens)}
            <span style={{ fontSize: 12, color: "rgba(99,179,237,0.35)", fontFamily: "'DM Sans',sans-serif", fontWeight: 400, marginLeft: 8 }}>total</span>
          </div>
        </div>
        <Sparkline data={charts?.tokensByDay} dataKey="total" color="#f59e0b" height={110} />
      </div>

      <div style={{ background: "#0d1520", border: "1px solid rgba(99,179,237,0.08)", borderRadius: 16, padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(99,179,237,0.35)", marginBottom: 20 }}>
          Token Breakdown by Agent
        </div>
        {agents.length === 0
          ? <div style={{ textAlign: "center", padding: 32, color: "rgba(99,179,237,0.15)" }}>No data yet</div>
          : agents.map(a => {
              const meta    = EXPERT_META[a.expert] || { label: a.expert, color: "#6366f1" };
              const maxToks = Math.max(...agents.map(x => x.totalTokens), 1);
              return (
                <div key={a.expert} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid rgba(99,179,237,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#e2eaf5" }}>{meta.label}</span>
                    </div>
                    <div style={{ display: "flex", gap: 20 }}>
                      {[
                        { l: "In", v: fmtNum(a.totalTokensIn), c: "#60a5fa" },
                        { l: "Out", v: fmtNum(a.totalTokensOut), c: "#34d399" },
                        { l: "Total", v: fmtNum(a.totalTokens), c: meta.color },
                        { l: "Avg/msg", v: a.totalMessages > 0 ? fmtNum(Math.round(a.totalTokens / a.totalMessages)) : "—", c: "rgba(99,179,237,0.5)" },
                      ].map(s => (
                        <div key={s.l} style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: s.c, fontFamily: "'Space Mono',monospace" }}>{s.v}</div>
                          <div style={{ fontSize: 9, color: "rgba(99,179,237,0.25)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <HBar label="" value={a.totalTokens} max={maxToks} color={meta.color} right={fmtNum(a.totalTokens)} />
                </div>
              );
            })
        }
      </div>
    </div>
  );

  // ── Performance ───────────────────────────────────────────────────────────
  const PerformanceTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#0d1520", border: "1px solid rgba(99,179,237,0.08)", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(99,179,237,0.35)" }}>
            Avg Response Time / Day
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#06d6a0", fontFamily: "'Space Mono',monospace" }}>
            {fmtMs(overview?.avgResponseTimeMs)}
          </div>
        </div>
        <Sparkline data={charts?.responseTimeByDay} dataKey="avgMs" color="#06d6a0" height={110} />
      </div>

      <div style={{ background: "#0d1520", border: "1px solid rgba(99,179,237,0.08)", borderRadius: 16, padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(99,179,237,0.35)", marginBottom: 20 }}>
          Response Time by Agent
        </div>
        {agents.length === 0
          ? <div style={{ textAlign: "center", padding: 32, color: "rgba(99,179,237,0.15)" }}>No data yet</div>
          : (() => {
              const maxMs = Math.max(...agents.map(a => a.avgResponseMs), 1);
              return agents
                .slice().sort((a, b) => a.avgResponseMs - b.avgResponseMs)
                .map(a => {
                  const meta = EXPERT_META[a.expert] || { label: a.expert, color: "#6366f1" };
                  return <HBar key={a.expert} label={meta.label} value={a.avgResponseMs} max={maxMs} color={meta.color} right={fmtMs(a.avgResponseMs)} />;
                });
            })()
        }
      </div>
    </div>
  );

  // ── Agents ────────────────────────────────────────────────────────────────
  const AgentsTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {agents.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "rgba(99,179,237,0.15)" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
          <div style={{ fontSize: 13 }}>No agent data yet — send a message to get started</div>
        </div>
      )}
      {agents.map(a => {
        const meta = EXPERT_META[a.expert] || { label: a.expert, color: "#6366f1" };
        const EXPERTS_EMOJI = { strategist: "🎯", copywriter: "✍️", seo: "🔍", social: "📱", analyst: "📊" };
        return (
          <div key={a.expert} style={{
            background: "#0d1520",
            border: `1px solid rgba(99,179,237,0.06)`,
            borderLeft: `3px solid ${meta.color}`,
            borderRadius: 16, padding: "22px 24px",
            transition: "border-color 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = `${meta.color}44`}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(99,179,237,0.06)"; e.currentTarget.style.borderLeftColor = meta.color; }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${meta.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  {EXPERTS_EMOJI[a.expert] || "🤖"}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#e2eaf5" }}>{meta.label}</div>
                  <div style={{ fontSize: 11, color: "rgba(99,179,237,0.35)", marginTop: 2 }}>{a.totalMessages} messages processed</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{
                  padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                  background: a.errorRate > 5 ? "rgba(239,68,68,0.12)" : "rgba(6,214,160,0.12)",
                  color: a.errorRate > 5 ? "#ef4444" : "#06d6a0",
                  border: `1px solid ${a.errorRate > 5 ? "rgba(239,68,68,0.2)" : "rgba(6,214,160,0.2)"}`,
                }}>
                  {a.errorRate > 5 ? "⚠" : "✓"} {a.errorRate}% error rate
                </span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16 }}>
              {[
                { l: "Messages",    v: fmtNum(a.totalMessages),  c: meta.color },
                { l: "Tokens",      v: fmtNum(a.totalTokens),    c: "#f59e0b"  },
                { l: "Avg Speed",   v: fmtMs(a.avgResponseMs),   c: "#06d6a0"  },
                { l: "Images",      v: a.imagesGenerated,         c: "#ec4899"  },
                { l: "Files",       v: a.filesGenerated,          c: "#a855f7"  },
              ].map(s => (
                <div key={s.l} style={{
                  textAlign: "center", padding: "14px 8px",
                  background: "rgba(255,255,255,0.02)", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.c, fontFamily: "'Space Mono',monospace", lineHeight: 1 }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: "rgba(99,179,237,0.3)", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Users ─────────────────────────────────────────────────────────────────
  const UsersTab = () => (
    <div style={{ background: "#0d1520", border: "1px solid rgba(99,179,237,0.08)", borderRadius: 16, overflow: "hidden" }}>
      <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(99,179,237,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(99,179,237,0.4)" }}>
          User Activity — {users.length} users
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "rgba(99,179,237,0.02)" }}>
              {["User", "Messages", "Tokens", "Avg Speed", "Images", "Files", "Fav Agent", "Last Active"].map(h => (
                <th key={h} style={{
                  textAlign: "left", padding: "10px 16px",
                  fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.8px", color: "rgba(99,179,237,0.28)",
                  whiteSpace: "nowrap", borderBottom: "1px solid rgba(99,179,237,0.06)",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => {
              const meta = u.favExpert ? (EXPERT_META[u.favExpert] || { label: u.favExpert, color: "#6366f1" }) : null;
              const ac   = avatarColor(u.email);
              return (
                <tr key={u.userId} style={{
                  borderBottom: "1px solid rgba(99,179,237,0.04)",
                  transition: "background 0.15s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(59,130,246,0.04)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: ac.bg, color: ac.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        {(u.email || "?")[0].toUpperCase()}
                      </div>
                      <span style={{ color: "#e2eaf5", fontSize: 12, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#3b82f6", fontFamily: "'Space Mono',monospace" }}>{fmtNum(u.totalMessages)}</span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "rgba(99,179,237,0.5)", fontFamily: "'Space Mono',monospace", fontSize: 12 }}>{fmtNum(u.totalTokens)}</td>
                  <td style={{ padding: "12px 16px", color: "rgba(99,179,237,0.5)", fontFamily: "'Space Mono',monospace", fontSize: 12 }}>{fmtMs(u.avgResponseMs)}</td>
                  <td style={{ padding: "12px 16px", color: "rgba(99,179,237,0.5)" }}>{u.imagesGenerated}</td>
                  <td style={{ padding: "12px 16px", color: "rgba(99,179,237,0.5)" }}>{u.filesGenerated}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {meta && (
                      <span style={{ padding: "3px 10px", borderRadius: 999, background: `${meta.color}18`, color: meta.color, fontSize: 11, fontWeight: 600, border: `1px solid ${meta.color}30` }}>
                        {meta.label}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", color: "rgba(99,179,237,0.3)", fontSize: 11, whiteSpace: "nowrap" }}>
                    {fmtDateShortLocal(u.lastActive)}
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 48, textAlign: "center", color: "rgba(99,179,237,0.15)" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>👥</div>
                No user activity yet
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Errors ────────────────────────────────────────────────────────────────
  const ErrorsTab = () => {
    const totalErrors = (errors?.errorTypes || []).reduce((s, e) => s + e.count, 0);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          <BigStat label="Total Errors"   value={totalErrors}                              icon="⚠️" color="#ef4444" sub={`Last ${period}`} />
          <BigStat label="Error Types"    value={errors?.errorTypes?.length || 0}          icon="🔖" color="#f59e0b" sub="Distinct types" />
          <BigStat label="Error Rate"     value={`${overview?.errorRate || 0}%`}           icon="📊" color={overview?.errorRate > 5 ? "#ef4444" : "#06d6a0"} sub="Of all requests" />
        </div>

        {/* Type breakdown */}
        <div style={{ background: "#0d1520", border: "1px solid rgba(99,179,237,0.08)", borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(99,179,237,0.35)", marginBottom: 20 }}>
            Error Type Breakdown
          </div>
          {(errors?.errorTypes || []).length === 0
            ? (
              <div style={{ textAlign: "center", padding: 32, color: "rgba(99,179,237,0.15)" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🎉</div>
                <div style={{ fontSize: 13 }}>No errors in this period</div>
              </div>
            )
            : (errors?.errorTypes || []).map(e => (
              <HBar key={e._id}
                label={e._id || "Unknown"}
                value={e.count}
                max={Math.max(...(errors?.errorTypes || []).map(x => x.count), 1)}
                color="#ef4444"
                right={`${e.count} (${totalErrors > 0 ? Math.round((e.count / totalErrors) * 100) : 0}%)`}
              />
            ))
          }
        </div>

        {/* Recent errors */}
        <div style={{ background: "#0d1520", border: "1px solid rgba(99,179,237,0.08)", borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(99,179,237,0.35)", marginBottom: 16 }}>
            Recent Errors
          </div>
          {(errors?.recentErrors || []).length === 0
            ? <div style={{ textAlign: "center", padding: 24, color: "rgba(99,179,237,0.15)", fontSize: 13 }}>No recent errors</div>
            : (errors?.recentErrors || []).map((e, i) => {
                const meta = EXPERT_META[e.expert] || { label: e.expert || "Unknown", color: "#6366f1" };
                return (
                  <div key={i} style={{
                    padding: "14px 16px", background: "rgba(239,68,68,0.04)",
                    borderRadius: 10, borderLeft: "3px solid #ef4444",
                    marginBottom: 8, border: "1px solid rgba(239,68,68,0.12)",
                    borderLeftWidth: 3,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", fontFamily: "'Space Mono',monospace" }}>{e.errorType || "Error"}</span>
                        <span style={{ padding: "1px 8px", borderRadius: 999, background: `${meta.color}18`, color: meta.color, fontSize: 10, fontWeight: 600 }}>
                          {meta.label}
                        </span>
                      </div>
                      <span style={{ fontSize: 10, color: "rgba(99,179,237,0.25)", whiteSpace: "nowrap", marginLeft: 12 }}>{formatDate(e.timestamp)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(99,179,237,0.45)", wordBreak: "break-all", marginBottom: 4, lineHeight: 1.5 }}>{e.errorMessage}</div>
                    <div style={{ fontSize: 10, color: "rgba(99,179,237,0.2)" }}>{e.userEmail || "Anonymous user"}</div>
                  </div>
                );
              })
          }
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#e2eaf5", fontFamily: "'Space Mono',monospace" }}>Analytics</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#06d6a0", display: "inline-block", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 11, color: "rgba(99,179,237,0.35)" }}>Live · auto-refreshes every 30s</span>
          </div>
        </div>

        {/* Period selector */}
        <div style={{ display: "flex", gap: 3, background: "#0d1520", border: "1px solid rgba(99,179,237,0.08)", borderRadius: 10, padding: 3 }}>
          {ANALYTICS_PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)} style={{
              padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, fontFamily: "'Space Mono',monospace",
              background: period === p.value ? "rgba(59,130,246,0.15)" : "transparent",
              color: period === p.value ? "#3b82f6" : "rgba(99,179,237,0.3)",
              transition: "all 0.15s",
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid rgba(99,179,237,0.08)" }}>
        {ATABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "10px 18px", background: "transparent", border: "none",
            borderBottom: tab === t.id ? "2px solid #3b82f6" : "2px solid transparent",
            color: tab === t.id ? "#3b82f6" : "rgba(99,179,237,0.3)",
            fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
            cursor: "pointer", marginBottom: -1,
            display: "flex", alignItems: "center", gap: 6, transition: "color 0.15s",
          }}
            onMouseEnter={e => { if (tab !== t.id) e.currentTarget.style.color = "rgba(99,179,237,0.6)"; }}
            onMouseLeave={e => { if (tab !== t.id) e.currentTarget.style.color = "rgba(99,179,237,0.3)"; }}
          >
            <span style={{ fontSize: 10 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: 80 }}>
          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ width: 32, height: 32, border: "2px solid rgba(59,130,246,0.2)", borderTop: "2px solid #3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontSize: 12, color: "rgba(99,179,237,0.3)" }}>Loading analytics…</span>
          </div>
        </div>
      )}

      {!loading && tab === "overview"    && <OverviewTab />}
      {!loading && tab === "tokens"      && <TokensTab />}
      {!loading && tab === "performance" && <PerformanceTab />}
      {!loading && tab === "agents"      && <AgentsTab />}
      {!loading && tab === "users"       && <UsersTab />}
      {!loading && tab === "errors"      && <ErrorsTab />}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Main Admin ────────────────────────────────────────────────────────────────
export default function Admin() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [time, setTime] = useState("");
  const [activePage, setActivePage] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingUserId, setLoadingUserId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Clock
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Load all data
  const loadAll = useCallback(async () => {
    try {
      const [sRes, lRes, uRes] = await Promise.all([
        authFetch("/admin/stats"),
        authFetch("/admin/logs"),
        authFetch("/admin/users"),
      ]);

      if (sRes.status === 401 || sRes.status === 403) {
        navigate("/dashboard");
        return;
      }

      if (sRes.ok) setStats(await sRes.json());
      if (lRes.ok) setLogs(await lRes.json());
      if (uRes.ok) setUsers(await uRes.json());
    } catch (e) {
      console.error("Admin load error:", e);
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, []);

  const handlePromote = async (id) => {
    setLoadingUserId(id);
    try {
      const res = await authFetch(`/admin/users/${id}/promote`, { method: "PATCH" });
      if (res.ok) {
        setUsers(prev => prev.map(u => u._id === id ? { ...u, isAdmin: true } : u));
        showToast("User promoted to admin ✓");
      } else {
        showToast("Failed to promote user", "error");
      }
    } finally { setLoadingUserId(null); }
  };

  const handleDemote = async (id) => {
    setLoadingUserId(id);
    try {
      const res = await authFetch(`/admin/users/${id}/demote`, { method: "PATCH" });
      if (res.ok) {
        setUsers(prev => prev.map(u => u._id === id ? { ...u, isAdmin: false } : u));
        showToast("User demoted ✓");
      } else {
        const err = await res.json();
        showToast(err.message || "Failed to demote", "error");
      }
    } finally { setLoadingUserId(null); }
  };

  const navItems = [
    { id: "dashboard", icon: "📊", label: "Dashboard", group: "Overview" },
    { id: "logs", icon: "💬", label: "Chat Logs", group: "Overview" },
    { id: "users", icon: "👥", label: "Users", group: "Management" },
    { id: "analytics", icon: "📈", label: "Analytics", group: "Management" },
    { id: "config", icon: "⚙️", label: "Config", group: "System" },
  ];

  const groups = [...new Set(navItems.map(n => n.group))];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#060a10", fontFamily: "'DM Sans',system-ui,sans-serif", color: "#e2eaf5" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes loadBar{ from{width:0} to{width:100%} }
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#1a2535;border-radius:99px}
        *{-webkit-font-smoothing:antialiased}
      `}</style>

      {/* Loading */}
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5" style={{ background: "#060a10" }}>
          <div style={{ fontFamily: "'Space Mono',monospace", color: "#3b82f6", fontSize: "13px", letterSpacing: "2px" }}>⚙ INITIALIZING PANEL</div>
          <div className="w-44 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#3b82f6,#06d6a0)", animation: "loadBar 1s cubic-bezier(.16,1,.3,1) forwards" }} />
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm shadow-2xl"
          style={{
            background: "#0d1520",
            borderColor: toast.type === "error" ? "rgba(236,72,153,0.3)" : "rgba(6,214,160,0.3)",
            color: toast.type === "error" ? "#f472b6" : "#34d399",
            animation: "fadeUp .2s ease",
          }}>
          {toast.type === "error" ? "⚠" : "✓"} {toast.msg}
        </div>
      )}

      {/* Sidebar */}
      <aside className="flex flex-col h-full border-r shrink-0 transition-all duration-300"
        style={{ width: sidebarOpen ? "220px" : "0", minWidth: sidebarOpen ? "220px" : "0", background: "#0d1520", borderColor: "rgba(99,179,237,0.08)", overflow: "hidden" }}>
        <div style={{ width: "220px" }} className="flex flex-col h-full">
          <div className="flex items-center gap-3 px-6 py-7">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", boxShadow: "0 0 16px rgba(59,130,246,0.4)" }}>⚡</div>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: "14px", fontWeight: 700, color: "#3b82f6" }}>
              CTRL<span style={{ color: "rgba(99,179,237,0.25)" }}>PANEL</span>
            </span>
          </div>

          <nav className="flex-1 px-3 overflow-y-auto">
            {groups.map(group => (
              <div key={group} className="mb-2">
                <p className="px-3 mb-1.5" style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "rgba(99,179,237,0.28)" }}>
                  {group}
                </p>
                {navItems.filter(n => n.group === group).map(item => (
                  <button key={item.id} onClick={() => setActivePage(item.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all relative mb-0.5"
                    style={{ background: activePage === item.id ? "rgba(59,130,246,0.12)" : "transparent", color: activePage === item.id ? "#3b82f6" : "rgba(99,179,237,0.4)" }}>
                    {activePage === item.id && (
                      <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r" style={{ background: "#3b82f6", boxShadow: "0 0 6px #3b82f6" }} />
                    )}
                    <span>{item.icon}</span>
                    <span style={{ fontSize: "13px", fontWeight: activePage === item.id ? 600 : 400 }}>{item.label}</span>
                    {item.id === "users" && users.length > 0 && (
                      <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", fontFamily: "'Space Mono',monospace", fontSize: "10px" }}>
                        {users.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="px-6 py-4 border-t" style={{ borderColor: "rgba(99,179,237,0.08)" }}>
            <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(99,179,237,0.35)" }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#06d6a0", boxShadow: "0 0 6px #06d6a0", animation: "pulse 2s infinite" }} />
              System Online
            </div>
            <div className="text-xs mt-1" style={{ color: "rgba(99,179,237,0.18)", fontFamily: "'Space Mono',monospace" }}>v2.4.1 · FastAPI</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 h-16 border-b shrink-0"
          style={{ background: "rgba(6,10,16,0.8)", borderColor: "rgba(99,179,237,0.08)", backdropFilter: "blur(16px)" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(v => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: "rgba(99,179,237,0.4)" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(99,179,237,0.08)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <h1 style={{ fontFamily: "'Space Mono',monospace", fontSize: "16px", fontWeight: 700 }}>
              Admin <span style={{ color: "#3b82f6" }}>Control Panel</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg text-xs border" style={{ fontFamily: "'Space Mono',monospace", color: "rgba(99,179,237,0.45)", background: "#0d1520", borderColor: "rgba(99,179,237,0.1)" }}>
              {time}
            </div>
            <button onClick={loadAll} className="px-3 py-1.5 rounded-lg text-xs border transition-all"
              style={{ background: "#0d1520", borderColor: "rgba(99,179,237,0.1)", color: "rgba(99,179,237,0.5)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.color = "#3b82f6"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(99,179,237,0.1)"; e.currentTarget.style.color = "rgba(99,179,237,0.5)"; }}>
              ↻ Refresh
            </button>
            <button onClick={() => navigate("/dashboard")} className="px-3 py-1.5 rounded-lg text-xs border"
              style={{ background: "rgba(59,130,246,0.1)", borderColor: "rgba(59,130,246,0.2)", color: "#60a5fa" }}>
              ← Back to App
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activePage === "dashboard" && <PageDashboard stats={stats} logs={logs} />}
          {activePage === "users" && <PageUsers users={users} onPromote={handlePromote} onDemote={handleDemote} loadingId={loadingUserId} />}
          {activePage === "logs" && <PageLogs logs={logs} />}
          {activePage === "analytics" && (
            <PageAnalytics authFetch={authFetch} />
          )}
          {activePage === "config" && (
            <Panel className="p-12">
              <EmptyState icon="🚧" text="Config — coming soon" />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
