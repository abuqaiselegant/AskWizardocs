// Profile page — timeline history, saved bookmarks, settings
const ConfidenceMeter = window.ConfidenceMeter;

function Profile({ go, tweaks }) {
  const [tab, setTab] = React.useState("history");
  return (
    <div className="profile page-enter">
      <Nav go={go}/>

      <div className="prof-hero">
        <div className="prof-bg"/>
        <div className="prof-hero-inner">
          <div className="prof-avatar-wrap">
            <div className="prof-avatar">C</div>
            <div className="prof-avatar-ring"/>
          </div>
          <div>
            <div className="mono" style={{fontSize:11, letterSpacing:"0.08em", color:"var(--ink-3)", textTransform:"uppercase"}}>
              <span style={{color:"var(--good)"}}>●</span> online · workspace: northwind
            </div>
            <h1 className="prof-name">
              Casey Ng
              <span className="serif-it" style={{color:"var(--ink-3)", marginLeft:12}}>— knowledge engineer</span>
            </h1>
            <p className="muted" style={{maxWidth:560}}>
              Joined Feb 2026. Indexed 312 docs, asked 1,847 questions, and saved 26 answers worth coming back to.
            </p>
          </div>
          <div style={{flex:1}}/>
          <button className="btn"><I.Settings size={14}/> Edit profile</button>
        </div>

        <div className="prof-stats">
          <Stat k="1,847" l="queries" trend="+12%"/>
          <Stat k="312"   l="indexed docs" trend="+18"/>
          <Stat k="26"    l="saved answers" trend="+3 this week"/>
          <Stat k="0.89"  l="avg faithfulness" trend="↑ 0.04"/>
          <Stat k="420ms" l="p50 latency"   trend="stable"/>
        </div>
      </div>

      <div className="prof-body">
        <div className="tabs">
          {[
            {id:"history",   label:"History",        icon: <I.Clock size={14}/>, n: 128},
            {id:"bookmarks", label:"Saved answers",  icon: <I.Bookmark size={14}/>, n: 26},
            {id:"settings",  label:"Settings",       icon: <I.Settings size={14}/>},
          ].map(t => (
            <button key={t.id} className={"tab " + (tab===t.id?"on":"")} onClick={() => setTab(t.id)}>
              {t.icon}<span>{t.label}</span>
              {t.n !== undefined && <span className="tab-n mono">{t.n}</span>}
            </button>
          ))}
        </div>

        {tab === "history" && <HistoryTimeline go={go}/>}
        {tab === "bookmarks" && <Bookmarks/>}
        {tab === "settings" && <Settings/>}
      </div>

      <Footer go={go}/>

      <style>{`
        .profile { position: relative; }
        .prof-hero {
          position: relative;
          max-width: 1280px; margin: 0 auto;
          padding: 48px 32px 32px;
        }
        .prof-bg {
          position: absolute; inset: 0;
          background:
            radial-gradient(400px 220px at 15% 30%, var(--accent-soft), transparent 65%);
          pointer-events: none;
        }
        .prof-hero-inner {
          position: relative;
          display:flex; gap: 24px; align-items: center;
          padding-bottom: 32px;
          border-bottom: 1px dashed var(--line);
          flex-wrap: wrap;
        }
        .prof-avatar-wrap { position: relative; width: 80px; height: 80px; }
        .prof-avatar {
          width: 80px; height: 80px; border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: #0a0a0f;
          display:grid; place-items:center;
          font-family: var(--font-display); font-weight: 600; font-size: 34px;
          letter-spacing: -0.02em;
          box-shadow: 0 0 50px var(--accent-glow);
        }
        .prof-avatar-ring {
          position: absolute; inset: -8px;
          border-radius: 50%;
          border: 1px solid var(--accent);
          opacity: 0.3;
          animation: ring 3s ease-out infinite;
        }
        @keyframes ring { 0% { transform: scale(0.95); opacity: 0.4; } 100% { transform: scale(1.15); opacity: 0; } }
        .prof-name {
          font-family: var(--font-display); font-weight: 500;
          font-size: 36px; letter-spacing: -0.02em;
          margin: 8px 0 6px;
        }
        .serif-it { font-family: var(--font-serif); font-style: italic; font-weight: 400; }

        .prof-stats {
          position: relative;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 0;
          margin-top: 24px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: var(--surface);
          overflow: hidden;
        }
        .prof-body {
          max-width: 1280px;
          margin: 0 auto;
          padding: 32px;
        }
        .tabs {
          display:inline-flex; gap: 4px;
          padding: 4px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 10px;
          margin-bottom: 24px;
        }
        .tab {
          display:inline-flex; align-items: center; gap: 8px;
          padding: 8px 14px;
          border-radius: 7px;
          font-size: 13.5px;
          color: var(--ink-3);
          transition: color .15s, background .15s;
        }
        .tab:hover { color: var(--ink); }
        .tab.on { background: var(--surface-3); color: var(--ink); }
        .tab-n {
          font-size: 11px;
          padding: 1px 6px;
          background: var(--bg);
          border-radius: 999px;
          color: var(--ink-3);
        }
        .tab.on .tab-n { background: var(--accent-soft); color: var(--accent); }

        @media (max-width: 880px) {
          .prof-stats { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}

function Stat({ k, l, trend }) {
  return (
    <div className="stat">
      <div className="stat-k">{k}</div>
      <div className="stat-l mono">{l}</div>
      <div className="stat-t mono">{trend}</div>
      <style>{`
        .stat { padding: 20px; border-right: 1px solid var(--line); position: relative; }
        .stat:last-child { border-right: 0; }
        .stat-k { font-family: var(--font-display); font-weight: 500; font-size: 28px; letter-spacing: -0.02em; color: var(--ink); }
        .stat-l { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3); margin-top: 4px; }
        .stat-t { font-size: 11px; color: var(--accent); margin-top: 10px; }
        @media (max-width: 880px) {
          .stat { border-right: 0 !important; border-bottom: 1px solid var(--line); }
        }
      `}</style>
    </div>
  );
}

const TIMELINE = [
  { day: "Today",     entries: [
    { time: "11:04", title: "RAG eval numbers for Q2", snippet: "Faithfulness jumped from 0.71 to 0.84 after introducing the reranker…", n: 4, conf: 0.88 },
    { time: "09:22", title: "How does our reranker work?", snippet: "We use a BGE cross-encoder on the top-k from hybrid search…", n: 3, conf: 0.91 },
    { time: "08:45", title: "Standup summary: indexing job failures", snippet: "Two tenants hit rate limits on the embedder. Retries handled it…", n: 2, conf: 0.82 },
  ]},
  { day: "Yesterday", entries: [
    { time: "17:31", title: "pgvector bloat incident post-mortem", snippet: "Root cause: missing REINDEX on chunks_hnsw after a mass update…", n: 5, conf: 0.94 },
    { time: "14:10", title: "What does RFC-0042 propose?", snippet: "Move to a grounded assistant layer with mandatory citations…", n: 2, conf: 0.89 },
  ]},
  { day: "This week", entries: [
    { time: "Mon",   title: "Onboarding flow for new tenants", snippet: "Current flow has 6 steps. We can collapse to 4 by…", n: 3, conf: 0.78 },
    { time: "Mon",   title: "Diff the chunker strategies",   snippet: "Semantic chunker wins on precision; fixed-window is faster…", n: 4, conf: 0.85 },
    { time: "Sun",   title: "Why is p99 climbing?",           snippet: "Correlates with a partition rebalance at 02:14 UTC…", n: 3, conf: 0.81 },
  ]},
];

function HistoryTimeline({ go }) {
  return (
    <div className="timeline">
      <div className="tl-head">
        <div>
          <h2 className="tl-h2">Chat history</h2>
          <p className="muted" style={{marginTop:4}}>Your last 128 conversations — searchable, pinnable, exportable.</p>
        </div>
        <div className="tl-controls">
          <div className="side-search" style={{flex:1, maxWidth:300, background:"var(--surface)", border:"1px solid var(--line-2)"}}>
            <I.Search size={13}/>
            <input placeholder="Search all conversations"/>
          </div>
          <button className="btn">Filters</button>
          <button className="btn">Export</button>
        </div>
      </div>

      <div className="tl">
        {TIMELINE.map(day => (
          <div key={day.day} className="tl-day">
            <div className="tl-day-label">
              <div className="tl-dot"/>
              <div className="mono tl-day-text">{day.day}</div>
            </div>
            <div className="tl-entries">
              {day.entries.map((e, i) => (
                <button key={i} className="tl-entry" onClick={() => go("chat")}>
                  <div className="tl-entry-time mono">{e.time}</div>
                  <div className="tl-entry-main">
                    <div className="tl-entry-title">{e.title}</div>
                    <div className="tl-entry-snippet">{e.snippet}</div>
                  </div>
                  <div className="tl-entry-meta">
                    <span className="tl-pill mono"><I.Cite size={10}/> {e.n}</span>
                    <ConfidenceMeter value={e.conf}/>
                  </div>
                  <I.Chevron size={14} style={{color:"var(--ink-3)"}}/>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .tl-head { display:flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; margin-bottom: 32px; }
        .tl-h2 { font-family: var(--font-display); font-weight: 500; font-size: 28px; letter-spacing: -0.02em; margin: 0; }
        .tl-controls { display:flex; gap: 8px; align-items:center; }
        .side-search {
          display:flex; align-items:center; gap:8px;
          padding: 8px 10px;
          border-radius: 8px;
        }
        .side-search input { flex:1; background: transparent; border: 0; outline: none; font-size: 13px; color: var(--ink); }
        .side-search input::placeholder { color: var(--ink-4); }
        .side-search svg { color: var(--ink-3); }

        .tl { position: relative; }
        .tl::before {
          content:""; position: absolute; left: 7px; top: 10px; bottom: 10px;
          width: 1px; background: var(--line);
        }
        .tl-day { margin-bottom: 32px; position: relative; }
        .tl-day-label { display:flex; align-items:center; gap: 10px; margin-bottom: 12px; position: relative; }
        .tl-dot {
          width: 14px; height: 14px; border-radius: 50%;
          background: var(--bg); border: 2px solid var(--accent);
          box-shadow: 0 0 20px var(--accent-glow);
          z-index: 1;
        }
        .tl-day-text { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-2); }
        .tl-entries { display:flex; flex-direction: column; gap: 8px; margin-left: 28px; }
        .tl-entry {
          display: grid;
          grid-template-columns: 64px 1fr auto auto;
          align-items: center;
          gap: 16px;
          padding: 14px 16px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 10px;
          text-align: left;
          transition: border-color .15s, background .15s, transform .15s;
        }
        .tl-entry:hover { border-color: var(--accent); background: var(--surface-2); transform: translateX(3px); }
        .tl-entry-time { font-size: 11px; color: var(--ink-3); letter-spacing: 0.05em; }
        .tl-entry-title { font-weight: 500; font-size: 15px; color: var(--ink); letter-spacing: -0.005em; margin-bottom: 3px; }
        .tl-entry-snippet { font-size: 13px; color: var(--ink-2); line-height: 1.45; max-width: 620px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tl-entry-meta { display:flex; gap: 12px; align-items:center; }
        .tl-pill {
          display:inline-flex; align-items:center; gap: 4px;
          padding: 3px 7px;
          font-size: 10.5px;
          color: var(--accent);
          background: var(--accent-soft);
          border-radius: 999px;
        }

        @media (max-width: 820px) {
          .tl-entry { grid-template-columns: 1fr; }
          .tl-entry-snippet { white-space: normal; }
        }
      `}</style>
    </div>
  );
}

const BOOKMARKS = [
  { title: "Why we chose pgvector over Pinecone",  tags:["architecture","infra"],    saved:"Mar 22",  snippet: "Self-host requirement, existing Postgres ops muscle, and HNSW support closed the gap…" },
  { title: "Reranker latency budget breakdown",    tags:["performance","reranker"],  saved:"Mar 18",  snippet: "p50: 38ms dense, 18ms BM25, 44ms rerank, 12ms merge. Total: 112ms before LLM…" },
  { title: "What a good chunk looks like",          tags:["ingestion","chunking"],   saved:"Mar 11",  snippet: "512 tokens semantic, 64 overlap, carry heading metadata. Avoid splitting code blocks…" },
  { title: "RFC-0042 summary in plain English",     tags:["rfc","grounding"],        saved:"Mar 3",  snippet: "Every answer must resolve to at least one retrieved chunk. Low-confidence answers get a visible warning…" },
];

function Bookmarks() {
  return (
    <div>
      <div className="tl-head">
        <div>
          <h2 className="tl-h2">Saved answers</h2>
          <p className="muted" style={{marginTop:4}}>Pinned answers and moments. Re-openable, shareable, exportable as a knowledge pack.</p>
        </div>
        <button className="btn"><I.Plus size={14}/> New collection</button>
      </div>
      <div className="bm-grid">
        {BOOKMARKS.map((b, i) => (
          <div key={i} className="bm">
            <div className="bm-head">
              <I.Bookmark size={14} style={{color:"var(--accent)"}}/>
              <div className="mono" style={{fontSize:10, letterSpacing:"0.08em", color:"var(--ink-3)", textTransform:"uppercase"}}>Saved {b.saved}</div>
            </div>
            <h4 className="bm-title">{b.title}</h4>
            <p className="bm-snippet">{b.snippet}</p>
            <div className="bm-tags">
              {b.tags.map(t => <span key={t} className="bm-tag mono">#{t}</span>)}
            </div>
          </div>
        ))}
      </div>
      <style>{`
        .bm-grid { display:grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
        .bm {
          padding: 20px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 14px;
          display:flex; flex-direction: column; gap: 10px;
          position: relative;
          transition: border-color .15s, transform .15s;
        }
        .bm:hover { border-color: var(--accent); transform: translateY(-2px); }
        .bm-head { display:flex; align-items:center; gap: 8px; }
        .bm-title { font-family: var(--font-display); font-weight: 500; font-size: 18px; margin: 0; letter-spacing: -0.01em; }
        .bm-snippet { font-size: 13.5px; line-height: 1.55; color: var(--ink-2); margin: 0; text-wrap: pretty; }
        .bm-tags { display:flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
        .bm-tag { font-size: 10.5px; color: var(--ink-3); padding: 2px 8px; background: var(--bg); border: 1px solid var(--line); border-radius: 999px; }
        @media (max-width: 820px) { .bm-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

function Settings() {
  const [model, setModel] = React.useState("claude-4.5-sonnet");
  const [embed, setEmbed] = React.useState("e5-mistral-7b");
  const [cite, setCite] = React.useState(true);
  const [groundOnly, setGroundOnly] = React.useState(true);
  return (
    <div className="settings">
      <h2 className="tl-h2">Settings</h2>
      <p className="muted" style={{marginTop:4, marginBottom: 28}}>Personal preferences. Workspace-level settings live under the team admin panel.</p>

      <div className="set-group">
        <div className="set-head">
          <h3>Identity</h3>
          <p className="muted">How you appear across shared conversations.</p>
        </div>
        <div className="set-body">
          <div className="set-row">
            <label>Display name</label>
            <input defaultValue="Casey Ng"/>
          </div>
          <div className="set-row">
            <label>Email</label>
            <input defaultValue="casey@northwind.dev"/>
          </div>
          <div className="set-row">
            <label>Workspace</label>
            <input defaultValue="northwind" disabled/>
          </div>
        </div>
      </div>

      <div className="set-group">
        <div className="set-head">
          <h3>Retrieval & generation</h3>
          <p className="muted">How Wizardocs answers your questions. Defaults are sensible — tweak if you know what you're doing.</p>
        </div>
        <div className="set-body">
          <div className="set-row">
            <label>Generator model</label>
            <select value={model} onChange={(e)=>setModel(e.target.value)}>
              <option>claude-4.5-sonnet</option>
              <option>gpt-4o</option>
              <option>llama-3.1-70b</option>
              <option>local · qwen-2.5-coder</option>
            </select>
          </div>
          <div className="set-row">
            <label>Embedder</label>
            <select value={embed} onChange={(e)=>setEmbed(e.target.value)}>
              <option>e5-mistral-7b</option>
              <option>bge-large-en</option>
              <option>openai · text-embedding-3-large</option>
            </select>
          </div>
          <div className="set-row toggle">
            <div>
              <label>Show inline citations</label>
              <div className="muted">[1][2] pills that preview the source chunk on hover.</div>
            </div>
            <Toggle on={cite} onChange={setCite}/>
          </div>
          <div className="set-row toggle">
            <div>
              <label>Strict grounding mode</label>
              <div className="muted">Refuse to answer if retrieval comes up empty. Recommended for production use.</div>
            </div>
            <Toggle on={groundOnly} onChange={setGroundOnly}/>
          </div>
        </div>
      </div>

      <div className="set-group danger">
        <div className="set-head">
          <h3>Danger zone</h3>
          <p className="muted">Destructive operations that can't be undone.</p>
        </div>
        <div className="set-body">
          <div className="set-row" style={{gridTemplateColumns:"1fr auto"}}>
            <div>
              <label>Clear all chat history</label>
              <div className="muted">Removes 128 conversations and all saved answers.</div>
            </div>
            <button className="btn danger-btn">Clear history</button>
          </div>
          <div className="set-row" style={{gridTemplateColumns:"1fr auto"}}>
            <div>
              <label>Delete account</label>
              <div className="muted">Permanently removes your personal data from Wizardocs.</div>
            </div>
            <button className="btn danger-btn">Delete account</button>
          </div>
        </div>
      </div>

      <style>{`
        .settings { max-width: 820px; }
        .set-group {
          border: 1px solid var(--line);
          background: var(--surface);
          border-radius: 14px;
          overflow: hidden;
          margin-bottom: 20px;
        }
        .set-group.danger { border-color: color-mix(in oklab, var(--danger) 30%, var(--line)); }
        .set-head {
          padding: 18px 20px;
          border-bottom: 1px solid var(--line);
          background: var(--bg-2);
        }
        .set-head h3 { font-family: var(--font-display); font-weight: 500; font-size: 17px; margin: 0 0 2px; letter-spacing: -0.01em; }
        .set-body { padding: 6px 20px 16px; }
        .set-row {
          display:grid; grid-template-columns: 200px 1fr;
          gap: 20px; align-items: center;
          padding: 14px 0; border-bottom: 1px dashed var(--line);
        }
        .set-row:last-child { border-bottom: 0; }
        .set-row.toggle { grid-template-columns: 1fr auto; }
        .set-row label { font-size: 13.5px; color: var(--ink); font-weight: 500; display: block; }
        .set-row .muted { font-size: 12.5px; margin-top: 2px; }
        .set-row input, .set-row select {
          width: 100%;
          padding: 9px 12px;
          border: 1px solid var(--line-2);
          border-radius: 8px;
          background: var(--bg);
          color: var(--ink);
          font-size: 13.5px;
          font-family: var(--font-sans);
        }
        .set-row input:focus, .set-row select:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-soft);
        }
        .set-row input:disabled { color: var(--ink-3); cursor: not-allowed; }
        .danger-btn { color: var(--danger); border-color: color-mix(in oklab, var(--danger) 40%, var(--line)); }
        .danger-btn:hover { background: color-mix(in oklab, var(--danger) 10%, var(--surface)); border-color: var(--danger); }
      `}</style>
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button className={"toggle " + (on ? "on" : "")} onClick={() => onChange(!on)}>
      <span className="knob"/>
      <style>{`
        .toggle {
          width: 40px; height: 22px; border-radius: 999px;
          background: var(--surface-3); border: 1px solid var(--line-2);
          position: relative;
          transition: background .2s, border-color .2s;
          flex-shrink: 0;
        }
        .toggle.on { background: var(--accent); border-color: var(--accent); }
        .knob {
          position: absolute; top: 2px; left: 2px;
          width: 16px; height: 16px; border-radius: 50%;
          background: var(--ink);
          transition: transform .2s, background .2s;
        }
        .toggle.on .knob { transform: translateX(18px); background: #0a0a0f; }
      `}</style>
    </button>
  );
}

window.Profile = Profile;
