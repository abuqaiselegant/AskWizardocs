// Chat page — wired to the AskMyDocs backend at window.API_BASE

const DOC_SOURCES = [
  { id: "langchain", label: "LangChain", dot: "#2ca190", n: 3235 },
];

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso), now = new Date();
  const h = (now - d) / 3600000;
  if (h < 1)  return "just now";
  if (h < 24) return `${Math.floor(h)}h ago`;
  if (h < 48) return "yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function Chat({ go, theme, toggleTheme, user }) {
  const [history, setHistory]       = React.useState([]);
  const [activeId, setActiveId]     = React.useState(null);
  const [chatId, setChatId]         = React.useState(null);
  const [messages, setMessages]     = React.useState([]);
  const [allSources, setAllSources] = React.useState([]);
  const [input, setInput]           = React.useState("");
  const [streaming, setStreaming]   = React.useState(false);
  const [hoveredCite, setHoveredCite] = React.useState(null);
  const [error, setError]           = React.useState(null);
  const [proToast, setProToast]     = React.useState(null);
  const [queriesUsed, setQueriesUsed] = React.useState(0);
  const [plan, setPlan]             = React.useState("free");
  const [followups, setFollowups]   = React.useState([]);
  const scrollRef = React.useRef(null);

  const QUERY_LIMIT = 100;
  const isLimited = plan === "free" && queriesUsed >= QUERY_LIMIT;

  const showProToast = (msg) => {
    setProToast(msg);
    setTimeout(() => setProToast(null), 4000);
  };

  const authHdr = async () => {
    const { data: { session } } = await window._supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const loadChatMessages = async (id) => {
    const h = await authHdr();
    const res = await fetch(`${window.API_BASE}/chats/${id}/messages`, { headers: h });
    if (!res.ok) return;
    const msgs = await res.json();
    const srcs = [];
    msgs.forEach(m => (m.sources_json || []).forEach(s => srcs.push({
      id: s.number, title: s.title, source: "LangChain", url: s.url, chunk: "", score: 0.8,
    })));
    setAllSources(prev => {
      const byId = Object.fromEntries(prev.map(s => [s.id, s]));
      srcs.forEach(s => { byId[s.id] = s; });
      return Object.values(byId);
    });
    setMessages(msgs.map(m => ({
      role: m.role, text: m.content, streamed: false,
      sources: (m.sources_json || []).map(s => s.number),
      at: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      confidence: (m.sources_json?.length || 0) >= 4 ? 0.88 : (m.sources_json?.length || 0) >= 2 ? 0.78 : 0.62,
    })));
  };

  // Load sidebar + profile on mount; open wd-open-chat if set, else most recent
  React.useEffect(() => {
    (async () => {
      const h = await authHdr();
      const [chatsRes, profileRes] = await Promise.all([
        fetch(`${window.API_BASE}/chats`,   { headers: h }),
        fetch(`${window.API_BASE}/profile`, { headers: h }),
      ]);
      if (profileRes.ok) {
        const p = await profileRes.json();
        setQueriesUsed(p.queries_used || 0);
        setPlan(p.plan || "free");
      }
      if (!chatsRes.ok) return;
      const chats = await chatsRes.json();
      setHistory(chats);

      const openId = localStorage.getItem("wd-open-chat");
      if (openId) {
        localStorage.removeItem("wd-open-chat");
        const pos = chats.findIndex(c => c.id === openId);
        if (pos >= 0) {
          setChatId(chats[pos].id);
          setActiveId(chats[pos].id);
          if (pos < 2) await loadChatMessages(chats[pos].id);
          return;
        }
      }

      if (chats.length > 0) {
        setChatId(chats[0].id);
        setActiveId(chats[0].id);
        await loadChatMessages(chats[0].id);
      }
    })();
  }, []);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!input.trim() || streaming || isLimited) return;
    const q = input.trim();
    setInput("");
    setError(null);
    setFollowups([]);

    // Capture context BEFORE updating messages state
    const historyForContext = messages.slice(-6).map(m => ({ role: m.role, content: m.text }));

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg = { role: "user", text: q, at: now };
    const stub = { role: "assistant", text: "", sources: [], confidence: 0, at: now, streamed: true };
    setMessages(ms => [...ms, userMsg, stub]);
    setStreaming(true);

    const h = await authHdr();
    const hdrs = { "Content-Type": "application/json", ...h };

    // Create chat if this is a new conversation
    let currentChatId = chatId;
    if (!currentChatId) {
      const cr = await fetch(`${window.API_BASE}/chats`, {
        method: "POST", headers: hdrs,
        body: JSON.stringify({ title: q.slice(0, 80) }),
      });
      if (cr.ok) {
        const { chat_id } = await cr.json();
        currentChatId = chat_id;
        setChatId(chat_id);
        // Refresh sidebar so cap enforcement is reflected
        const lr = await fetch(`${window.API_BASE}/chats`, { headers: h });
        if (lr.ok) setHistory(await lr.json());
        setActiveId(chat_id);
      }
    }

    try {
      const res = await fetch(`${window.API_BASE}/ask`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({ question: q, chat_id: currentChatId, history: historyForContext }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      // data = { answer: str, sources: [{number, title, url}] }

      const realSources = data.sources.map(s => ({
        id: s.number,
        title: s.title,
        source: "LangChain",
        url: s.url,
        chunk: "",
        score: 0.85,
      }));

      // Merge into allSources (dedupe by id)
      setAllSources(prev => {
        const byId = Object.fromEntries(prev.map(s => [s.id, s]));
        realSources.forEach(s => { byId[s.id] = s; });
        return Object.values(byId);
      });

      const sourceIds = data.sources.map(s => s.number);
      const confidence = data.confidence || 0.78;
      const reply = data.answer;
      const followupSuggestions = data.followups || [];

      // Animate text streaming
      let i = 0;
      const interval = setInterval(() => {
        i += 6;
        setMessages(ms => ms.map((m, idx) =>
          idx === ms.length - 1
            ? { ...m, text: reply.slice(0, i), sources: sourceIds, confidence }
            : m
        ));
        if (i >= reply.length) {
          clearInterval(interval);
          setMessages(ms => ms.map((m, idx) =>
            idx === ms.length - 1
              ? { ...m, text: reply, streamed: false, sources: sourceIds, confidence }
              : m
          ));
          setQueriesUsed(prev => prev + 1);
          setFollowups(followupSuggestions);
          setStreaming(false);
        }
      }, 18);
    } catch (err) {
      const errMsg = err.message.includes("Failed to fetch")
        ? "Cannot reach the API — make sure the backend is running on " + window.API_BASE
        : err.message;
      setMessages(ms => ms.map((m, idx) =>
        idx === ms.length - 1
          ? { ...m, text: `⚠ ${errMsg}`, streamed: false, sources: [], confidence: 0 }
          : m
      ));
      setError(errMsg);
      setStreaming(false);
    }
  };

  return (
    <div className="chat page-enter">
      {/* LEFT SIDEBAR */}
      <aside className="chat-side">
        <button className="side-logo" onClick={() => go("landing")}>
          <I.Logo size={22} style={{ color: "var(--accent)" }} />
          <span>Wizardocs</span>
        </button>

        <button className="new-chat" onClick={() => {
          setMessages([]);
          setChatId(null);
          setActiveId(null);
          setInput("");
          setError(null);
          setFollowups([]);
        }}>
          <I.Plus size={14} />
          <span>New conversation</span>
          <span className="kbd">⌘ K</span>
        </button>

        <div className="side-search">
          <I.Search size={13} />
          <input placeholder="Search conversations" />
        </div>

        <div className="side-group">
          <div className="side-group-head mono">Recent</div>
          {history.map((h, i) => (
            <HistItem
              key={h.id}
              h={{ ...h, time: fmtTime(h.created_at) }}
              active={h.id === activeId}
              onClick={async () => {
                setActiveId(h.id);
                if (i < 2) {
                  // has messages in DB — load them
                  setChatId(h.id);
                  await loadChatMessages(h.id);
                } else {
                  // title-only — clicking starts a new thread on next send
                  setMessages([]);
                  setChatId(null);
                }
              }}
            />
          ))}
        </div>

        <div style={{ flex: 1 }} />
        <div className="side-lib">
          <div className="side-group-head mono">Library</div>
          <div className="lib-stat">
            <div>
              <div className="lib-n">3,235</div>
              <div className="lib-l mono">indexed chunks</div>
            </div>
            <div>
              <div className="lib-n" style={{ color: "var(--good)" }}>●</div>
              <div className="lib-l mono">LangChain docs</div>
            </div>
          </div>
        </div>

        <SidebarUser user={user} go={go}/>
      </aside>

      {/* MAIN */}
      <main className="chat-main">
        <header className="chat-head">
          <div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Wizardocs · hybrid BM25 + vector · cross-encoder rerank
            </div>
            <h1 className="chat-title">
              {messages.find(m => m.role === "user")?.text.slice(0, 72) || "LangChain Q&A"}
              {(messages.find(m => m.role === "user")?.text.length || 0) > 72 ? "…" : ""}
            </h1>
          </div>
          <div className="chat-head-actions">
            <button className="btn ghost" title="Copy conversation"
              onClick={() => {
                const txt = messages.map(m => (m.role === "user" ? "You: " : "Wizardocs: ") + m.text).join("\n\n");
                navigator.clipboard?.writeText(txt);
              }}>
              <I.Copy size={15} />
            </button>
            {toggleTheme && (
              <button className="btn ghost" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleTheme}>
                {theme === "dark" ? <I.Sun size={15}/> : <I.Moon size={15}/>}
              </button>
            )}
            <button className="btn ghost" title="Back to home" onClick={() => go("landing")}>
              <I.Arrow size={15} style={{transform:"rotate(180deg)"}}/>
            </button>
          </div>
        </header>

        {/* Source selector */}
        <div className="doc-srcbar">
          <span className="mono doc-srcbar-label">Answering from</span>
          <div className="doc-srcbar-chips">
            {DOC_SOURCES.map(s => (
              <button key={s.id} className="docchip on" title={`${s.n.toLocaleString()} indexed chunks`}>
                <span className="docchip-dot" style={{ background: s.dot }} />
                <span>{s.label}</span>
                <span className="mono docchip-n">{(s.n / 1000).toFixed(1)}k chunks</span>
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <QueryCounter used={queriesUsed} limit={QUERY_LIMIT} plan={plan}/>
        </div>

        {error && (
          <div className="api-error mono">
            <I.Shield size={13} /> {error}
          </div>
        )}

        <div className="chat-body" ref={scrollRef}>
          <div className="chat-scroll">
            {messages.length === 0 && (
              <div className="empty-state">
                <I.Logo size={48} style={{ color: "var(--accent)", opacity: 0.4 }} />
                <p className="mono" style={{ color: "var(--ink-3)", marginTop: 16 }}>Ask anything about LangChain</p>
              </div>
            )}
            {messages.map((m, i) => m.role === "user" ? (
              <UserBubble key={i} m={m} />
            ) : (
              <React.Fragment key={i}>
                <AssistantMessage
                  m={m}
                  sources={allSources}
                  onHoverCite={setHoveredCite}
                  onSave={() => showProToast("Saving answers is a Pro feature.")}
                />
                {!m.streamed && m.sources && m.sources.length > 0 && (
                  <SourceCards
                    ids={m.sources}
                    all={allSources}
                    hovered={hoveredCite}
                    onHover={setHoveredCite}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {proToast && (
          <div className="pro-toast">
            <I.Bookmark size={13}/>
            <span>{proToast}</span>
            <button className="btn primary" style={{padding:"5px 12px", fontSize:12}}
              onClick={() => { go("landing"); setProToast(null); }}>
              Upgrade to Pro →
            </button>
            <button className="pro-toast-x" onClick={() => setProToast(null)}>✕</button>
          </div>
        )}

        {isLimited ? (
          <div className="limit-wall">
            <div className="limit-wall-inner">
              <div className="limit-icon">🔒</div>
              <div>
                <div className="limit-title">Monthly limit reached</div>
                <div className="muted" style={{marginTop:4}}>
                  You've used all {QUERY_LIMIT} free queries this month. Upgrade to Pro for unlimited queries, saved answers, and your own docs.
                </div>
              </div>
              <button className="btn primary" style={{flexShrink:0}} onClick={() => go("landing")}>
                Upgrade to Pro →
              </button>
            </div>
          </div>
        ) : (
        <div className="chat-compose">
          <SuggestedFollowups streaming={streaming} followups={followups} onPick={(t) => setInput(t)} />
          <div className="composer">
            <button className="comp-btn" title="Upload your own docs (Pro)" onClick={() => showProToast("Uploading your own docs is a Pro feature.")}><I.Upload size={16} /></button>
            <textarea
              placeholder="Ask about LangChain — e.g. 'How do agents work?' or 'Explain LCEL pipelines'"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
            />
            <div className="comp-meta mono">
              <span>hybrid retrieval → cross-encoder rerank → GPT-4o-mini</span>
            </div>
            <button className="comp-send" onClick={send} disabled={!input.trim() || streaming}>
              {streaming ? <span className="spin" /> : <I.ArrowUp size={16} />}
            </button>
          </div>
          <div className="compose-foot mono">
            <span><I.Shield size={11} /> Grounded in 3,235 deduplicated LangChain doc chunks</span>
            <span><span className="kbd">↵</span> send · <span className="kbd">⇧ ↵</span> newline</span>
          </div>
        </div>
        )}

      </main>

      <style>{`
        .chat {
          height: 100vh;
          max-height: 100vh;
          display: grid;
          grid-template-columns: 280px 1fr;
          grid-template-rows: 100vh;
          background: var(--bg);
          overflow: hidden;
        }
        .api-error {
          margin: 0 32px;
          padding: 10px 14px;
          background: color-mix(in oklab, var(--danger) 10%, var(--surface));
          border: 1px solid color-mix(in oklab, var(--danger) 40%, var(--line));
          border-radius: 8px;
          font-size: 12px;
          color: var(--danger);
          display: flex; align-items: center; gap: 8px;
        }
        .doc-srcbar {
          display: flex; align-items: center; gap: 14px;
          padding: 10px 32px;
          border-bottom: 1px solid var(--line);
          background: var(--bg-2);
          overflow-x: auto;
          white-space: nowrap;
        }
        .doc-srcbar-label { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-4); flex-shrink: 0; }
        .doc-srcbar-chips { display: inline-flex; gap: 6px; }
        .docchip {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 6px 10px;
          border: 1px solid var(--line);
          border-radius: 999px;
          background: var(--surface);
          font-size: 12px; color: var(--ink-3);
        }
        .docchip.on { background: var(--surface-2); color: var(--ink); border-color: var(--line-2); }
        .docchip-dot { width: 7px; height: 7px; border-radius: 50%; box-shadow: 0 0 8px currentColor; }
        .docchip-n { font-size: 10px; color: var(--ink-4); letter-spacing: 0.04em; }

        .chat-side {
          border-right: 1px solid var(--line);
          background: var(--bg-2);
          display: flex; flex-direction: column;
          padding: 18px 14px;
          gap: 14px;
          overflow-y: auto;
          height: 100vh;
          min-height: 0;
        }
        .side-logo {
          display:flex; align-items:center; gap: 10px;
          font-family: var(--font-display); font-weight: 600; font-size: 15px;
          padding: 4px 6px;
        }
        .new-chat {
          display:flex; align-items:center; gap: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid var(--line-2);
          background: var(--surface);
          font-size: 13.5px;
          transition: border-color .15s, background .15s;
        }
        .new-chat:hover { border-color: var(--accent); background: var(--surface-2); }
        .new-chat .kbd { margin-left: auto; }
        .side-search {
          display:flex; align-items:center; gap:8px;
          padding: 8px 10px;
          background: var(--bg);
          border: 1px solid var(--line);
          border-radius: 8px;
        }
        .side-search input { flex:1; background: transparent; border: 0; outline: none; font-size: 13px; color: var(--ink); }
        .side-search input::placeholder { color: var(--ink-4); }
        .side-search svg { color: var(--ink-3); }
        .side-group { display:flex; flex-direction: column; gap: 2px; }
        .side-group-head { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-4); padding: 6px 6px; margin-top: 4px; }
        .side-lib { border-top: 1px solid var(--line); padding-top: 12px; }
        .lib-stat { display:grid; grid-template-columns: 1fr 1fr; gap:8px; padding: 6px; }
        .lib-n { font-family: var(--font-display); font-weight: 500; font-size: 20px; letter-spacing:-0.01em; }
        .lib-l { font-size: 10px; color: var(--ink-3); letter-spacing: 0.08em; text-transform: uppercase; }
        .side-user {
          display:flex; align-items:center; gap: 10px;
          padding: 8px; border-radius: 10px; border: 1px solid var(--line);
          transition: background .15s;
        }
        .side-user:hover { background: var(--surface); }
        .avatar {
          width: 30px; height: 30px; border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: #0a0a0f; font-weight: 600; font-size: 13px;
          display:grid; place-items: center;
        }
        .chat-main { display:flex; flex-direction: column; min-width: 0; overflow: hidden; }
        .chat-head {
          flex-shrink: 0;
          padding: 18px 32px;
          display:flex; justify-content: space-between; align-items: flex-end;
          border-bottom: 1px solid var(--line);
          backdrop-filter: blur(10px);
          background: color-mix(in oklab, var(--bg) 70%, transparent);
        }
        .chat-title { font-family: var(--font-display); font-weight: 500; font-size: 22px; margin: 4px 0 0; letter-spacing: -0.01em; }
        .chat-head-actions { display:flex; gap:6px; }
        .chat-body { flex:1; min-height: 0; overflow-y: auto; padding: 32px; scroll-behavior: smooth; }
        .chat-scroll { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 32px; }
        .empty-state {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 100%;
          min-height: 200px;
          opacity: 0.6;
        }
        .chat-compose {
          flex-shrink: 0;
          padding: 14px 32px 24px;
          border-top: 1px solid var(--line);
          background: var(--bg);
        }
        .composer {
          max-width: 760px; margin: 0 auto;
          display: grid; grid-template-columns: auto 1fr auto auto;
          align-items: start;
          padding: 10px;
          background: var(--surface);
          border: 1px solid var(--line-2);
          border-radius: 14px;
          transition: border-color .15s, box-shadow .15s;
        }
        .composer:focus-within { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
        .composer textarea {
          resize: none; border: 0; outline: none; background: transparent;
          font-family: var(--font-sans); color: var(--ink);
          font-size: 14.5px; line-height: 1.5;
          padding: 8px 10px;
          min-height: 28px; max-height: 200px;
        }
        .composer textarea::placeholder { color: var(--ink-4); }
        .comp-btn {
          width: 36px; height: 36px; display:grid; place-items:center;
          border-radius: 8px; color: var(--ink-3);
          transition: color .15s, background .15s;
        }
        .comp-btn:hover { color: var(--ink); background: var(--surface-3); }
        .comp-meta {
          grid-column: 2; grid-row: 2;
          font-size: 11px; color: var(--ink-4);
          padding: 0 10px;
          display:flex; gap: 8px; align-items: center;
        }
        .comp-send {
          width: 36px; height: 36px; display:grid; place-items:center;
          border-radius: 8px;
          background: var(--accent); color: #0a0a0f;
          align-self: flex-end;
          transition: background .15s, opacity .15s;
        }
        .comp-send:disabled { opacity: 0.4; cursor: default; }
        .comp-send:not(:disabled):hover { background: var(--accent-2); }
        .spin { width:14px; height:14px; border:2px solid rgba(0,0,0,0.2); border-top-color:#0a0a0f; border-radius:50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .compose-foot {
          max-width: 760px; margin: 8px auto 0;
          display:flex; justify-content: space-between;
          font-size: 11px; color: var(--ink-4); letter-spacing: 0.02em;
        }
        .compose-foot span { display:inline-flex; align-items:center; gap: 6px; }
        .pro-toast {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 16px;
          background: color-mix(in oklab, var(--accent) 8%, var(--surface));
          border-top: 1px solid color-mix(in oklab, var(--accent) 30%, var(--line));
          font-size: 13.5px; color: var(--ink);
          animation: slideUp .2s ease both;
        }
        .pro-toast svg { color: var(--accent); flex-shrink: 0; }
        .pro-toast span { flex: 1; }
        .pro-toast-x {
          width: 24px; height: 24px; display:grid; place-items:center;
          border-radius: 6px; font-size: 14px; color: var(--ink-3);
          transition: color .15s, background .15s;
        }
        .pro-toast-x:hover { color: var(--ink); background: var(--surface-3); }
        @keyframes slideUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .limit-wall {
          flex-shrink: 0;
          padding: 20px 32px;
          border-top: 1px solid color-mix(in oklab, var(--accent) 25%, var(--line));
          background: color-mix(in oklab, var(--accent) 5%, var(--bg));
        }
        .limit-wall-inner {
          max-width: 760px; margin: 0 auto;
          display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
        }
        .limit-icon { font-size: 28px; flex-shrink: 0; }
        .limit-title { font-weight: 600; font-size: 15px; color: var(--ink); }
        .qc { display:inline-flex; align-items:center; gap: 8px; font-size: 11px; letter-spacing: 0.04em; }
        .qc-bar {
          width: 72px; height: 4px; border-radius: 2px;
          background: var(--line-2); overflow: hidden;
        }
        .qc-fill { height: 100%; border-radius: 2px; transition: width .4s ease; }
        @media (max-width: 1100px) {
          .chat { grid-template-columns: 80px 1fr; }
          .chat-side .new-chat span:not(.kbd), .chat-side .side-search input,
          .chat-side .side-group, .chat-side .side-lib, .chat-side .side-user > div:nth-child(2) { display: none; }
          .chat-side .side-logo span { display: none; }
        }
        @media (max-width: 820px) {
          .chat { grid-template-columns: 1fr; }
          .chat-side { display: none; }
        }
      `}</style>
    </div>
  );
}

function HistItem({ h, active, onClick }) {
  return (
    <button className={"hist " + (active ? "active" : "")} onClick={onClick}>
      <span className="hist-title">{h.title}</span>
      <span className="mono hist-time">{h.time}</span>
      <style>{`
        .hist {
          display:flex; align-items:center; gap: 8px;
          padding: 8px 10px; border-radius: 8px;
          text-align: left; color: var(--ink-2); font-size: 13px;
          transition: background .15s, color .15s;
          position: relative;
        }
        .hist:hover { background: var(--surface); color: var(--ink); }
        .hist.active { background: var(--accent-soft); color: var(--ink); }
        .hist.active::before {
          content:""; position: absolute; left: 0; top: 6px; bottom: 6px;
          width: 2px; background: var(--accent); border-radius: 2px;
        }
        .hist-title { flex:1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hist-time { font-size: 10px; color: var(--ink-4); letter-spacing: 0.03em; }
      `}</style>
    </button>
  );
}

function UserBubble({ m }) {
  return (
    <div className="user-bubble">
      <div className="ub-body">{m.text}</div>
      <div className="mono ub-meta">you · {m.at}</div>
      <style>{`
        .user-bubble { align-self: flex-end; max-width: 80%; }
        .ub-body {
          background: var(--surface-2);
          border: 1px solid var(--line-2);
          padding: 12px 16px;
          border-radius: 16px 16px 4px 16px;
          color: var(--ink); font-size: 15px; line-height: 1.5;
        }
        .ub-meta { font-size: 10px; color: var(--ink-4); margin-top: 6px; text-align: right; letter-spacing: 0.05em; }
      `}</style>
    </div>
  );
}

function AssistantMessage({ m, sources, onHoverCite, onSave }) {
  const body = m.text;
  return (
    <div className="asst">
      <div className="asst-head">
        <div className="asst-av">
          <I.Logo size={14} style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <div className="asst-name">Wizardocs</div>
          <div className="mono asst-meta">
            <I.Cite size={11} /> grounded · {m.sources?.length || 0} chunks retrieved
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {m.confidence > 0 && <ConfidenceMeter value={m.confidence} />}
      </div>

      <div className="asst-body">
        <ReactMarkdown text={body} sources={sources} onHoverCite={onHoverCite} streamed={m.streamed}/>
      </div>

      {!m.streamed && m.sources && m.sources.length > 0 && (
        <div className="asst-actions">
          <button className="aa" title="Copy" onClick={() => navigator.clipboard?.writeText(m.text)}>
            <I.Copy size={13} /><span>Copy</span>
          </button>
          <button className="aa" title="Like"><I.Thumb size={13} /><span>Helpful</span></button>
          <button className="aa" title="Save answer (Pro)" onClick={onSave}><I.Bookmark size={13} /><span>Save</span></button>
          <div style={{ flex: 1 }} />
          <div className="mono src-pills">
            {m.sources?.map(sid => {
              const s = sources.find(x => x.id === sid);
              if (!s) return null;
              return (
                <span key={sid} className="src-pill"
                  onMouseEnter={() => onHoverCite(sid)}
                  onMouseLeave={() => onHoverCite(null)}>
                  <I.File size={10} /> {s.source}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        .asst { display:flex; flex-direction:column; gap: 10px; }
        .asst-head { display:flex; align-items:center; gap: 10px; }
        .asst-av {
          width: 26px; height: 26px; border-radius: 8px;
          background: var(--surface-2); border: 1px solid var(--line-2);
          display:grid; place-items:center;
          box-shadow: 0 0 20px -5px var(--accent-glow);
        }
        .asst-name { font-weight: 500; font-size: 14px; letter-spacing: -0.01em; }
        .asst-meta { display:inline-flex; align-items:center; gap: 5px; font-size: 11px; color: var(--ink-3); }
        .asst-body { font-size: 15.5px; line-height: 1.65; color: var(--ink); text-wrap: pretty; }
        .asst-body p { margin: 0 0 14px; }
        .asst-body p:last-child { margin-bottom: 0; }
        .asst-body pre { margin: 10px 0 14px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 8px; overflow-x: auto; }
        .asst-body pre code { display:block; padding: 14px 16px; font-family: var(--font-mono); font-size: 13px; color: var(--ink-2); white-space: pre; }
        .asst-body code { font-family: var(--font-mono); font-size: 13px; background: var(--surface-2); padding: 1px 5px; border-radius: 4px; color: var(--accent); }
        .asst-body pre code { background: none; padding: 0; color: var(--ink-2); }
        .asst-body ul, .asst-body ol { margin: 0 0 14px; padding-left: 22px; }
        .asst-body li { margin-bottom: 4px; }
        .asst-body h3, .asst-body h4, .asst-body h5 { font-family: var(--font-display); font-weight: 500; margin: 18px 0 8px; letter-spacing: -0.01em; }
        .asst-body h3 { font-size: 17px; }
        .asst-body h4 { font-size: 15px; }
        .asst-body blockquote { margin: 0 0 14px; padding: 8px 14px; border-left: 3px solid var(--accent); background: var(--accent-soft); border-radius: 0 6px 6px 0; color: var(--ink-2); }
        .asst-body hr { border: none; border-top: 1px solid var(--line); margin: 16px 0; }
        .caret {
          display:inline-block; width: 2px; height: 18px;
          background: var(--accent); margin-left: 2px;
          vertical-align: text-bottom;
          animation: blink 0.9s steps(2) infinite;
        }
        @keyframes blink { 50% { opacity: 0; } }
        .asst-actions { display:flex; gap: 4px; align-items:center; padding-top: 4px; }
        .aa {
          display:inline-flex; gap: 6px; align-items:center;
          padding: 5px 9px; border-radius: 6px;
          font-size: 12px; color: var(--ink-3);
          transition: color .15s, background .15s;
        }
        .aa:hover { color: var(--ink); background: var(--surface-2); }
        .src-pills { display:inline-flex; gap: 4px; flex-wrap: wrap; justify-content:flex-end; }
        .src-pill {
          display:inline-flex; align-items:center; gap: 5px;
          font-size: 10.5px; color: var(--ink-3);
          padding: 3px 7px;
          background: var(--surface); border: 1px solid var(--line); border-radius: 999px;
          cursor: default;
          transition: border-color .15s, color .15s;
        }
        .src-pill:hover { border-color: var(--accent); color: var(--accent); }
      `}</style>
    </div>
  );
}

// ReactMarkdown — uses marked.lexer for block structure, keeps interactive citation pills inline
function ReactMarkdown({ text, sources, onHoverCite, streamed }) {
  if (!text) return null;

  let tokens;
  try {
    tokens = window.marked ? window.marked.lexer(text) : null;
  } catch(e) { tokens = null; }

  if (!tokens) {
    // fallback if marked not loaded yet
    const paras = text.split("\n\n");
    return paras.map((p, i) => (
      <p key={i}>
        {renderWithCitations(p, sources, onHoverCite)}
        {streamed && i === paras.length - 1 && <span className="caret"/>}
      </p>
    ));
  }

  const visible = tokens.filter(t => t.type !== 'space');
  return tokens.map((token, i) => {
    const isLast = token === visible[visible.length - 1];
    switch (token.type) {
      case 'paragraph':
        return (
          <p key={i}>
            {renderWithCitations(token.text, sources, onHoverCite)}
            {streamed && isLast && <span className="caret"/>}
          </p>
        );
      case 'code':
        return (
          <pre key={i}><code className={token.lang ? `language-${token.lang}` : ""}>{token.text}</code></pre>
        );
      case 'heading': {
        const lvl = Math.min(token.depth + 2, 5);
        const Tag = `h${lvl}`;
        return <Tag key={i}>{token.text}</Tag>;
      }
      case 'list':
        const ListTag = token.ordered ? 'ol' : 'ul';
        return (
          <ListTag key={i}>
            {token.items.map((item, j) => (
              <li key={j}>{renderWithCitations(item.text, sources, onHoverCite)}</li>
            ))}
          </ListTag>
        );
      case 'blockquote':
        return <blockquote key={i}>{renderWithCitations(token.text || '', sources, onHoverCite)}</blockquote>;
      case 'hr':
        return <hr key={i}/>;
      case 'space':
        return null;
      default:
        return token.raw
          ? <p key={i}>{renderWithCitations(token.raw.trim(), sources, onHoverCite)}</p>
          : null;
    }
  });
}

function renderWithCitations(text, sources, onHoverCite) {
  const parts = [];
  let lastIdx = 0;
  const re = /\[(\d+)\]/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    const n = parseInt(match[1]);
    parts.push(<CitationPill key={match.index} n={n} sources={sources} onHoverCite={onHoverCite} />);
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts.map((p, i) => typeof p === "string" ? renderBold(p, i) : p);
}

function renderBold(text, key) {
  const chunks = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/);
  return chunks.map((c, i) => {
    if (c.startsWith("**")) return <strong key={`${key}-${i}`} style={{fontWeight:600,color:"var(--ink)"}}>{c.slice(2,-2)}</strong>;
    if (c.startsWith("`"))  return <code key={`${key}-${i}`}>{c.slice(1,-1)}</code>;
    return <React.Fragment key={`${key}-${i}`}>{c}</React.Fragment>;
  });
}

function CitationPill({ n, sources, onHoverCite }) {
  const src = sources.find(s => s.id === n);
  const [open, setOpen] = React.useState(false);
  if (!src) return <span>[{n}]</span>;
  return (
    <span
      className="cit"
      onMouseEnter={() => { setOpen(true); onHoverCite(n); }}
      onMouseLeave={() => { setOpen(false); onHoverCite(null); }}
    >
      <sup>[{n}]</sup>
      {open && (
        <span className="cit-pop">
          <span className="mono cit-pop-file"><I.File size={10} /> {src.title}</span>
          {src.chunk && <span className="cit-pop-body">{src.chunk}</span>}
          <span className="cit-pop-score mono">{src.url}</span>
        </span>
      )}
      <style>{`
        .cit { position: relative; display: inline; color: var(--accent); cursor: pointer; font-weight: 500; }
        .cit sup {
          font-family: var(--font-mono); font-size: 10px;
          background: var(--accent-soft); padding: 1px 4px;
          border-radius: 4px; border: 1px solid var(--accent); margin-left: 2px;
        }
        .cit:hover sup { background: var(--accent); color: #0a0a0f; }
        .cit-pop {
          position: absolute; bottom: calc(100% + 10px); left: 0;
          width: 360px; padding: 12px;
          background: var(--surface); border: 1px solid var(--line-2);
          border-radius: 10px;
          box-shadow: 0 20px 40px -10px rgba(0,0,0,0.6);
          z-index: 10; display:flex; flex-direction: column; gap: 8px;
          color: var(--ink); animation: pageIn .15s ease both;
        }
        .cit-pop-file { font-size: 11px; color: var(--accent); display:inline-flex; align-items:center; gap:5px; }
        .cit-pop-body { font-size: 13px; color: var(--ink-2); line-height: 1.55; }
        .cit-pop-score { font-size: 10px; color: var(--ink-3); letter-spacing:0.05em; word-break: break-all; }
      `}</style>
    </span>
  );
}

function ConfidenceMeter({ value = 0.85 }) {
  const pct = Math.round(value * 100);
  const label = pct >= 80 ? "high" : pct >= 60 ? "medium" : "low";
  const color = pct >= 80 ? "var(--good)" : pct >= 60 ? "var(--warn)" : "var(--danger)";
  return (
    <div className="conf">
      <div className="conf-bars">
        {[0, 1, 2, 3, 4].map(i => (
          <span key={i} className={"cb " + (i < Math.round(value * 5) ? "on" : "")}
            style={{ background: i < Math.round(value * 5) ? color : "var(--line-2)" }} />
        ))}
      </div>
      <div className="mono conf-l" style={{ color }}>{label} · {pct}%</div>
      <style>{`
        .conf { display:inline-flex; align-items:center; gap: 8px; }
        .conf-bars { display:inline-flex; gap: 2px; align-items: flex-end; }
        .cb { width: 3px; border-radius: 1px; }
        .cb:nth-child(1) { height: 6px } .cb:nth-child(2) { height: 9px }
        .cb:nth-child(3) { height: 12px } .cb:nth-child(4) { height: 15px }
        .cb:nth-child(5) { height: 18px }
        .conf-l { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; }
      `}</style>
    </div>
  );
}

function SuggestedFollowups({ streaming, followups, onPick }) {
  if (streaming || !followups.length) return null;
  return (
    <div className="sugg">
      {followups.map((p, i) => (
        <button key={i} className="sugg-pill" onClick={() => onPick(p)}>
          <I.Spark size={11} /> {p}
        </button>
      ))}
      <style>{`
        .sugg {
          max-width: 760px; margin: 0 auto 10px;
          display:flex; gap: 6px; flex-wrap: wrap;
        }
        .sugg-pill {
          display:inline-flex; align-items:center; gap: 6px;
          padding: 6px 10px; font-size: 12px; color: var(--ink-2);
          background: var(--surface); border: 1px solid var(--line); border-radius: 999px;
          transition: border-color .15s, color .15s, background .15s;
        }
        .sugg-pill:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
      `}</style>
    </div>
  );
}

function SourceCards({ ids, all, hovered, onHover }) {
  const cards = ids.map(id => all.find(s => s.id === id)).filter(Boolean);
  if (!cards.length) return null;
  return (
    <div className="srccards">
      <div className="srccards-head">
        <div className="mono srccards-label">Sources cited in this answer</div>
        <div className="mono srccards-n">{cards.length} result{cards.length !== 1 ? "s" : ""}</div>
      </div>
      <div className="srccards-grid">
        {cards.map(s => (
          <a key={s.id} href={s.url.startsWith("http") ? s.url : `https://${s.url}`} target="_blank" rel="noreferrer"
            className={"srccard " + (hovered === s.id ? "on" : "")}
            onMouseEnter={() => onHover(s.id)} onMouseLeave={() => onHover(null)}>
            <div className="srccard-top">
              <span className="mono srccard-n">[{s.id}]</span>
              <span className="mono srccard-source">{s.source}</span>
              <span style={{ flex: 1 }} />
              <span className="mono srccard-score" style={{ color: s.score > 0.85 ? "var(--good)" : "var(--warn)" }}>
                match {s.score.toFixed(2)}
              </span>
            </div>
            <div className="srccard-title">{s.title}</div>
            {s.chunk && <div className="srccard-chunk">{s.chunk}</div>}
            <div className="srccard-url mono">
              <I.Arrow size={11} /> {s.url}
            </div>
          </a>
        ))}
      </div>
      <style>{`
        .srccards { margin-top: 18px; padding-top: 22px; border-top: 1px dashed var(--line); animation: pageIn .35s ease both; }
        .srccards-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
        .srccards-label { font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3); }
        .srccards-n     { font-size: 10.5px; letter-spacing: 0.08em; color: var(--ink-4); text-transform: uppercase; }
        .srccards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (max-width: 1200px) { .srccards-grid { grid-template-columns: 1fr; } }
        .srccard {
          display: block; padding: 14px 16px;
          background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
          text-decoration: none; color: inherit;
          transition: border-color .2s, transform .2s, background .2s;
        }
        .srccard:hover, .srccard.on { border-color: var(--accent); background: var(--surface-2); transform: translateY(-1px); }
        .srccard-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .srccard-n { color: var(--accent); font-size: 11px; }
        .srccard-source { font-size: 10.5px; color: var(--ink-2); padding: 2px 7px; background: var(--bg); border: 1px solid var(--line); border-radius: 999px; }
        .srccard-score  { font-size: 10.5px; letter-spacing: 0.05em; text-transform: uppercase; }
        .srccard-title  { font-family: var(--font-display); font-weight: 500; font-size: 14.5px; color: var(--ink); margin: 2px 0 6px; line-height: 1.35; }
        .srccard-chunk  {
          font-size: 12.5px; line-height: 1.55; color: var(--ink-2);
          padding: 8px 10px; background: var(--bg); border-left: 2px solid var(--accent); border-radius: 2px;
          margin-bottom: 8px;
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
        }
        .srccard-url {
          font-size: 10.5px; color: var(--ink-3);
          display: inline-flex; align-items: center; gap: 5px;
          max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .srccard:hover .srccard-url { color: var(--accent); }
      `}</style>
    </div>
  );
}

function SidebarUser({ user, go }) {
  const name    = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "You";
  const initial = name.charAt(0).toUpperCase();

  const signOut = async () => {
    await window._supabase.auth.signOut();
    // onAuthStateChange in app.jsx handles the redirect to landing
  };

  return (
    <div className="side-user-wrap">
      <button className="side-user" onClick={() => go("profile")}>
        <div className="avatar">{initial}</div>
        <div style={{ flex: 1, textAlign: "left", overflow: "hidden" }}>
          <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>LangChain · free</div>
        </div>
        <I.Chevron size={14} style={{ color: "var(--ink-3)" }} />
      </button>
      <button className="side-signout mono" onClick={signOut} title="Sign out">
        ⎋
      </button>
      <style>{`
        .side-user-wrap { display: flex; align-items: center; gap: 4px; }
        .side-user { flex: 1; display:flex; align-items:center; gap: 10px; padding: 8px; border-radius: 10px; border: 1px solid var(--line); transition: background .15s; }
        .side-user:hover { background: var(--surface); }
        .side-signout {
          flex-shrink: 0;
          padding: 8px 10px; border-radius: 8px;
          font-size: 16px; color: var(--ink-3);
          transition: color .15s, background .15s;
        }
        .side-signout:hover { color: var(--danger); background: var(--surface); }
      `}</style>
    </div>
  );
}

function QueryCounter({ used, limit, plan }) {
  if (plan !== "free") return null;
  const pct = Math.min(used / limit, 1);
  const remaining = Math.max(limit - used, 0);
  const color = pct >= 1 ? "var(--danger)" : pct >= 0.8 ? "var(--warn)" : "var(--accent)";
  return (
    <div className="qc mono">
      <div className="qc-bar">
        <div className="qc-fill" style={{ width: `${pct * 100}%`, background: color }}/>
      </div>
      <span style={{ color }}>
        {used} / {limit} queries
        {remaining > 0 && remaining <= 20 && ` · ${remaining} left`}
      </span>
    </div>
  );
}

window.Chat = Chat;
window.ConfidenceMeter = ConfidenceMeter;
