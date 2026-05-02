// Landing page — hero with shelf, how it works, features, footer

function Landing({ go, tweaks }) {
  return (
    <div className="landing page-enter">
      <Nav go={go} />

      {/* Hero */}
      <section className="hero">
        <div className="hero-grid">
          <div className="hero-left">
            <div className="chip">
              <span className="dot"/>
              <span>v0.9 · public beta</span>
            </div>
            <h1 className="h1 hero-h1">
              <span className="hero-h1-row">
                <span className="glow-text">Every ML doc,</span>
              </span>
              <span className="hero-h1-row">
                <span className="serif-it hero-em">answerable</span>
                <span className="hero-h1-sparkle" aria-hidden>
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                    <path d="M12 2 L13.5 9 L20 10 L14 13 L15.5 20 L12 16 L8.5 20 L10 13 L4 10 L10.5 9 Z" fill="currentColor"/>
                  </svg>
                </span>
              </span>
              <span className="hero-h1-row">
                <span className="glow-text">in one chat.</span>
              </span>
            </h1>
            <p className="lede">
              Wizardocs is a domain-specific Q&A system for ML and LLM documentation. Ask a question — get a cited, accurate answer drawn exclusively from LangChain, HuggingFace, MLflow, and the best RAG & vector-DB writing on the internet.
            </p>
            <div className="cta-row">
              <button className="btn primary" onClick={() => go("signup")}>
                Start for free <I.Arrow size={14}/>
              </button>
              <button className="btn" onClick={() => go("chat")}>
                See a live demo
              </button>
              <div className="mono" style={{fontSize:12, color:"var(--ink-3)", marginLeft:"auto"}}>
                <I.Dot size={10} style={{color:"var(--good)", verticalAlign:"middle"}}/> 5 sources live · LangChain · HuggingFace · MLflow · RAG · Vector DBs
              </div>
            </div>
            <div className="trust">
              <div className="mono tiny">indexed sources</div>
              <div className="logos">
                {["LangChain","HuggingFace","MLflow","RAG writing","Vector DB blogs"].map(l => (
                  <div key={l} className="logo-word">{l}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="hero-right">
            <BookShelf intensity={tweaks.motion}/>
            <div className="hero-caption mono">
              <span className="hero-caption-line"/>
              retrieval layer → your library
            </div>
          </div>
        </div>

        {/* Terminal-ish ticker below hero */}
        <div className="ticker">
          <div className="ticker-inner">
            {Array.from({length: 2}).map((_, r) => (
              <div key={r} className="ticker-row">
                {["source · LangChain docs", "source · HuggingFace Transformers", "source · MLflow docs", "source · RAG & vector-DB blogs", "hybrid: BM25 + dense", "reranker: cross-encoder", "citations: always on", "bring-your-own docs · soon"].map((t,i)=>(
                  <span key={i} className="tick">
                    <I.Dot size={8} style={{color:"var(--accent)"}}/> {t}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="howitworks" className="section">
        <div className="section-head">
          <div className="chip">03 — STEPS</div>
          <h2 className="h2">From scattered docs to grounded answers — in three moves.</h2>
        </div>
        <div className="steps">
          {[
            {
              n: "01", tag: "SOURCES",
              title: "Curated, always-fresh sources.",
              body: "We ingest and re-crawl the canonical ML/LLM docs — LangChain, HuggingFace, MLflow — plus the best RAG and vector-DB writing. Semantic chunking, heading-aware, de-duped.",
              art: <StepArtIngest/>
            },
            {
              n: "02", tag: "RETRIEVE",
              title: "Hybrid search, reranked.",
              body: "Dense + BM25 + metadata filters. A cross-encoder reranks the top-k. You see the chunks we pulled — and where they came from.",
              art: <StepArtRetrieve/>
            },
            {
              n: "03", tag: "GROUND",
              title: "Answers with receipts.",
              body: "Every sentence resolves to a real docs URL. Hover [1] to preview the chunk, click to open the page. A confidence meter flags when retrieval was thin.",
              art: <StepArtGround/>
            },
          ].map((s, i) => (
            <div key={s.n} className="step">
              <div className="step-top">
                <div className="step-n mono">{s.n}</div>
                <div className="step-tag chip">{s.tag}</div>
              </div>
              <div className="step-art">{s.art}</div>
              <h3 className="step-title">{s.title}</h3>
              <p className="step-body">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature strip */}
      <section id="features" className="section features">
        <div className="feat-grid">
          <div className="feat big">
            <FloatingDocs intensity={tweaks.motion}/>
            <div className="feat-copy">
              <div className="chip">THE STACK</div>
              <h3 className="h3">The ML/LLM docs, finally answerable.</h3>
              <p className="muted">No more grepping five doc sites and a handful of blog posts to remember how a retriever composes with a reranker. Ask once, get a grounded answer with the exact pages cited.</p>
              <p className="muted" style={{marginTop:8, fontSize:12, color:"var(--ink-3)"}}>Bring-your-own docs coming soon — for now, we ship with a curated index.</p>
            </div>
          </div>
          <div className="feat">
            <I.Cite size={22} style={{color:"var(--accent)"}}/>
            <h4>Inline citations</h4>
            <p className="muted">Every claim links back to the source chunk. Hover for a preview, click to open.</p>
          </div>
          <div className="feat">
            <I.Shield size={22} style={{color:"var(--accent)"}}/>
            <h4>Confidence meter</h4>
            <p className="muted">Know when the model is improvising. Low-confidence answers are marked, not hidden.</p>
          </div>
          <div className="feat">
            <I.Zap size={22} style={{color:"var(--accent)"}}/>
            <h4>Sub-second retrieval</h4>
            <p className="muted">pgvector + HNSW + a cross-encoder reranker. p50 under 500ms on 10M chunks.</p>
          </div>
          <div className="feat">
            <I.Layers size={22} style={{color:"var(--accent)"}}/>
            <h4>Open stack</h4>
            <p className="muted">Bring your own model, embedder, and store. No lock-in. Self-host or cloud.</p>
          </div>
        </div>
      </section>

      {/* Big CTA */}
      <section className="section cta">
        <div className="cta-card">
          <div className="cta-bg"/>
          <h2 className="h2" style={{marginBottom: 10}}>Your library. Finally answering back.</h2>
          <p className="muted" style={{maxWidth: 520, marginInline:"auto"}}>
            Start free on up to 5,000 chunks. No credit card. Your first query in under three minutes.
          </p>
          <div className="cta-row" style={{justifyContent:"center", marginTop: 24}}>
            <button className="btn primary" onClick={() => go("signup")}>Start for free <I.Arrow size={14}/></button>
            <button className="btn" onClick={() => go("signin")}>I have an account</button>
          </div>
        </div>
      </section>

      <Footer/>

      <style>{`
        .landing { position: relative; }
        .hero {
          padding: 40px 32px 40px;
          position: relative;
        }
        .hero-grid {
          max-width: 1280px; margin: 0 auto;
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 48px;
          align-items: center;
          min-height: 72vh;
        }
        .h1 {
          font-family: var(--font-display);
          font-weight: 500;
          font-size: clamp(44px, 6vw, 84px);
          line-height: 1.02;
          letter-spacing: -0.03em;
          margin: 20px 0 18px;
        }
        .h1 .serif-it { font-family: var(--font-serif); font-style: italic; font-weight: 400; color: var(--accent); }
        .hero-h1 { display: flex; flex-direction: column; gap: 2px; }
        .hero-h1-row { display: inline-flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .hero-em {
          font-size: 1.18em;
          letter-spacing: -0.04em;
          color: var(--accent);
          position: relative;
          padding: 0 0.06em;
          background: linear-gradient(120deg, var(--accent-2) 0%, var(--accent) 60%, var(--accent-2) 100%);
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 40px var(--accent-glow);
        }
        .hero-em::before {
          content: "";
          position: absolute;
          left: -4%; right: -4%; bottom: 0.08em;
          height: 0.12em;
          background: var(--accent);
          opacity: 0.25;
          border-radius: 2px;
          transform: skewX(-12deg);
        }
        .hero-h1-sparkle {
          display: inline-flex;
          color: var(--accent-2);
          animation: sparkSpin 6s linear infinite;
          filter: drop-shadow(0 0 12px var(--accent-glow));
        }
        @keyframes sparkSpin {
          0%, 100% { transform: rotate(0) scale(1); }
          50%      { transform: rotate(180deg) scale(1.15); }
        }
        [data-motion="low"] .hero-h1-sparkle,
        [data-motion="none"] .hero-h1-sparkle { animation: none; }
        .h2 {
          font-family: var(--font-display); font-weight: 500;
          font-size: clamp(30px, 3.6vw, 48px);
          letter-spacing: -0.02em; line-height: 1.08;
          margin: 16px 0;
          max-width: 820px;
        }
        .h3 { font-family: var(--font-display); font-weight: 500; font-size: 26px; letter-spacing:-0.01em; margin: 12px 0; }
        .lede {
          font-size: 18px; line-height: 1.55; color: var(--ink-2);
          max-width: 520px;
          text-wrap: pretty;
        }
        .cta-row { display:flex; align-items: center; gap: 12px; margin-top: 28px; flex-wrap: wrap; }
        .trust { margin-top: 48px; display:flex; align-items:center; gap: 24px; flex-wrap: wrap; }
        .tiny { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3); }
        .logos { display:flex; gap: 24px; flex-wrap: wrap; }
        .logo-word {
          font-family: var(--font-serif); font-style: italic;
          font-size: 18px; color: var(--ink-3); opacity: 0.7;
          letter-spacing: -0.01em;
        }
        .hero-caption {
          margin-top: 18px; text-align:center;
          font-size: 11px; color: var(--ink-3); letter-spacing: 0.06em; text-transform: uppercase;
          display: inline-flex; align-items:center; gap: 10px; justify-content: center;
          width: 100%;
        }
        .hero-caption-line { width: 28px; height: 1px; background: var(--line-2); display:inline-block; }

        .ticker {
          margin-top: 56px;
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          overflow: hidden;
          background: var(--bg-2);
        }
        .ticker-inner { display:flex; animation: scroll 40s linear infinite; width: max-content; }
        .ticker-row { display:flex; gap: 48px; padding: 14px 24px; white-space: nowrap; }
        .tick { font-family: var(--font-mono); font-size: 12px; color: var(--ink-2); display:inline-flex; align-items:center; gap: 8px;}
        @keyframes scroll { from { transform: translateX(0) } to { transform: translateX(-50%) } }

        .section { max-width: 1280px; margin: 0 auto; padding: 120px 32px; }
        .section-head { margin-bottom: 56px; max-width: 820px; display:flex; flex-direction:column; gap: 8px; }
        .section-head .chip { align-self: flex-start; }

        .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .step {
          padding: 28px;
          border: 1px solid var(--line);
          border-radius: 18px;
          background:
            linear-gradient(180deg, var(--surface) 0%, var(--bg-2) 100%);
          display:flex; flex-direction: column; gap: 14px;
          position: relative; overflow: hidden;
          transition: border-color .25s, transform .25s;
        }
        .step:hover { border-color: var(--line-2); transform: translateY(-3px); }
        .step::before {
          content: "";
          position: absolute; inset: 0;
          background: radial-gradient(600px 300px at 0% 0%, var(--accent-soft), transparent 60%);
          opacity: 0; transition: opacity .3s;
          pointer-events:none;
        }
        .step:hover::before { opacity: 1; }
        .step-top { display:flex; justify-content: space-between; align-items:center; }
        .step-n { font-size: 13px; color: var(--ink-3); letter-spacing: 0.1em; }
        .step-art { height: 180px; display:grid; place-items:center; border-radius: 10px; background: var(--bg); border: 1px dashed var(--line); overflow: hidden; }
        .step-title { font-family: var(--font-display); font-weight: 500; font-size: 22px; letter-spacing: -0.01em; margin: 0; }
        .step-body { color: var(--ink-2); font-size: 14px; line-height: 1.55; margin: 0; }

        .features { padding-top: 40px; }
        .feat-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .feat {
          padding: 24px;
          border: 1px solid var(--line);
          background: var(--surface);
          border-radius: 16px;
          display: flex; flex-direction: column; gap: 10px;
          min-height: 200px;
          transition: border-color .2s;
        }
        .feat:hover { border-color: var(--line-2); }
        .feat h4 { font-family: var(--font-display); font-weight: 500; font-size: 17px; margin: 0; letter-spacing: -0.01em; }
        .feat .muted, .muted { color: var(--ink-2); font-size: 13.5px; line-height: 1.5; margin: 0; }
        .feat.big {
          grid-column: span 4;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: center;
          padding: 48px;
          min-height: 520px;
          background:
            radial-gradient(600px 300px at 80% 30%, var(--accent-soft), transparent 65%),
            var(--surface);
        }

        .cta-card {
          position: relative;
          padding: 72px 32px;
          text-align: center;
          border: 1px solid var(--line-2);
          border-radius: 24px;
          overflow: hidden;
          background: var(--surface);
        }
        .cta-bg {
          position:absolute; inset: 0;
          background:
            radial-gradient(600px 300px at 30% 20%, var(--accent-soft), transparent 65%),
            radial-gradient(500px 250px at 80% 80%, var(--accent-soft), transparent 65%);
          pointer-events: none;
        }

        @media (max-width: 980px) {
          .hero-grid { grid-template-columns: 1fr; gap: 24px; }
          .steps { grid-template-columns: 1fr; }
          .feat-grid { grid-template-columns: repeat(2, 1fr); }
          .feat.big { grid-column: span 2; grid-template-columns: 1fr; padding: 24px; }
          .section { padding: 80px 20px; }
        }
      `}</style>
    </div>
  );
}

// Step illustrations — small, abstract, on-brand
function StepArtIngest() {
  return (
    <svg viewBox="0 0 200 160" width="100%" height="100%" fill="none">
      <g stroke="var(--line-2)" strokeWidth="1">
        {/* 3 source cards flowing to center */}
        <rect x="10" y="20" width="40" height="50" rx="3" fill="var(--surface-2)"/>
        <rect x="10" y="90" width="40" height="50" rx="3" fill="var(--surface-2)"/>
        <rect x="150" y="55" width="40" height="50" rx="3" fill="var(--surface-2)"/>
        <line x1="50" y1="45"  x2="100" y2="80" stroke="var(--accent)" strokeDasharray="2 3">
          <animate attributeName="stroke-dashoffset" from="5" to="0" dur="1s" repeatCount="indefinite"/>
        </line>
        <line x1="50" y1="115" x2="100" y2="80" stroke="var(--accent)" strokeDasharray="2 3">
          <animate attributeName="stroke-dashoffset" from="5" to="0" dur="1s" repeatCount="indefinite"/>
        </line>
        <line x1="150" y1="80" x2="100" y2="80" stroke="var(--accent)" strokeDasharray="2 3">
          <animate attributeName="stroke-dashoffset" from="5" to="0" dur="1s" repeatCount="indefinite"/>
        </line>
        <circle cx="100" cy="80" r="14" fill="var(--accent-soft)" stroke="var(--accent)"/>
        <circle cx="100" cy="80" r="4" fill="var(--accent)"/>
      </g>
      <text x="16" y="16" fontFamily="JetBrains Mono" fontSize="8" fill="var(--ink-3)">docs</text>
      <text x="16" y="86" fontFamily="JetBrains Mono" fontSize="8" fill="var(--ink-3)">code</text>
      <text x="156" y="50" fontFamily="JetBrains Mono" fontSize="8" fill="var(--ink-3)">tickets</text>
    </svg>
  );
}
function StepArtRetrieve() {
  return (
    <svg viewBox="0 0 200 160" width="100%" height="100%" fill="none">
      <g stroke="var(--line-2)">
        {Array.from({length:8}).map((_,i)=>(
          <rect key={i} x={20} y={20 + i*15} width={160} height={10} rx="2" fill="var(--surface-2)"/>
        ))}
        {[1,3,5].map((i, k) => (
          <rect key={k} x="20" y={20 + i*15} width="160" height="10" rx="2" fill="none" stroke="var(--accent)">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" begin={`${k*0.3}s`} repeatCount="indefinite"/>
          </rect>
        ))}
      </g>
      <text x="20" y="14" fontFamily="JetBrains Mono" fontSize="8" fill="var(--ink-3)">top-k · reranked</text>
    </svg>
  );
}
function StepArtGround() {
  return (
    <svg viewBox="0 0 200 160" width="100%" height="100%" fill="none">
      <rect x="20" y="20" width="160" height="10" rx="2" fill="var(--surface-3)"/>
      <rect x="20" y="36" width="130" height="10" rx="2" fill="var(--surface-3)"/>
      <rect x="20" y="52" width="150" height="10" rx="2" fill="var(--surface-3)"/>
      {/* citations */}
      <g>
        <rect x="152" y="20" width="16" height="10" rx="2" fill="var(--accent-soft)" stroke="var(--accent)"/>
        <text x="155" y="29" fontFamily="JetBrains Mono" fontSize="7" fill="var(--accent)">[1]</text>
        <rect x="170" y="20" width="16" height="10" rx="2" fill="var(--accent-soft)" stroke="var(--accent)"/>
        <text x="173" y="29" fontFamily="JetBrains Mono" fontSize="7" fill="var(--accent)">[2]</text>
      </g>
      {/* confidence */}
      <text x="20" y="92" fontFamily="JetBrains Mono" fontSize="8" fill="var(--ink-3)">confidence</text>
      <rect x="20" y="100" width="160" height="5" rx="2.5" fill="var(--surface-3)"/>
      <rect x="20" y="100" width="140" height="5" rx="2.5" fill="var(--accent)">
        <animate attributeName="width" values="0;140;140" dur="2s" repeatCount="indefinite"/>
      </rect>
      <text x="20" y="122" fontFamily="JetBrains Mono" fontSize="8" fill="var(--good)">• high · 92%</text>
    </svg>
  );
}

function Footer() {
  return (
    <footer className="wd-footer">
      <div className="wd-foot-inner">
        <div className="wd-foot-brand">
          <div style={{display:"flex", alignItems:"center", gap:10, fontFamily:"var(--font-display)", fontWeight:600}}>
            <I.Logo size={22} style={{color:"var(--accent)"}}/> Wizardocs<span style={{color:"var(--accent)"}}>.</span>
          </div>
          <p style={{color:"var(--ink-3)", fontSize:13, maxWidth:280, marginTop:12}}>
            The retrieval layer for teams that treat their docs as infrastructure.
          </p>
        </div>
        <div className="wd-foot-cols">
          {[
            {h:"Product", items:["Overview","Features","Pricing","Changelog"]},
            {h:"Developers", items:["Docs","API","Self-host","Evals"]},
            {h:"Company", items:["About","Manifesto","Careers","Contact"]},
          ].map(c => (
            <div key={c.h}>
              <div className="mono" style={{fontSize:11, color:"var(--ink-3)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12}}>{c.h}</div>
              {c.items.map(i => <a key={i} className="foot-link" href="#">{i}</a>)}
            </div>
          ))}
        </div>
      </div>
      <div className="wd-foot-bottom mono">
        <span>© 2026 Wizardocs Labs</span>
        <span>Built for people who actually read the docs.</span>
      </div>
      <style>{`
        .wd-footer { border-top: 1px solid var(--line); background: var(--bg-2); }
        .wd-foot-inner {
          max-width: 1280px; margin: 0 auto; padding: 64px 32px 32px;
          display:grid; grid-template-columns: 1.2fr 2fr; gap: 48px;
        }
        .wd-foot-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .foot-link { display:block; color: var(--ink-2); font-size: 13.5px; padding: 4px 0; }
        .foot-link:hover { color: var(--ink); }
        .wd-foot-bottom {
          max-width: 1280px; margin: 0 auto; padding: 24px 32px; border-top: 1px solid var(--line);
          display:flex; justify-content: space-between; color: var(--ink-3); font-size: 12px;
        }
        @media (max-width: 880px) {
          .wd-foot-inner { grid-template-columns: 1fr; }
          .wd-foot-cols { grid-template-columns: repeat(2, 1fr); }
          .wd-foot-bottom { flex-direction: column; gap: 6px; }
        }
      `}</style>
    </footer>
  );
}

window.Landing = Landing;
window.Footer = Footer;
