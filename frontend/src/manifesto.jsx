// About + Manifesto — combined page

function Manifesto({ go, theme, toggleTheme, user }) {
  return (
    <div style={{minHeight:"100vh", background:"var(--bg)"}}>
      <Nav go={go} theme={theme} toggleTheme={toggleTheme} user={user} />

      {/* Hero */}
      <div className="ab-hero">
        <div className="ab-hero-inner">
          <span className="mono ab-eyebrow">ABOUT WIZARDOCS</span>
          <h1 className="ab-title">
            We are building the retrieval layer<br/>
            <span style={{color:"var(--accent)"}}>documentation deserves.</span>
          </h1>
          <p className="ab-subtitle">
            A RAG-powered Q&A system for ML and LLM docs —
            grounded answers with citations you can verify.
          </p>
        </div>
        <div className="ab-hero-rule" />
      </div>

      <div className="ab-layout">

        {/* Origin */}
        <section className="ab-section">
          <div className="ab-section-label mono">ORIGIN</div>
          <div className="ab-section-body">
            <p className="ab-lead">
              This started from a simple frustration: asking an LLM about a library and
              getting a confident, well-written answer — that was subtly wrong. Not wrong
              enough to immediately fail. Wrong enough to cost two hours of debugging.
            </p>
            <p>
              The documentation had the right answer. The model just hadn't retrieved it.
              Or had retrieved the wrong version. Or had blended three different API versions
              into a plausible-sounding fiction.
            </p>
            <p>
              Wizardocs was built to fix that specific failure mode — not by making a
              smarter model, but by building a better retrieval system. One that shows
              its sources. One where you can click through and read the original paragraph
              yourself. One that reports how confident it is in the retrieval, not just
              how fluent the answer sounds.
            </p>
          </div>
        </section>

        <div className="ab-divider" />

        {/* Vision */}
        <section className="ab-section">
          <div className="ab-section-label mono">VISION</div>
          <div className="ab-section-body">
            <p className="ab-lead">
              In 1822, Charles Babbage conceived an Analytical Engine — a machine that could
              compute any function, store results, and act on them. He had no silicon, no
              compilers, no internet. He had only the conviction that knowledge, once captured,
              should not be lost to human fallibility.
            </p>
            <p className="ab-lead">
              Babbage never finished his engine. But the idea survived him by a century and a
              half — because ideas that are true do not die. They wait.
            </p>
            <p>
              Nikola Tesla imagined a world lit by wireless energy — power transmitted invisibly,
              available everywhere, to everyone. His contemporaries called it fantasy. He was
              describing infrastructure: a system so deeply embedded it becomes invisible,
              so reliable it becomes assumed.
            </p>
            <p>
              Both men understood something most engineers still miss: the highest form of
              invention is not a product. It is a layer — a foundation other things are built on.
              That is what we are building with Wizardocs. Not a chatbot. A retrieval layer.
            </p>
          </div>
        </section>

        <div className="ab-divider" />

        {/* What we believe */}
        <section className="ab-section ab-section-beliefs">
          <div className="ab-section-label mono">WHAT WE BELIEVE</div>
          <div className="ab-beliefs">
            <div className="ab-belief">
              <span className="ab-belief-num">01</span>
              <div>
                <strong>Citations are non-negotiable.</strong>
                <p>An answer without a source is an opinion. Every claim should point to the document it came from. You should be able to read the original text in under two clicks.</p>
              </div>
            </div>
            <div className="ab-belief">
              <span className="ab-belief-num">02</span>
              <div>
                <strong>Retrieval is an engineering problem.</strong>
                <p>The quality of an answer is bounded by the quality of retrieval. Keyword search and semantic search find different things. A good system uses both — then ranks results with a model that reads them as a human would.</p>
              </div>
            </div>
            <div className="ab-belief">
              <span className="ab-belief-num">03</span>
              <div>
                <strong>Confidence should be honest.</strong>
                <p>A system that reports 95% confidence on everything teaches you nothing. The confidence score here is the reranker's actual relevance signal — not a proxy, not a performance.</p>
              </div>
            </div>
            <div className="ab-belief">
              <span className="ab-belief-num">04</span>
              <div>
                <strong>Documentation is infrastructure.</strong>
                <p>The teams that move fastest treat their docs as a first-class system — maintained, indexed, queryable. Wizardocs is the retrieval layer for teams who already believe this.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="ab-divider" />

        {/* The longer arc */}
        <section className="ab-section">
          <div className="ab-section-label mono">THE LONGER ARC</div>
          <div className="ab-section-body">
            <p>
              Babbage's engine was too expensive to build in brass. Tesla's wireless grid was
              too expensive to build in 1900. The ideas were right. The infrastructure wasn't ready.
            </p>
            <p>
              We are at an unusual moment. Embedding models exist. Cross-encoders exist.
              The language models exist. The cost of compute has dropped far enough that a
              full RAG pipeline — which would have required a dedicated ML team three years ago —
              can now run for pennies per query.
            </p>
            <p>
              The constraint is no longer compute. It is curation: choosing which sources to
              index, maintaining them as they change, and building retrieval systems good enough
              that engineers trust the answers they get back.
            </p>
          </div>
        </section>

        <div className="ab-divider" />

        {/* Closing */}
        <section className="ab-closing">
          <p className="ab-closing-quote">
            "Knowledge that cannot be retrieved<br/>
            might as well not exist.<br/>
            <span style={{color:"var(--accent)"}}>We are fixing that.</span>"
          </p>
          <div style={{marginTop:40, display:"flex", gap:16, flexWrap:"wrap", justifyContent:"center"}}>
            <button className="btn primary" onClick={() => go("chat")}>Try Wizardocs</button>
            <a href="https://github.com/abuqaiselegant/AskWizardocs" target="_blank" rel="noreferrer"
               className="btn ghost">View on GitHub ↗</a>
          </div>
        </section>

      </div>

      <Footer go={go} />

      <style>{`
        .ab-hero {
          padding: 96px 32px 0;
          max-width: 900px;
          margin: 0 auto;
        }
        .ab-hero-inner { max-width: 760px; }
        .ab-eyebrow {
          font-size: 11px;
          color: var(--accent);
          letter-spacing: 0.15em;
          display: block;
          margin-bottom: 24px;
        }
        .ab-title {
          font-family: var(--font-display);
          font-size: clamp(34px, 5.5vw, 56px);
          font-weight: 600;
          line-height: 1.12;
          letter-spacing: -0.028em;
          margin: 0 0 24px;
        }
        .ab-subtitle {
          font-size: 17px;
          color: var(--ink-3);
          line-height: 1.6;
          margin: 0;
          max-width: 520px;
        }
        .ab-hero-rule {
          height: 1px;
          background: var(--line);
          margin-top: 72px;
        }
        .ab-layout {
          max-width: 900px;
          margin: 0 auto;
          padding: 0 32px 120px;
        }
        .ab-section {
          display: grid;
          grid-template-columns: 160px 1fr;
          gap: 48px;
          padding: 64px 0;
        }
        .ab-section-label {
          font-size: 10px;
          color: var(--ink-4);
          letter-spacing: 0.14em;
          padding-top: 6px;
        }
        .ab-section-body {}
        .ab-lead {
          font-family: var(--font-serif);
          font-size: 19px;
          line-height: 1.75;
          color: var(--ink-2);
          margin: 0 0 24px;
          font-style: italic;
        }
        .ab-section-body p {
          font-size: 15.5px;
          line-height: 1.85;
          color: var(--ink-3);
          margin: 0 0 18px;
        }
        .ab-section-beliefs {
          display: block;
        }
        .ab-section-beliefs .ab-section-label {
          margin-bottom: 40px;
        }
        .ab-beliefs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px;
        }
        .ab-belief {
          display: flex;
          gap: 18px;
          padding: 28px;
          background: var(--surface);
          border: 1px solid var(--line);
        }
        .ab-belief:nth-child(1) { border-radius: var(--radius) 0 0 0; }
        .ab-belief:nth-child(2) { border-radius: 0 var(--radius) 0 0; }
        .ab-belief:nth-child(3) { border-radius: 0 0 0 var(--radius); }
        .ab-belief:nth-child(4) { border-radius: 0 0 var(--radius) 0; }
        .ab-belief-num {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--accent);
          font-weight: 600;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .ab-belief strong {
          display: block;
          font-size: 14.5px;
          font-weight: 600;
          margin-bottom: 8px;
          color: var(--ink);
        }
        .ab-belief p {
          margin: 0;
          font-size: 13.5px;
          color: var(--ink-3);
          line-height: 1.7;
        }
        .ab-divider {
          height: 1px;
          background: var(--line);
        }
        .ab-closing {
          padding: 80px 0 40px;
          text-align: center;
        }
        .ab-closing-quote {
          font-family: var(--font-serif);
          font-size: clamp(22px, 3vw, 30px);
          font-style: italic;
          color: var(--ink-2);
          line-height: 1.6;
          margin: 0;
        }
        @media (max-width: 720px) {
          .ab-hero { padding: 60px 20px 0; }
          .ab-layout { padding: 0 20px 80px; }
          .ab-section { grid-template-columns: 1fr; gap: 16px; padding: 48px 0; }
          .ab-beliefs { grid-template-columns: 1fr; }
          .ab-belief:nth-child(1),
          .ab-belief:nth-child(2),
          .ab-belief:nth-child(3),
          .ab-belief:nth-child(4) { border-radius: 0; }
          .ab-beliefs { border-radius: var(--radius); overflow: hidden; }
        }
      `}</style>
    </div>
  );
}
