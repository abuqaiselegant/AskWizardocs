// Top-level app: route state + tweaks bridge

function App() {
  const [page, setPage] = React.useState(() => localStorage.getItem("wd-page") || "landing");
  const [tweaks, setTweaksState] = React.useState(() => {
    try {
      const saved = localStorage.getItem("wd-tweaks");
      return saved ? JSON.parse(saved) : window.TWEAKS;
    } catch { return window.TWEAKS; }
  });
  const [tweaksOpen, setTweaksOpen] = React.useState(false);

  React.useEffect(() => {
    localStorage.setItem("wd-page", page);
    window.scrollTo(0, 0);
  }, [page]);

  React.useEffect(() => {
    document.body.dataset.theme = tweaks.theme;
    document.body.dataset.accent = tweaks.accent;
    document.body.dataset.motion = tweaks.motion;
    localStorage.setItem("wd-tweaks", JSON.stringify(tweaks));
  }, [tweaks]);

  const setTweaks = (patch) => {
    setTweaksState(t => {
      const next = { ...t, ...patch };
      try { window.parent.postMessage({ type: "__edit_mode_set_keys", edits: patch }, "*"); } catch(e) {}
      return next;
    });
  };

  // Edit mode handshake — register listener FIRST, then announce
  React.useEffect(() => {
    const onMsg = (ev) => {
      const d = ev.data || {};
      if (d.type === "__activate_edit_mode")   setTweaksOpen(true);
      if (d.type === "__deactivate_edit_mode") setTweaksOpen(false);
    };
    window.addEventListener("message", onMsg);
    try { window.parent.postMessage({ type: "__edit_mode_available" }, "*"); } catch(e) {}
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const go = (p) => setPage(p);

  // Page tag for comment scoping
  const label = {
    landing: "01 Landing",
    signin:  "02 Sign in",
    signup:  "03 Sign up",
    chat:    "04 Chat",
    profile: "05 Profile"
  }[page];

  return (
    <div data-screen-label={label}>
      {page === "landing" && <Landing go={go} tweaks={tweaks}/>}
      {page === "signin"  && <AuthShell mode="signin"  go={go}/>}
      {page === "signup"  && <AuthShell mode="signup"  go={go}/>}
      {page === "chat"    && <Chat     go={go} tweaks={tweaks}/>}
      {page === "profile" && <Profile  go={go} tweaks={tweaks}/>}

      {/* Persistent route switcher + appearance toggle */}
      <RouteChip page={page} go={go} onTweaks={() => setTweaksOpen(o => !o)}/>

      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)} tweaks={tweaks} setTweaks={setTweaks}/>
    </div>
  );
}

function RouteChip({ page, go, onTweaks }) {
  const [open, setOpen] = React.useState(false);
  const routes = [
    { id: "landing", label: "Landing" },
    { id: "signin",  label: "Sign in" },
    { id: "signup",  label: "Sign up" },
    { id: "chat",    label: "Chat" },
    { id: "profile", label: "Profile" },
  ];
  return (
    <div className="routechip">
      <div className="rc-row">
        <button className="rc-main" onClick={() => setOpen(o => !o)}>
          <I.Layers size={13}/>
          <span className="mono">{routes.find(r => r.id === page)?.label || page}</span>
          <I.Chevron size={12} style={{transform: open?"rotate(90deg)":"rotate(-90deg)", transition:"transform .2s"}}/>
        </button>
        <button className="rc-tweaks" onClick={onTweaks} title="Appearance">
          <I.Settings size={13}/>
        </button>
      </div>
      {open && (
        <div className="rc-menu">
          {routes.map(r => (
            <button key={r.id} className={"rc-item " + (r.id===page?"on":"")} onClick={() => { go(r.id); setOpen(false); }}>
              <span className="rc-dot"/>
              <span>{r.label}</span>
            </button>
          ))}
        </div>
      )}
      <style>{`
        .routechip {
          position: fixed; left: 20px; bottom: 20px;
          z-index: 150;
          font-family: var(--font-mono);
        }
        .rc-row { display: flex; align-items: center; gap: 6px; }
        .rc-main {
          display:flex; align-items:center; gap: 8px;
          padding: 8px 12px;
          background: var(--surface);
          border: 1px solid var(--line-2);
          border-radius: 999px;
          font-size: 11px;
          letter-spacing: 0.05em;
          color: var(--ink-2);
          box-shadow: 0 10px 30px rgba(0,0,0,0.4);
          transition: border-color .15s, color .15s;
        }
        .rc-main:hover { border-color: var(--accent); color: var(--ink); }
        .rc-tweaks {
          display: grid; place-items: center;
          width: 34px; height: 34px;
          background: var(--surface);
          border: 1px solid var(--line-2);
          border-radius: 50%;
          color: var(--ink-3);
          box-shadow: 0 10px 30px rgba(0,0,0,0.4);
          transition: border-color .15s, color .15s;
        }
        .rc-tweaks:hover { border-color: var(--accent); color: var(--accent); }
        .rc-menu {
          position: absolute; bottom: calc(100% + 8px); left: 0;
          background: var(--surface);
          border: 1px solid var(--line-2);
          border-radius: 10px;
          padding: 4px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          display:flex; flex-direction: column; gap: 2px;
          min-width: 160px;
          animation: pageIn .15s ease both;
        }
        .rc-item {
          display:flex; align-items:center; gap: 10px;
          padding: 7px 10px;
          font-size: 12px;
          border-radius: 6px;
          color: var(--ink-2);
          text-align: left;
          transition: background .15s, color .15s;
        }
        .rc-item:hover { background: var(--surface-2); color: var(--ink); }
        .rc-item.on { background: var(--accent-soft); color: var(--accent); }
        .rc-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
      `}</style>
    </div>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App/>);

// Hide splash
setTimeout(() => {
  const s = document.getElementById("splash");
  if (s) { s.classList.add("hide"); setTimeout(() => s.remove(), 500); }
}, 400);
