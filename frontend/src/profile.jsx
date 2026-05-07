// Profile page — real data wired to /profile and /chats endpoints

const _authHdr = async () => {
  const { data: { session } } = await window._supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
};

function groupByDate(chats) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today - 86400000);
  const weekAgo   = new Date(today - 6 * 86400000);
  const groups = [
    { label: "Today",     items: [] },
    { label: "Yesterday", items: [] },
    { label: "This week", items: [] },
    { label: "Older",     items: [] },
  ];
  for (const chat of chats) {
    const d = new Date(chat.created_at); d.setHours(0, 0, 0, 0);
    if (d >= today)          groups[0].items.push(chat);
    else if (d >= yesterday) groups[1].items.push(chat);
    else if (d >= weekAgo)   groups[2].items.push(chat);
    else                     groups[3].items.push(chat);
  }
  return groups.filter(g => g.items.length > 0);
}

function fmtChatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Profile({ go, theme, toggleTheme, user }) {
  const [tab, setTab]       = React.useState("history");
  const [profile, setProfile] = React.useState({ plan: "free", chunks_indexed: 0 });
  const [chats, setChats]   = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const name    = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "You";
  const initial = name[0].toUpperCase();
  const email   = user?.email || "";
  const joined  = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    : "";

  React.useEffect(() => {
    (async () => {
      const h = await _authHdr();
      const [pr, cr] = await Promise.all([
        fetch(`${window.API_BASE}/profile`, { headers: h }),
        fetch(`${window.API_BASE}/chats`,   { headers: h }),
      ]);
      if (pr.ok) setProfile(await pr.json());
      if (cr.ok) setChats(await cr.json());
      setLoading(false);
    })();
  }, []);

  const handleClearHistory = async () => {
    if (!window.confirm("Clear all chat history? This cannot be undone.")) return;
    const h = await _authHdr();
    await fetch(`${window.API_BASE}/chats`, { method: "DELETE", headers: h });
    setChats([]);
  };

  return (
    <div className="profile page-enter">
      <Nav go={go} theme={theme} toggleTheme={toggleTheme} user={user}/>

      <div className="prof-hero">
        <div className="prof-bg"/>
        <div className="prof-hero-inner">
          <div className="prof-avatar-wrap">
            <div className="prof-avatar">{initial}</div>
            <div className="prof-avatar-ring"/>
          </div>
          <div>
            <div className="mono" style={{fontSize:11, letterSpacing:"0.08em", color:"var(--ink-3)", textTransform:"uppercase"}}>
              <span style={{color:"var(--good)"}}>●</span> online · {email}
            </div>
            <h1 className="prof-name">{name}</h1>
            <p className="muted" style={{maxWidth:560}}>
              {joined ? `Joined ${joined}.` : ""} Signed in with Google.
            </p>
          </div>
          <div style={{flex:1}}/>
        </div>

        <div className="prof-stats" style={{gridTemplateColumns:"repeat(3, 1fr)"}}>
          <Stat k={loading ? "—" : chats.length} l="chats" trend="conversation history"/>
          <Stat k={loading ? "—" : (profile.chunks_indexed || 0).toLocaleString()} l="your docs" trend="Upload coming soon (Pro)"/>
          <Stat k={profile.plan || "free"} l="plan" trend={profile.plan === "pro" ? "Pro · all features" : "Free tier"}/>
        </div>
      </div>

      <div className="prof-body">
        <div className="tabs">
          {[
            {id:"history",   label:"History",       icon: <I.Clock size={14}/>,    n: chats.length},
            {id:"bookmarks", label:"Saved answers",  icon: <I.Bookmark size={14}/>, n: 0},
            {id:"settings",  label:"Settings",       icon: <I.Settings size={14}/>},
          ].map(t => (
            <button key={t.id} className={"tab " + (tab===t.id?"on":"")} onClick={() => setTab(t.id)}>
              {t.icon}<span>{t.label}</span>
              {t.n !== undefined && <span className="tab-n mono">{t.n}</span>}
            </button>
          ))}
        </div>

        {tab === "history"   && <HistoryTimeline chats={chats} go={go} loading={loading}/>}
        {tab === "bookmarks" && <Bookmarks/>}
        {tab === "settings"  && <Settings user={user} profile={profile} go={go} onClearHistory={handleClearHistory}/>}
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

        .prof-stats {
          position: relative;
          display: grid;
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
          .prof-stats { grid-template-columns: 1fr !important; }
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
        .stat-k { font-family: var(--font-display); font-weight: 500; font-size: 28px; letter-spacing: -0.02em; color: var(--ink); text-transform: capitalize; }
        .stat-l { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3); margin-top: 4px; }
        .stat-t { font-size: 11px; color: var(--accent); margin-top: 10px; }
        @media (max-width: 880px) {
          .stat { border-right: 0 !important; border-bottom: 1px solid var(--line); }
          .stat:last-child { border-bottom: 0; }
        }
      `}</style>
    </div>
  );
}

function HistoryTimeline({ chats, go, loading }) {
  if (loading) {
    return <div className="muted mono" style={{padding:"40px 0", fontSize:13}}>Loading…</div>;
  }
  if (chats.length === 0) {
    return (
      <div style={{padding:"60px 0", textAlign:"center"}}>
        <div style={{fontSize:32, color:"var(--ink-4)", marginBottom:12}}>💬</div>
        <p className="muted">No chats yet. Start a conversation to see your history here.</p>
        <button className="btn" style={{marginTop:16}} onClick={() => go("chat")}>Start chatting</button>
      </div>
    );
  }

  const groups = groupByDate(chats);

  return (
    <div className="timeline">
      <div className="tl-head">
        <div>
          <h2 className="tl-h2">Chat history</h2>
          <p className="muted" style={{marginTop:4}}>
            Your last {chats.length} conversation{chats.length !== 1 ? "s" : ""}.
            {chats.length >= 2 && " Full messages kept for the 2 most recent."}
          </p>
        </div>
      </div>

      <div className="tl">
        {groups.map(group => (
          <div key={group.label} className="tl-day">
            <div className="tl-day-label">
              <div className="tl-dot"/>
              <div className="mono tl-day-text">{group.label}</div>
            </div>
            <div className="tl-entries">
              {group.items.map(chat => {
                const pos = chats.indexOf(chat);
                const hasMessages = pos < 2;
                return (
                  <button key={chat.id} className="tl-entry" onClick={() => {
                    if (hasMessages) localStorage.setItem("wd-open-chat", chat.id);
                    go("chat");
                  }}>
                    <div className="tl-entry-time mono">{fmtChatTime(chat.created_at)}</div>
                    <div className="tl-entry-main">
                      <div className="tl-entry-title">{chat.title}</div>
                      {!hasMessages && (
                        <div className="tl-entry-snippet">Title only · messages not stored</div>
                      )}
                    </div>
                    <I.Chevron size={14} style={{color:"var(--ink-3)"}}/>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .tl-head { display:flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; margin-bottom: 32px; }
        .tl-h2 { font-family: var(--font-display); font-weight: 500; font-size: 28px; letter-spacing: -0.02em; margin: 0; }

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
          grid-template-columns: 64px 1fr auto;
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
        .tl-entry-snippet { font-size: 12px; color: var(--ink-4); font-family: var(--font-mono); }

        @media (max-width: 820px) {
          .tl-entry { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

function Bookmarks() {
  return (
    <div style={{padding:"60px 0", textAlign:"center"}}>
      <div style={{fontSize:32, color:"var(--ink-4)", marginBottom:12}}>🔖</div>
      <h3 style={{fontFamily:"var(--font-display)", fontWeight:500, fontSize:20, margin:"0 0 8px", letterSpacing:"-0.01em"}}>No saved answers yet</h3>
      <p className="muted">Use the Save button on any answer in chat to bookmark it here.</p>
    </div>
  );
}

function Settings({ user, profile, go, onClearHistory }) {
  const name  = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "";
  const email = user?.email || "";
  const plan  = profile?.plan || "free";

  const signOut = async () => {
    await window._supabase.auth.signOut();
  };

  return (
    <div className="settings">
      <h2 className="tl-h2">Settings</h2>
      <p className="muted" style={{marginTop:4, marginBottom: 28}}>Account details and preferences.</p>

      <div className="set-group">
        <div className="set-head">
          <h3>Identity</h3>
          <p className="muted">Your account. Managed via Google OAuth — edit your name through your Google account.</p>
        </div>
        <div className="set-body">
          <div className="set-row">
            <label>Display name</label>
            <input value={name} disabled/>
          </div>
          <div className="set-row">
            <label>Email</label>
            <input value={email} disabled/>
          </div>
          <div className="set-row">
            <label>Plan</label>
            <div style={{display:"flex", alignItems:"center", gap:12}}>
              <span className="plan-badge">{plan === "pro" ? "Pro" : "Free"}</span>
              {plan !== "pro" && (
                <button className="btn" onClick={() => go("landing")}>
                  Upgrade for bookmarks, own docs &amp; unlimited queries →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="set-group danger">
        <div className="set-head">
          <h3>Account actions</h3>
          <p className="muted">Sign out or clear your data.</p>
        </div>
        <div className="set-body">
          <div className="set-row" style={{gridTemplateColumns:"1fr auto"}}>
            <div>
              <label>Sign out</label>
              <div className="muted">Sign out of your Wizardocs account on this device.</div>
            </div>
            <button className="btn" onClick={signOut}>Sign out</button>
          </div>
          <div className="set-row" style={{gridTemplateColumns:"1fr auto"}}>
            <div>
              <label>Clear chat history</label>
              <div className="muted">Permanently removes all your conversations. Cannot be undone.</div>
            </div>
            <button className="btn danger-btn" onClick={onClearHistory}>Clear history</button>
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
        .set-row label { font-size: 13.5px; color: var(--ink); font-weight: 500; display: block; }
        .set-row .muted { font-size: 12.5px; margin-top: 2px; }
        .set-row input {
          width: 100%;
          padding: 9px 12px;
          border: 1px solid var(--line-2);
          border-radius: 8px;
          background: var(--bg);
          color: var(--ink-3);
          font-size: 13.5px;
          font-family: var(--font-sans);
          cursor: not-allowed;
        }
        .plan-badge {
          display: inline-block;
          padding: 4px 10px;
          background: var(--accent-soft);
          color: var(--accent);
          border-radius: 999px;
          font-size: 12px;
          font-family: var(--font-mono);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .danger-btn { color: var(--danger); border-color: color-mix(in oklab, var(--danger) 40%, var(--line)); }
        .danger-btn:hover { background: color-mix(in oklab, var(--danger) 10%, var(--surface)); border-color: var(--danger); }
      `}</style>
    </div>
  );
}

window.Profile = Profile;
