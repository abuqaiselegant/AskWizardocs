// Chat page — wired to the AskMyDocs backend at window.API_BASE

const DOC_SOURCES = [
  { id: "langchain", label: "LangChain", dot: "#2ca190", n: 3235 },
];

const INITIAL_HISTORY = [
  { id: "c1", title: "How do LangChain agents work?", time: "pinned", pinned: true },
  { id: "c2", title: "What is LCEL (LangChain Expression Language)?", time: "recent" },
  { id: "c3", title: "How does RetrievalQA compose with a retriever?", time: "recent" },
];

// Demo sources shown in the initial seeded conversation
const DEMO_SOURCES = [
  {
    id: 1,
    title: "Agents — LangChain documentation",
    source: "LangChain",
    url: "python.langchain.com/docs/modules/agents/",
    chunk: "Agents use an LLM to determine which actions to take and in what order. An action can be using a tool and observing its output, or returning a response to the user. The agent loop runs until a stopping condition is met.",
    score: 0.92,
  },
  {
    id: 2,
    title: "Tools — LangChain documentation",
    source: "LangChain",
    url: "python.langchain.com/docs/modules/agents/tools/",
    chunk: "Tools are interfaces that an agent, chain, or LLM can use to interact with the world. They combine a name, description, and a function. The description is used by the LLM to decide when to call the tool.",
    score: 0.87,
  },
  {
    id: 3,
    title: "AgentExecutor — LangChain documentation",
    source: "LangChain",
    url: "python.langchain.com/docs/modules/agents/agent_types/",
    chunk: "AgentExecutor is the runtime for an agent. It calls the agent, executes the actions the agent selects, passes the action outputs back to the agent, and repeats until the agent finishes.",
    score: 0.83,
  },
];

const DEMO_ANSWER = "LangChain agents use an LLM as a reasoning engine to decide which **actions** to take and in what order[1]. The core loop is: (1) the LLM receives the current state (prompt + past observations) and outputs an action, (2) the action calls a **tool**, (3) the tool's output is fed back as an observation, and the loop repeats until a final answer is produced[1].\n\nTools are the interfaces agents use to interact with the world — each tool has a name, description, and callable function[2]. The LLM picks which tool to call based on the description.\n\n**AgentExecutor** is the runtime that drives the loop: it calls the agent, executes tool actions, and passes results back until the agent signals it's done[3].";

function Chat({ go, tweaks }) {
  const [history, setHistory] = React.useState(INITIAL_HISTORY);
  const [activeId, setActiveId] = React.useState("c1");
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [hoveredCite, setHoveredCite] = React.useState(null);
  const [error, setError] = React.useState(null);
  const scrollRef = React.useRef(null);

  // All sources ever seen (demo + real API). Keyed by id (number).
  const [allSources, setAllSources] = React.useState(DEMO_SOURCES);

  const [messages, setMessages] = React.useState([
    {
      role: "user",
      text: "How do LangChain agents work?",
      at: "11:04",
    },
    {
      role: "assistant",
      text: "",
      sources: [1, 2, 3],
      confidence: 0.87,
      at: "11:04",
      streamed: true,
      full: DEMO_ANSWER,
    },
  ]);

  // Animate the seeded assistant message on mount
  React.useEffect(() => {
    const msg = messages.find(m => m.role === "assistant" && m.streamed);
    if (!msg) return;
    let i = 0;
    const speed = Math.max(3, Math.floor(msg.full.length / 120));
    const id = setInterval(() => {
      i += speed;
      setMessages(ms => ms.map(m => m === msg ? { ...m, text: msg.full.slice(0, i) } : m));
      if (i >= msg.full.length) {
        clearInterval(id);
        setMessages(ms => ms.map(m => m === msg ? { ...m, text: msg.full, streamed: false } : m));
      }
    }, 40);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!input.trim() || streaming) return;
    const q = input.trim();
    setInput("");
    setError(null);

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg = { role: "user", text: q, at: now };
    const stub = { role: "assistant", text: "", sources: [], confidence: 0, at: now, streamed: true };
    setMessages(ms => [...ms, userMsg, stub]);
    setStreaming(true);

    // Add to sidebar history
    const newEntry = { id: "h" + Date.now(), title: q.slice(0, 60) + (q.length > 60 ? "…" : ""), time: "just now" };
    setHistory(h => [newEntry, ...h]);
    setActiveId(newEntry.id);

    try {
      const res = await fetch(`${window.API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
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
      const confidence = sourceIds.length >= 4 ? 0.88 : sourceIds.length >= 2 ? 0.78 : 0.62;
      const reply = data.answer;

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
          setActiveId(null);
          setInput("");
          setError(null);
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
          <div className="side-group-head mono">Pinned</div>
          {history.filter(h => h.pinned).map(h => (
            <HistItem key={h.id} h={h} active={h.id === activeId} onClick={() => setActiveId(h.id)} />
          ))}
        </div>

        <div className="side-group">
          <div className="side-group-head mono">Recent</div>
          {history.filter(h => !h.pinned).map(h => (
            <HistItem key={h.id} h={h} active={h.id === activeId} onClick={() => setActiveId(h.id)} />
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

        <button className="side-user" onClick={() => go("profile")}>
          <div className="avatar">W</div>
          <div style={{ flex: 1, textAlign: "left", overflow: "hidden" }}>
            <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Wizardocs User</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>LangChain · local</div>
          </div>
          <I.Chevron size={14} style={{ color: "var(--ink-3)" }} />
        </button>
      </aside>

      {/* MAIN */}
      <main className="chat-main">
        <header className="chat-head">
          <div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              AskMyDocs · hybrid BM25 + vector · cross-encoder rerank
            </div>
            <h1 className="chat-title">LangChain Q&A</h1>
          </div>
          <div className="chat-head-actions">
            <button className="btn ghost" title="Bookmark"><I.Bookmark size={15} /></button>
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
          <span className="mono doc-srcbar-soon">GPT-4o-mini · text-embedding-3-small · Cohere rerank</span>
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

        <div className="chat-compose">
          <SuggestedFollowups streaming={streaming} onPick={(t) => setInput(t)} />
          <div className="composer">
            <button className="comp-btn" title="Clear"><I.Upload size={16} /></button>
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
      </main>

      <style>{`
        .chat {
          height: 100vh;
          display: grid;
          grid-template-columns: 280px 1fr;
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
        .doc-srcbar-soon { font-size: 10.5px; color: var(--ink-4); letter-spacing: 0.04em; flex-shrink: 0; }
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
        .chat-main { display:flex; flex-direction: column; min-width: 0; position: relative; }
        .chat-head {
          padding: 18px 32px;
          display:flex; justify-content: space-between; align-items: flex-end;
          border-bottom: 1px solid var(--line);
          backdrop-filter: blur(10px);
          background: color-mix(in oklab, var(--bg) 70%, transparent);
        }
        .chat-title { font-family: var(--font-display); font-weight: 500; font-size: 22px; margin: 4px 0 0; letter-spacing: -0.01em; }
        .chat-head-actions { display:flex; gap:6px; }
        .chat-body { flex:1; overflow-y: auto; padding: 32px; scroll-behavior: smooth; }
        .chat-scroll { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 32px; }
        .empty-state {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 100%;
          min-height: 200px;
          opacity: 0.6;
        }
        .chat-compose {
          padding: 14px 32px 24px;
          border-top: 1px solid var(--line);
          background: var(--bg);
          position: relative;
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

function AssistantMessage({ m, sources, onHoverCite }) {
  const body = m.text;
  const paragraphs = body.split("\n\n");
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
        {paragraphs.map((p, i) => (
          <p key={i}>
            {renderWithCitations(p, sources, onHoverCite)}
            {m.streamed && i === paragraphs.length - 1 && <span className="caret" />}
          </p>
        ))}
      </div>

      {!m.streamed && m.sources && m.sources.length > 0 && (
        <div className="asst-actions">
          <button className="aa" title="Copy" onClick={() => navigator.clipboard?.writeText(m.text)}>
            <I.Copy size={13} /><span>Copy</span>
          </button>
          <button className="aa" title="Like"><I.Thumb size={13} /><span>Helpful</span></button>
          <button className="aa" title="Save"><I.Bookmark size={13} /><span>Save</span></button>
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
  const chunks = text.split(/(\*\*[^*]+\*\*)/);
  return chunks.map((c, i) => c.startsWith("**")
    ? <strong key={`${key}-${i}`} style={{ fontWeight: 600, color: "var(--ink)" }}>{c.slice(2, -2)}</strong>
    : <React.Fragment key={`${key}-${i}`}>{c}</React.Fragment>
  );
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

function SuggestedFollowups({ streaming, onPick }) {
  if (streaming) return null;
  const picks = [
    "How does LCEL pipeline composition work?",
    "What are LangChain memory types?",
    "Explain hybrid retrieval with BM25 and vector search",
  ];
  return (
    <div className="sugg">
      {picks.map((p, i) => (
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
          <a key={s.id} href={`https://${s.url}`} target="_blank" rel="noreferrer"
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

window.Chat = Chat;
window.ConfidenceMeter = ConfidenceMeter;
