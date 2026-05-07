// Auth page — Google + GitHub OAuth only

function AuthShell({ go }) {
  return (
    <div className="auth page-enter">
      <div className="auth-left">
        <button className="auth-logo" onClick={() => go("landing")}>
          <I.Logo size={22} style={{color:"var(--accent)"}}/>
          <span>Wizardocs<span style={{color:"var(--accent)"}}>.</span></span>
        </button>

        <div className="auth-form-wrap">
          <OAuthPanel go={go}/>
        </div>

        <div className="auth-foot mono">
          <span>© 2026 Wizardocs Labs</span>
          <a href="#" onClick={(e)=>{e.preventDefault(); go("landing");}}>← back to site</a>
        </div>
      </div>

      <div className="auth-right">
        <AuthShelfArt/>
      </div>

      <style>{`
        .auth {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1.1fr;
        }
        .auth-left {
          padding: 32px 48px;
          display:flex; flex-direction: column; justify-content: space-between;
        }
        .auth-logo {
          display:inline-flex; align-items:center; gap:10px;
          font-family: var(--font-display); font-weight: 600; font-size: 16px;
        }
        .auth-form-wrap { max-width: 380px; width: 100%; align-self: center; }
        .auth-foot { display:flex; justify-content: space-between; color: var(--ink-3); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
        .auth-foot a { color: var(--ink-2); }
        .auth-foot a:hover { color: var(--ink); }
        .auth-right {
          position: relative; overflow: hidden;
          background:
            radial-gradient(500px 300px at 70% 30%, var(--accent-soft), transparent 65%),
            linear-gradient(180deg, var(--bg-2), var(--bg));
          border-left: 1px solid var(--line);
        }
        @media (max-width: 880px) {
          .auth { grid-template-columns: 1fr; }
          .auth-right { display: none; }
        }
      `}</style>
    </div>
  );
}

function OAuthPanel({ go }) {
  const [loading, setLoading] = React.useState(null); // "google" | "github" | null
  const [error, setError]     = React.useState(null);

  const signIn = async (provider) => {
    setLoading(provider);
    setError(null);
    const { error } = await window._supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setError(error.message);
      setLoading(null);
    }
    // on success the browser redirects — no further action needed here
  };

  return (
    <div>
      <div className="chip" style={{marginBottom: 14}}>
        <span className="dot"/> 100 queries / month · no card
      </div>

      <h1 className="auth-h1">
        Sign in to <span className="serif-it">Wizardocs</span>.
      </h1>
      <p className="auth-sub">
        Your library is waiting — and it remembers where you left off.
      </p>

      <div className="oauth-btns">
        <button
          className="oauth-btn"
          onClick={() => signIn("google")}
          disabled={!!loading}
        >
          {loading === "google" ? <span className="spin-sm"/> : <I.Google size={18}/>}
          <span>Continue with Google</span>
        </button>

      </div>

      {error && (
        <p className="oauth-error mono">{error}</p>
      )}

      <p className="auth-note mono">
        By continuing, you agree to the fair-use policy.
        No password required.
      </p>

      <style>{`
        .auth-h1 { font-family: var(--font-display); font-weight: 500; font-size: 36px; letter-spacing:-0.02em; margin: 10px 0 8px; }
        .serif-it { font-family: var(--font-serif); font-style: italic; color: var(--accent); font-weight: 400; }
        .auth-sub { color: var(--ink-2); font-size: 14.5px; margin-bottom: 32px; line-height: 1.5; }

        .oauth-btns { display: flex; flex-direction: column; gap: 12px; }
        .oauth-btn {
          display: flex; align-items: center; justify-content: center; gap: 12px;
          width: 100%;
          padding: 14px 20px;
          border: 1px solid var(--line-2);
          border-radius: 12px;
          background: var(--surface);
          font-size: 15px; font-weight: 500;
          transition: border-color .15s, background .15s, transform .1s;
        }
        .oauth-btn:hover:not(:disabled) { border-color: var(--accent); background: var(--surface-2); transform: translateY(-1px); }
        .oauth-btn:active:not(:disabled) { transform: translateY(0); }
        .oauth-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .oauth-error {
          margin-top: 16px;
          padding: 10px 14px;
          background: color-mix(in oklab, var(--danger) 10%, var(--surface));
          border: 1px solid color-mix(in oklab, var(--danger) 40%, var(--line));
          border-radius: 8px;
          font-size: 12px; color: var(--danger);
        }
        .auth-note {
          margin-top: 24px;
          font-size: 11px; color: var(--ink-4);
          text-align: center; letter-spacing: 0.03em; line-height: 1.6;
        }
        .spin-sm {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.2);
          border-top-color: var(--ink);
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function AuthShelfArt() {
  const quotes = [
    { q: "What are the retention deltas after the tier migration?", a: "Based on the 2026 cohort analysis [1], D30 retention improved 14.2%…", s:"analytics-2026.md" },
    { q: "How do we handle pgvector index bloat?", a: "We run autovacuum with custom thresholds on the chunks table [2]…", s:"pg_ops.md" },
    { q: "Summarize the auth RFC.", a: "RFC-0042 proposes moving to OIDC with a shared session store [3]…", s:"rfc-0042.pdf" },
  ];
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setIdx(i => (i+1) % quotes.length), 4500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="authart">
      <div className="auth-shelf">
        {Array.from({length:14}).map((_, i) => (
          <div key={i} className="spine-book" style={{
            height: 80 + (i*13)%60,
            background: i % 3 === 0 ? "#2a1f5a" : "#1a1a26",
            borderColor: i % 3 === 0 ? "var(--accent)" : "var(--line-2)",
            animationDelay: `${i*0.08}s`
          }}/>
        ))}
      </div>
      <div className="auth-card" key={idx}>
        <div className="authcard-q mono">{quotes[idx].q}</div>
        <div className="authcard-a">
          {quotes[idx].a} <span className="cite">[{idx+1}]</span>
        </div>
        <div className="authcard-src mono">
          <I.File size={12}/> {quotes[idx].s}
        </div>
      </div>
      <div className="auth-tag mono">
        <span className="dot"/> a question. a citation. a source.
      </div>

      <style>{`
        .authart { position:absolute; inset: 0; display:grid; place-items:center; }
        .auth-shelf {
          position: absolute; inset: 0;
          display: flex; align-items:flex-end; justify-content: center;
          gap: 4px; padding: 48px; opacity: 0.6;
          mask-image: radial-gradient(ellipse at center, transparent 20%, black 60%);
        }
        .spine-book {
          width: 18px; border: 1px solid var(--line-2); border-radius: 2px 2px 0 0;
          animation: authbook 5s ease-in-out infinite;
        }
        @keyframes authbook { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        .auth-card {
          position: relative; z-index: 2;
          width: min(420px, 70%); padding: 20px;
          background: var(--surface); border: 1px solid var(--line-2);
          border-radius: 14px; box-shadow: 0 40px 120px -20px rgba(0,0,0,0.6);
          animation: cardIn .6s cubic-bezier(.2,.8,.2,1) both;
        }
        @keyframes cardIn { from {opacity:0; transform: translateY(10px)} to {opacity:1} }
        .authcard-q { font-size: 12px; color: var(--ink-3); margin-bottom: 10px; }
        .authcard-q::before { content: "›  "; color: var(--accent); }
        .authcard-a { font-size: 14.5px; line-height: 1.55; color: var(--ink); margin-bottom: 12px; }
        .cite {
          font-family: var(--font-mono); font-size: 12px;
          background: var(--accent-soft); color: var(--accent);
          padding: 1px 5px; border-radius: 4px; border: 1px solid var(--accent);
        }
        .authcard-src {
          display:inline-flex; align-items:center; gap: 6px;
          font-size: 11px; color: var(--ink-3);
          padding-top: 10px; border-top: 1px dashed var(--line);
        }
        .auth-tag {
          position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%);
          display:inline-flex; align-items:center; gap:8px;
          font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3);
        }
        .auth-tag .dot { width:6px; height:6px; border-radius:50%; background: var(--accent); box-shadow: 0 0 8px var(--accent); }
      `}</style>
    </div>
  );
}

window.AuthShell = AuthShell;
