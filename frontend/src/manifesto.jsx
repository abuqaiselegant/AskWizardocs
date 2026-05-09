// Manifesto page — vision and philosophy

function Manifesto({ go, theme, toggleTheme, user }) {
  return (
    <div style={{minHeight:"100vh", background:"var(--bg)"}}>
      <Nav go={go} theme={theme} toggleTheme={toggleTheme} user={user} />

      <div className="mani-layout">
        <div className="mani-eyebrow mono">MANIFESTO</div>
        <h1 className="mani-title">
          We are building the infrastructure<br/>
          <span style={{color:"var(--accent)"}}>knowledge deserves.</span>
        </h1>

        <div className="mani-body">

          <p className="mani-lead">
            In 1822, Charles Babbage conceived an Analytical Engine — a machine that could compute
            any function, store results, and act on them. He had no silicon. No compilers. No internet.
            He had only the conviction that knowledge, once captured, should not be lost to human fallibility.
          </p>

          <p className="mani-lead">
            Babbage never finished his engine. But the idea survived him by a century and a half —
            because ideas that are true do not die. They wait.
          </p>

          <div className="mani-divider" />

          <p>
            Nikola Tesla imagined a world lit by wireless energy — power transmitted invisibly,
            available everywhere, to everyone. His contemporaries called it fantasy. He was
            describing infrastructure: a system so deeply embedded it becomes invisible,
            so reliable it becomes assumed.
          </p>

          <p>
            Both men understood something that most engineers still miss: the highest form
            of invention is not a product. It is a layer — a foundation other things are built on.
          </p>

          <div className="mani-divider" />

          <h2>The problem with documentation</h2>

          <p>
            Every meaningful software system ships with documentation. Most of it is never read.
            Not because engineers are lazy — because the surface area is enormous, the signal-to-noise
            ratio is low, and the cost of a wrong answer is high enough that most people give up and
            ask a colleague instead.
          </p>

          <p>
            This is a retrieval problem. The knowledge exists. It is indexed, public, maintained.
            The question is whether we can build a system that retrieves it faithfully —
            that gives you the right paragraph, from the right document, with a citation you can verify.
          </p>

          <p>
            Not a chatbot that sounds confident while hallucinating. Not a search engine that
            returns links you still have to read. A system that understands your question,
            finds the evidence, and shows its work.
          </p>

          <div className="mani-divider" />

          <h2>What we believe</h2>

          <div className="mani-beliefs">
            <div className="mani-belief">
              <span className="mani-belief-num">01</span>
              <div>
                <strong>Citations are non-negotiable.</strong>
                <p>An answer without a source is an opinion. Every claim should point to the document it came from. You should be able to read the original text in under two clicks.</p>
              </div>
            </div>
            <div className="mani-belief">
              <span className="mani-belief-num">02</span>
              <div>
                <strong>Retrieval is an engineering problem.</strong>
                <p>The quality of an answer is bounded by the quality of retrieval. Keyword search and semantic search find different things. A good system uses both, then ranks the results with a model that reads them as a human would.</p>
              </div>
            </div>
            <div className="mani-belief">
              <span className="mani-belief-num">03</span>
              <div>
                <strong>Confidence should be honest.</strong>
                <p>A system that reports 95% confidence on everything teaches you nothing. The confidence score in Wizardocs is the reranker's relevance signal — a real number that tells you how well the retrieved chunks matched your question.</p>
              </div>
            </div>
            <div className="mani-belief">
              <span className="mani-belief-num">04</span>
              <div>
                <strong>Documentation is infrastructure.</strong>
                <p>The teams that move fastest are the ones who treat their documentation as a first-class system — maintained, indexed, queryable. Wizardocs is the retrieval layer for teams who already believe this.</p>
              </div>
            </div>
          </div>

          <div className="mani-divider" />

          <h2>The longer arc</h2>

          <p>
            Babbage's engine was too expensive to build in brass. Tesla's wireless grid was too
            expensive to build in 1900. The ideas were right. The infrastructure wasn't ready.
          </p>

          <p>
            We are at an unusual moment. The embedding models exist. The cross-encoders exist.
            The language models exist. The cost of compute has dropped far enough that a RAG pipeline
            which would have required a dedicated ML team three years ago can now run for pennies per query.
          </p>

          <p>
            That means the constraint is no longer compute. It is curation — choosing which sources
            to index, maintaining them as they change, and building retrieval systems good enough
            that engineers trust the answers they get back.
          </p>

          <p>
            That is what we are building. Slowly, carefully, with citations.
          </p>

          <div className="mani-divider" />

          <div className="mani-footer-note">
            <span className="mono" style={{fontSize:12, color:"var(--ink-4)"}}>Wizardocs — built for people who actually read the docs.</span>
          </div>

        </div>
      </div>

      <Footer go={go} />

      <style>{`
        .mani-layout {
          max-width: 720px;
          margin: 0 auto;
          padding: 80px 32px 120px;
        }
        .mani-eyebrow {
          font-size: 11px;
          color: var(--accent);
          letter-spacing: 0.15em;
          margin-bottom: 24px;
        }
        .mani-title {
          font-family: var(--font-display);
          font-size: clamp(32px, 5vw, 52px);
          font-weight: 600;
          line-height: 1.15;
          letter-spacing: -0.025em;
          margin: 0 0 56px;
        }
        .mani-body { max-width: 680px; }
        .mani-lead {
          font-family: var(--font-serif);
          font-size: 19px;
          line-height: 1.75;
          color: var(--ink-2);
          margin: 0 0 24px;
          font-style: italic;
        }
        .mani-body p {
          font-size: 16px;
          line-height: 1.8;
          color: var(--ink-2);
          margin: 0 0 20px;
        }
        .mani-body h2 {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 20px;
          letter-spacing: -0.01em;
          color: var(--ink);
        }
        .mani-divider {
          height: 1px;
          background: var(--line);
          margin: 48px 0;
        }
        .mani-beliefs {
          display: flex;
          flex-direction: column;
          gap: 32px;
          margin: 8px 0;
        }
        .mani-belief {
          display: flex;
          gap: 24px;
        }
        .mani-belief-num {
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--accent);
          font-weight: 600;
          flex-shrink: 0;
          margin-top: 3px;
          min-width: 28px;
        }
        .mani-belief strong {
          display: block;
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 8px;
          color: var(--ink);
        }
        .mani-belief p {
          margin: 0;
          font-size: 15px;
          color: var(--ink-3);
          line-height: 1.7;
        }
        .mani-footer-note {
          text-align: center;
          padding: 32px 0 0;
        }
        @media (max-width: 640px) {
          .mani-layout { padding: 48px 20px 80px; }
          .mani-lead { font-size: 17px; }
        }
      `}</style>
    </div>
  );
}
