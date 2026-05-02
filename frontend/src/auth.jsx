// Sign in / Sign up — shared split layout with animated book stack

function AuthShell({ mode, go }) {
  return (
    <div className="auth page-enter">
      <div className="auth-left">
        <button className="auth-logo" onClick={() => go("landing")}>
          <I.Logo size={22} style={{color:"var(--accent)"}}/>
          <span>Wizardocs<span style={{color:"var(--accent)"}}>.</span></span>
        </button>

        <div className="auth-form-wrap">
          {mode === "signin" ? <SignIn go={go}/> : <SignUp go={go}/>}
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
          position: relative;
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
          position: relative;
          overflow: hidden;
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
      {/* Orbiting doc spines */}
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
      {/* Floating reply card */}
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
          gap: 4px; padding: 48px;
          opacity: 0.6;
          mask-image: radial-gradient(ellipse at center, transparent 20%, black 60%);
        }
        .spine-book {
          width: 18px;
          border: 1px solid var(--line-2);
          border-radius: 2px 2px 0 0;
          animation: authbook 5s ease-in-out infinite;
        }
        @keyframes authbook {
          0%,100% { transform: translateY(0) }
          50% { transform: translateY(-8px) }
        }
        .auth-card {
          position: relative; z-index: 2;
          width: min(420px, 70%);
          padding: 20px;
          background: var(--surface);
          border: 1px solid var(--line-2);
          border-radius: 14px;
          box-shadow: 0 40px 120px -20px rgba(0,0,0,0.6);
          animation: cardIn .6s cubic-bezier(.2,.8,.2,1) both;
        }
        @keyframes cardIn { from {opacity:0; transform: translateY(10px)} to {opacity:1} }
        .authcard-q { font-size: 12px; color: var(--ink-3); margin-bottom: 10px; }
        .authcard-q::before { content: "›  "; color: var(--accent); }
        .authcard-a { font-size: 14.5px; line-height: 1.55; color: var(--ink); margin-bottom: 12px; }
        .cite {
          font-family: var(--font-mono);
          font-size: 12px;
          background: var(--accent-soft);
          color: var(--accent);
          padding: 1px 5px;
          border-radius: 4px;
          border: 1px solid var(--accent);
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

function Field({ label, type="text", value, onChange, hint, right }) {
  return (
    <label className="field">
      <div className="field-head">
        <span>{label}</span>
        {right}
      </div>
      <input type={type} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={hint}/>
      <style>{`
        .field { display: block; margin-bottom: 14px; }
        .field-head { display:flex; justify-content:space-between; align-items:center; font-size: 12px; color: var(--ink-2); margin-bottom: 6px; font-family: var(--font-mono); letter-spacing:0.02em; }
        .field-head a { color: var(--ink-3); font-size: 11px; }
        .field-head a:hover { color: var(--accent); }
        .field input {
          width: 100%;
          padding: 12px 14px;
          background: var(--surface);
          border: 1px solid var(--line-2);
          color: var(--ink);
          border-radius: 10px;
          font-size: 14.5px;
          transition: border-color .15s, box-shadow .15s;
        }
        .field input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 4px var(--accent-soft);
        }
        .field input::placeholder { color: var(--ink-4); }
      `}</style>
    </label>
  );
}

function SocialRow() {
  return (
    <div className="social-row">
      <button className="btn" style={{width:"100%", justifyContent:"center"}}><I.Google size={16}/> Google</button>
      <button className="btn" style={{width:"100%", justifyContent:"center"}}><I.Github size={16}/> GitHub</button>
      <style>{`
        .social-row { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
      `}</style>
    </div>
  );
}

function Divider({ label }) {
  return (
    <div className="divider">
      <span/><em className="mono">{label}</em><span/>
      <style>{`
        .divider { display:flex; align-items:center; gap: 10px; margin: 18px 0; }
        .divider span { flex:1; height:1px; background: var(--line); }
        .divider em { font-style: normal; font-size: 11px; color: var(--ink-3); letter-spacing: 0.1em; }
      `}</style>
    </div>
  );
}

function SignIn({ go }) {
  const [email, setEmail] = React.useState("casey@northwind.dev");
  const [pw, setPw] = React.useState("••••••••••");
  return (
    <div>
      <div className="chip" style={{marginBottom:14}}>
        <span className="dot"/> Welcome back
      </div>
      <h1 className="auth-h1">
        Sign in to <span className="serif-it">Wizardocs</span>.
      </h1>
      <p className="auth-sub">Your library is waiting — and it remembers where you left off.</p>

      <SocialRow/>
      <Divider label="or with email"/>
      <Field label="Email" value={email} onChange={setEmail} hint="you@company.com"/>
      <Field
        label="Password"
        type="password"
        value={pw}
        onChange={setPw}
        hint="••••••••"
        right={<a href="#">Forgot?</a>}
      />
      <label className="remember">
        <input type="checkbox" defaultChecked/>
        <span>Keep me signed in for 30 days</span>
      </label>
      <button className="btn primary" style={{width:"100%", justifyContent:"center", marginTop:18, padding:"14px"}}
              onClick={()=>go("chat")}>
        Sign in <I.Arrow size={14}/>
      </button>
      <p className="auth-foot-line mono">
        New here? <a href="#" onClick={(e)=>{e.preventDefault(); go("signup");}}>Create an account →</a>
      </p>

      <style>{`
        .auth-h1 { font-family: var(--font-display); font-weight: 500; font-size: 36px; letter-spacing:-0.02em; margin: 10px 0 8px; }
        .serif-it { font-family: var(--font-serif); font-style: italic; color: var(--accent); font-weight: 400; }
        .auth-sub { color: var(--ink-2); font-size: 14.5px; margin-bottom: 28px; }
        .remember { display:flex; align-items:center; gap:10px; color: var(--ink-2); font-size: 13px; cursor:pointer; user-select:none; }
        .remember input { accent-color: var(--accent); }
        .auth-foot-line { margin-top: 24px; font-size: 12px; color: var(--ink-3); text-align:center; letter-spacing:0.05em; }
        .auth-foot-line a { color: var(--accent); }
      `}</style>
    </div>
  );
}

function SignUp({ go }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [pw, setPw] = React.useState("");
  const strength = Math.min(100, pw.length * 12);
  return (
    <div>
      <div className="chip" style={{marginBottom:14}}>
        <span className="dot"/> 5,000 free chunks · no card
      </div>
      <h1 className="auth-h1">
        Start your <span className="serif-it">workspace</span>.
      </h1>
      <p className="auth-sub">You'll be asking your first indexed question in under three minutes.</p>

      <SocialRow/>
      <Divider label="or with email"/>
      <Field label="Full name" value={name} onChange={setName} hint="Ada Lovelace"/>
      <Field label="Work email" value={email} onChange={setEmail} hint="you@company.com"/>
      <Field label="Password" type="password" value={pw} onChange={setPw} hint="at least 12 characters"/>
      <div className="pw-meter">
        <div className="pw-bar" style={{width: `${strength}%`, background: strength>60 ? "var(--good)" : strength>30 ? "var(--warn)" : "var(--danger)"}}/>
      </div>
      <label className="remember" style={{marginTop:12}}>
        <input type="checkbox" defaultChecked/>
        <span>I agree to the terms and fair-use policy</span>
      </label>
      <button className="btn primary" style={{width:"100%", justifyContent:"center", marginTop:18, padding:"14px"}}
              onClick={()=>go("chat")}>
        Create workspace <I.Arrow size={14}/>
      </button>
      <p className="auth-foot-line mono">
        Already using Wizardocs? <a href="#" onClick={(e)=>{e.preventDefault(); go("signin");}}>Sign in →</a>
      </p>

      <style>{`
        .pw-meter { height: 3px; border-radius: 2px; background: var(--surface-3); margin-top: 4px; overflow: hidden; }
        .pw-bar { height: 100%; transition: width .2s, background .2s; }
      `}</style>
    </div>
  );
}

window.AuthShell = AuthShell;
