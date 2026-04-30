import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { authFetch } from "../utils/api";
import ReactMarkdown from "react-markdown";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

const EXPERTS = [
  { key: "strategist", label: "Strategist", emoji: "🎯", full: "Content Strategist" },
  { key: "copywriter", label: "Copywriter", emoji: "✍️", full: "Copywriter" },
  { key: "seo", label: "SEO", emoji: "🔍", full: "SEO Expert" },
  { key: "social", label: "Social", emoji: "📱", full: "Social Media" },
  { key: "analyst", label: "Analyst", emoji: "📊", full: "Campaign Analyst" },
];

// ── Date/time helpers ────────────────────────────────────────────────────────
function formatTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function getDateKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// ── Date separator ────────────────────────────────────────────────────────────
function DateSeparator({ label }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-white/6" />
      <span className="text-xs text-zinc-600 font-medium px-2 shrink-0">{label}</span>
      <div className="flex-1 h-px bg-white/6" />
    </div>
  );
}

// ── Voice hook ──────────────────────────────────────────────────────────────
function useVoiceInput({ onResult, onError, onLoadingChange }) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const supported = typeof window !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function";

  const start = async () => {
    if (!supported || isListening || isProcessing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (!chunksRef.current.length) return;
        setIsProcessing(true);
        onLoadingChange(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const token = localStorage.getItem("token");
          const res = await fetch(`${API_BASE}/api/chats/transcribe`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: blob,
          });
          if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed"); }
          const data = await res.json();
          if (data.transcript) onResult(data.transcript);
          else onError("No speech detected.");
        } catch (e) { onError(`Transcription error: ${e.message}`); }
        finally { setIsProcessing(false); onLoadingChange(false); }
      };
      mr.start();
      setIsListening(true);
    } catch (e) {
      onError(e.name === "NotAllowedError" ? "Microphone access denied." : `Mic error: ${e.message}`);
    }
  };
  const stop = () => { mediaRecorderRef.current?.state === "recording" && mediaRecorderRef.current.stop(); setIsListening(false); };
  return { isListening, isProcessing, toggle: () => isListening ? stop() : start(), supported };
}

// ── Small components ─────────────────────────────────────────────────────────
function Toast({ message, type, onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 4000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm shadow-2xl
      ${type === "error" ? "bg-zinc-900 border-red-500/40 text-red-300" : "bg-zinc-900 border-emerald-500/40 text-emerald-300"}`}
      style={{ animation: "fadeUp .2s ease" }}>
      <span>{type === "error" ? "⚠" : "✓"}</span>
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-1 opacity-50 hover:opacity-100 text-base">×</button>
    </div>
  );
}

function ImageCard({ imageUrl }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const token = localStorage.getItem("token");
  // Route through backend proxy so the image is fetched from the AI engine server-side
  const url = `${API_BASE}/api/chats/image?path=${encodeURIComponent(imageUrl)}`;
  return (
    <div className="mt-3 rounded-2xl overflow-hidden border border-white/8 w-fit max-w-xs shadow-xl">
      {!loaded && !error && (
        <div className="w-64 h-40 flex items-center justify-center bg-zinc-800 gap-2 text-zinc-500 text-xs">
          <span className="w-3.5 h-3.5 border border-zinc-600 border-t-zinc-300 rounded-full animate-spin" /> Loading…
        </div>
      )}
      {error && <div className="w-64 h-28 flex items-center justify-center bg-zinc-800 text-zinc-500 text-xs">Failed to load</div>}
      <img src={url} alt="AI generated" className={`max-w-full transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0 h-0"}`}
        onLoad={() => setLoaded(true)} onError={() => setError(true)} />
      {loaded && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-white/6 bg-zinc-900/60">
          <span className="text-xs text-zinc-500">Generated image</span>
          <a href={url} download className="text-xs text-blue-400 hover:text-blue-300">↓ Download</a>
        </div>
      )}
    </div>
  );
}

function FileCard({ fileUrl, fileName }) {
  const isPdf = fileName?.endsWith(".pdf");
  const handleDownload = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/api/chats/doc-download?path=${encodeURIComponent(fileUrl)}`,
      { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: fileName || "doc" }).click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="mt-3 inline-flex items-center gap-3 px-4 py-3 bg-zinc-800/80 border border-white/8 rounded-2xl">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold
        ${isPdf ? "bg-red-500/15 text-red-400" : "bg-blue-500/15 text-blue-400"}`}>
        {isPdf ? "PDF" : "DOC"}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-200 font-medium truncate max-w-[150px]">{fileName || "document"}</p>
        <p className="text-xs text-zinc-500">Ready to download</p>
      </div>
      <button onClick={handleDownload}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
          ${isPdf ? "bg-red-500/20 hover:bg-red-500/30 text-red-300" : "bg-blue-500/20 hover:bg-blue-500/30 text-blue-300"}`}>
        ↓ Save
      </button>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1 px-4 py-3.5 bg-zinc-800/60 rounded-2xl rounded-tl-sm w-fit border border-white/6">
      {[0, 150, 300].map(d => (
        <span key={d} className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
      ))}
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  const time = formatTime(msg.createdAt);

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} group/msg`}>
      {/* Expert badge */}
      {!isUser && msg.expertLabel && (
        <span className="flex items-center gap-1 text-xs text-zinc-500 mb-1 ml-1">
          {msg.expertEmoji} <span className="text-zinc-600">{msg.expertLabel}</span>
        </span>
      )}
      <div className={`max-w-[85%] md:max-w-2xl px-4 py-3 rounded-2xl text-[13.5px] leading-relaxed break-words
  ${isUser
          ? "bg-zinc-700/70 text-zinc-100 rounded-tr-sm border border-white/8"
          : "bg-zinc-800/50 text-zinc-200 rounded-tl-sm border border-white/6"
        } ${msg.isOptimistic ? "opacity-60" : ""}`}>
        {isUser ? (
          <span className="whitespace-pre-wrap">{msg.content}</span>
        ) : (
          <ReactMarkdown
            components={{
              h1: ({ node, ...p }) => <h1 className="text-base font-semibold text-zinc-100 mt-3 mb-1" {...p} />,
              h2: ({ node, ...p }) => <h2 className="text-sm font-semibold text-zinc-200 mt-3 mb-1" {...p} />,
              h3: ({ node, ...p }) => <h3 className="text-sm font-medium text-zinc-300 mt-2 mb-0.5" {...p} />,
              strong: ({ node, ...p }) => <strong className="font-semibold text-zinc-100" {...p} />,
              ul: ({ node, ...p }) => <ul className="list-disc list-inside space-y-0.5 my-1 text-zinc-300" {...p} />,
              ol: ({ node, ...p }) => <ol className="list-decimal list-inside space-y-0.5 my-1 text-zinc-300" {...p} />,
              li: ({ node, ...p }) => <li className="leading-relaxed" {...p} />,
              p: ({ node, ...p }) => <p className="mb-1.5 last:mb-0" {...p} />,
              code: ({ node, inline, ...p }) => inline
                ? <code className="bg-zinc-700/60 px-1 py-0.5 rounded text-xs font-mono text-zinc-200" {...p} />
                : <code className="block bg-zinc-900/80 p-3 rounded-xl text-xs font-mono text-zinc-300 my-2 overflow-x-auto" {...p} />,
              hr: () => <hr className="border-white/8 my-2" />,
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}
        {msg.isStreaming && <span className="inline-block w-0.5 h-3.5 bg-blue-400 ml-0.5 align-middle animate-pulse" />}
      </div>

      {/* Timestamp — visible on hover only */}
      {time && !msg.isStreaming && !msg.isOptimistic && (
        <span className={`text-xs text-zinc-700 mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200 select-none
          ${isUser ? "mr-1" : "ml-1"}`}>
          {time}
        </span>
      )}

      {!isUser && msg.imageUrl && <div className="ml-0 mt-1"><ImageCard imageUrl={msg.imageUrl} /></div>}
      {!isUser && msg.fileUrl && <div className="ml-0 mt-1"><FileCard fileUrl={msg.fileUrl} fileName={msg.fileName} /></div>}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false); // closed by default — clean start
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedExpert, setSelectedExpert] = useState("strategist");
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState("");

  const dropdownRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const showToast = useCallback((msg, type = "error") => setToast({ message: msg, type }), []);

  const { isListening, isProcessing: voiceTranscribing, toggle: toggleVoice, supported: voiceSupported } = useVoiceInput({
    onResult: (t) => {
      setPrompt(t);
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`;
        inputRef.current.focus();
      }
    },
    onError: showToast,
    onLoadingChange: setVoiceProcessing,
  });

  // Load chats
  useEffect(() => {
    authFetch("/api/chats").then(async (res) => {
      if (!res.ok) { localStorage.removeItem("token"); navigate("/"); return; }
      const data = await res.json();
      setChats(data);
      if (data.length > 0) setActiveChatId(data[0]._id);
    });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Close sidebar on outside click (mobile)
  useEffect(() => {
    const h = (e) => {
      if (sidebarOpen && window.innerWidth < 768) {
        const sidebar = document.getElementById("sidebar");
        if (sidebar && !sidebar.contains(e.target)) setSidebarOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [sidebarOpen]);

  // Auto scroll
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chats, activeChatId, isStreaming]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const createNewChat = async () => {
    const res = await authFetch("/api/chats", { method: "POST" });
    if (!res.ok) { showToast("Failed to create chat."); return; }
    const chat = await res.json();
    setChats((p) => [chat, ...p]);
    setActiveChatId(chat._id);
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const deleteChat = async (e, id) => {
    e.stopPropagation();
    await authFetch(`/api/chats/${id}`, { method: "DELETE" });
    const updated = chats.filter((c) => c._id !== id);
    setChats(updated);
    if (id === activeChatId) setActiveChatId(updated[0]?._id || null);
  };

  const handleSend = async () => {
    if (!prompt.trim() || !activeChatId || isStreaming) return;
    const msg = prompt.trim();
    setPrompt("");
    setIsStreaming(true);

    // Optimistic user bubble — include client timestamp so it shows on hover
    setChats((p) => p.map((c) => c._id === activeChatId
      ? { ...c, messages: [...c.messages, { role: "user", content: msg, isOptimistic: true, createdAt: new Date().toISOString() }] } : c));
    // Empty AI bubble
    setChats((p) => p.map((c) => c._id === activeChatId
      ? { ...c, messages: [...c.messages, { role: "ai", content: "", isStreaming: true }] } : c));

    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const res = await fetch(`${API_BASE}/api/chats/${activeChatId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ content: msg, expert: selectedExpert, userId: user._id }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setChats((p) => p.map((c) => c._id === activeChatId
          ? { ...c, messages: c.messages.filter((m) => !m.isOptimistic && !m.isStreaming) } : c));
        showToast(res.status === 503 ? "AI service offline." : err.message || "Something went wrong.");
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();

        for (const line of lines) {
          const raw = line.startsWith("data: ") ? line.slice(6) : line;
          if (!raw.trim()) continue;
          try {
            const ev = JSON.parse(raw);
            if (ev.type === "token") {
              // Clear status as soon as real tokens arrive
              setStreamingStatus("");
              setChats((p) => p.map((c) => {
                if (c._id !== activeChatId) return c;
                const msgs = [...c.messages];
                const last = msgs[msgs.length - 1];
                if (last?.isStreaming) msgs[msgs.length - 1] = { ...last, content: last.content + ev.value };
                return { ...c, messages: msgs };
              }));
            } else if (ev.type === "status") {
              setStreamingStatus(ev.value);
            } else if (ev.type === "status_clear") {
              setStreamingStatus("");
            } else if (ev.type === "image") {
              setChats((p) => p.map((c) => {
                if (c._id !== activeChatId) return c;
                const msgs = [...c.messages];
                const last = msgs[msgs.length - 1];
                if (last?.isStreaming) msgs[msgs.length - 1] = { ...last, imageUrl: ev.value };
                return { ...c, messages: msgs };
              }));
            } else if (ev.type === "file") {
              setChats((p) => p.map((c) => {
                if (c._id !== activeChatId) return c;
                const msgs = [...c.messages];
                const last = msgs[msgs.length - 1];
                if (last?.isStreaming) msgs[msgs.length - 1] = { ...last, fileUrl: ev.fileUrl, fileName: ev.fileName };
                return { ...c, messages: msgs };
              }));
            } else if (ev.type === "expert_meta") {
              setChats((p) => p.map((c) => {
                if (c._id !== activeChatId) return c;
                const msgs = [...c.messages];
                const last = msgs[msgs.length - 1];
                if (last?.isStreaming) msgs[msgs.length - 1] = { ...last, expert: ev.expert, expertLabel: ev.expertLabel, expertEmoji: ev.expertEmoji };
                return { ...c, messages: msgs };
              }));
            } else if (ev.type === "done") {
              setChats((p) => p.map((c) => {
                if (c._id !== activeChatId) return c;
                return { ...c, messages: c.messages.map((m) => ({ ...m, isOptimistic: false, isStreaming: false })) };
              }));
              setStreamingStatus("");
              setIsStreaming(false);
              inputRef.current?.focus();
            } else if (ev.type === "error") {
              showToast(ev.value || "AI error.");
              setStreamingStatus("");
              setChats((p) => p.map((c) => c._id === activeChatId
                ? { ...c, messages: c.messages.filter((m) => !m.isStreaming) } : c));
              setIsStreaming(false);
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        showToast("Network error. Try again.");
        setChats((p) => p.map((c) => c._id === activeChatId
          ? { ...c, messages: c.messages.filter((m) => !m.isOptimistic && !m.isStreaming) } : c));
      }
      setStreamingStatus("");
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const activeChat = chats.find((c) => c._id === activeChatId);
  const activeExpert = EXPERTS.find((e) => e.key === selectedExpert);

  return (
    <div className="h-screen flex overflow-hidden bg-zinc-950 text-zinc-100" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 99px; }
        * { -webkit-font-smoothing: antialiased; }
        textarea::placeholder { color: #52525b; font-size: 13px; }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* ── Sidebar overlay (mobile) ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside
        id="sidebar"
        className={`fixed md:relative z-30 flex flex-col h-full bg-zinc-900 border-r border-white/6
          transition-all duration-300 ease-in-out overflow-hidden shrink-0
          ${sidebarOpen ? "w-64 opacity-100" : "w-0 md:w-0 opacity-0"}`}
        style={{ minWidth: sidebarOpen ? undefined : 0 }}
      >
        <div className="flex flex-col h-full w-64">
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-white/6 shrink-0">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Chats</span>
            <button onClick={() => setSidebarOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/6 text-zinc-500 hover:text-zinc-200 transition-colors">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* New chat button */}
          <div className="px-3 pt-3 pb-2 shrink-0">
            <button onClick={createNewChat}
              className="w-full flex items-center justify-center gap-2 h-9 bg-white/8 hover:bg-white/12 border border-white/8 rounded-xl text-xs font-medium transition-colors text-zinc-300">
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Chat
            </button>
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
            {chats.length === 0 && (
              <p className="text-zinc-600 text-xs text-center mt-6">No chats yet</p>
            )}
            {chats.map((chat) => (
              <div key={chat._id}
                onClick={() => { setActiveChatId(chat._id); if (window.innerWidth < 768) setSidebarOpen(false); }}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all
                  ${activeChatId === chat._id
                    ? "bg-white/8 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-200 hover:bg-white/4"}`}>
                <span className="text-xs truncate leading-snug">{chat.title}</span>
                <button onClick={(e) => deleteChat(e, chat._id)}
                  className="opacity-0 group-hover:opacity-100 shrink-0 ml-2 text-zinc-600 hover:text-red-400 transition-all text-base leading-none">
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Header ── */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-white/6 shrink-0 bg-zinc-950/80 backdrop-blur-xl">
          {/* Left: hamburger + title */}
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/6 text-zinc-500 hover:text-zinc-200 transition-colors">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <span className="text-sm font-medium text-zinc-300 hidden sm:block">
              {activeChat ? activeChat.title : "AI Content Workspace"}
            </span>
          </div>

          {/* Right: user menu */}
          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/6 transition-colors">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-xs font-semibold">
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <span className="text-xs text-zinc-400 hidden sm:block">{user?.name || "User"}</span>
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-zinc-600">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-zinc-900 border border-white/8 rounded-2xl shadow-2xl overflow-hidden z-50"
                style={{ animation: "fadeUp .15s ease" }}>
                <button className="w-full text-left px-4 py-2.5 text-xs text-zinc-400 hover:bg-white/6 hover:text-zinc-200 transition-colors">
                  Profile
                </button>
                <div className="h-px bg-white/6 mx-2" />
                <button onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/"); }}
                  className="w-full text-left px-4 py-2.5 text-xs text-red-400 hover:bg-white/6 transition-colors">
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ── Chat messages ── */}
        <main className="flex-1 overflow-y-auto">
          {!activeChat ? (
            /* Empty state */
            <div className="h-full flex flex-col items-center justify-center px-6 gap-8" style={{ animation: "fadeIn .4s ease" }}>
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/6 border border-white/8 flex items-center justify-center text-2xl mx-auto mb-4">✦</div>
                <h2 className="text-lg font-semibold text-zinc-200 mb-2">AI Content Workspace</h2>
                <p className="text-zinc-500 text-sm max-w-sm">Pick an expert below, then start a chat to create marketing content, strategies, and campaigns.</p>
              </div>
              <button onClick={createNewChat}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/8 hover:bg-white/12 border border-white/10 rounded-2xl text-sm font-medium text-zinc-300 transition-colors">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Start a Chat
              </button>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
              {activeChat.messages.length === 0 && (
                <p className="text-center text-zinc-600 text-sm pt-8">Send a message to get started</p>
              )}
              {activeChat.messages.reduce((acc, msg, i) => {
                const dateKey = getDateKey(msg.createdAt);
                const prevDateKey = i > 0 ? getDateKey(activeChat.messages[i - 1].createdAt) : null;
                const label = formatDateLabel(msg.createdAt);

                // Show date separator when:
                // - It's the first message with a date
                // - The date changes between consecutive messages
                if (label && dateKey && dateKey !== prevDateKey) {
                  acc.push(<DateSeparator key={`sep-${i}`} label={label} />);
                }
                acc.push(<MessageBubble key={i} msg={msg} />);
                return acc;
              }, [])}
              {isStreaming && activeChat.messages[activeChat.messages.length - 1]?.content === "" && (
                <div className="flex flex-col items-start gap-2">
                  <div className="flex items-center gap-3">
                    <TypingDots />
                    {streamingStatus && (
                      <span className="text-xs text-zinc-500 animate-pulse">{streamingStatus}</span>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* ── Input area ── */}
        <div className="shrink-0 border-t border-white/6 bg-zinc-950/60 backdrop-blur-xl">
          <div className="max-w-3xl mx-auto px-4 pt-3 pb-4">

            {/* Expert pill selector */}
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              <span className="text-xs text-zinc-600 mr-1">Expert:</span>
              {EXPERTS.map((e) => (
                <button key={e.key}
                  onClick={() => !isStreaming && setSelectedExpert(e.key)}
                  disabled={isStreaming}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border
    ${isStreaming ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
    ${selectedExpert === e.key
                      ? "bg-white/10 border-white/20 text-zinc-100"
                      : "bg-transparent border-white/6 text-zinc-500 hover:text-zinc-300 hover:border-white/12"}`}>
                  <span>{e.emoji}</span>
                  <span className="hidden sm:inline">{e.label}</span>
                </button>
              ))}
            </div>

            {/* Textarea row */}
            <div className="flex gap-2 items-center">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={isStreaming}
                  placeholder={`Ask ${activeExpert?.full || "an expert"}… (↵ send, ⇧↵ newline)`}
                  className="w-full bg-zinc-800/60 border border-white/8 rounded-2xl px-4 py-3 text-[13.5px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-white/20 resize-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed leading-relaxed"
                  style={{ minHeight: "44px", maxHeight: "160px" }}
                  onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`; }}
                />
              </div>

              {/* Mic button */}
              {voiceSupported && (
                <button onClick={toggleVoice} disabled={isStreaming || voiceProcessing}
                  title={isListening ? "Stop" : voiceProcessing ? "Transcribing…" : "Voice"}
                  className={`w-[44px] h-[44px] shrink-0 flex items-center justify-center rounded-2xl border transition-all disabled:cursor-not-allowed
                    ${isListening ? "bg-red-500/20 border-red-500/40 text-red-400 animate-pulse"
                      : voiceProcessing ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                        : "bg-zinc-800/60 border-white/8 text-zinc-500 hover:text-zinc-200 hover:border-white/16"}`}>
                  {voiceProcessing
                    ? <span className="w-3.5 h-3.5 border border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
                    : isListening
                      ? <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                      : <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v7a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-1 16.93V22h2v-2.07A8.001 8.001 0 0 0 20 12h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 7.93z" /></svg>
                  }
                </button>
              )}

              {/* Send button */}
              <button onClick={handleSend} disabled={!prompt.trim() || isStreaming}
                className="w-[44px] h-[44px] shrink-0 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/16 border border-white/10 text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                {isStreaming
                  ? <span className="w-3.5 h-3.5 border border-white/20 border-t-white rounded-full animate-spin" />
                  : <svg width="14" height="14" className="rotate-90" fill="currentColor" viewBox="0 0 24 24"><path d="M2 12L22 2L12 22L10 14L2 12Z" /></svg>
                }
              </button>
            </div>

            {/* Status hints */}
            {isStreaming && (
              <div className="flex justify-center mt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/4 border border-white/6 text-xs text-zinc-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  {activeExpert?.emoji} {activeExpert?.full} is responding…
                </span>
              </div>
            )}

            {isListening && (
              <p className="text-center text-xs text-red-500/80 mt-2 animate-pulse">● Recording — click stop when done</p>
            )}
            {voiceProcessing && (
              <p className="text-center text-xs text-yellow-500/80 mt-2 animate-pulse">● Transcribing with Whisper…</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
