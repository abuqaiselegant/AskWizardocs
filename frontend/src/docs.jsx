// Docs page — user guide for Wizardocs
import { Nav, Footer } from "./shared.jsx";

function Docs({ go, theme, toggleTheme, user }) {
  const sections = [
    {
      id: "quick-start",
      title: "Quick start",
      content: (
        <>
          <p>Wizardocs is a Q&A system grounded in real ML and LLM documentation. Ask a question in plain English, get an answer with inline citations you can verify.</p>
          <ol>
            <li><strong>Sign in</strong> — Click "Sign in" on the landing page. Use Google or GitHub OAuth — no password needed.</li>
            <li><strong>Ask a question</strong> — Type your question in the chat input. Be specific for better results. Example: <em>"How do I use PEFT for LoRA fine-tuning?"</em></li>
            <li><strong>Read the answer</strong> — The answer includes inline citations like <code>[1]</code>, <code>[2]</code> pointing to source chunks. Click any source chip below the answer to open the original doc.</li>
            <li><strong>Filter by source</strong> — Use the source chips at the top of chat to restrict retrieval to one library: LangChain, HuggingFace, or ChromaDB.</li>
            <li><strong>Follow-up questions</strong> — Each answer includes 3 context-aware suggested follow-ups. Click any to ask it immediately.</li>
          </ol>
        </>
      ),
    },
    {
      id: "sources",
      title: "Indexed sources",
      content: (
        <>
          <p>Wizardocs currently indexes 13,280 documentation chunks across 3 sources:</p>
          <table className="docs-table">
            <thead>
              <tr><th>Source</th><th>Chunks</th><th>Coverage</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="docs-badge" style={{background:"rgba(44,161,144,0.15)", color:"#2ca190"}}>LangChain</span></td>
                <td>3,235</td>
                <td>700+ HTML pages — full docs site</td>
              </tr>
              <tr>
                <td><span className="docs-badge" style={{background:"rgba(255,157,0,0.15)", color:"#ff9d00"}}>HuggingFace</span></td>
                <td>9,560</td>
                <td>Hub, Transformers, PEFT, TRL, Diffusers, Smolagents, Accelerate — GitHub .md files</td>
              </tr>
              <tr>
                <td><span className="docs-badge" style={{background:"rgba(139,92,246,0.15)", color:"#8b5cf6"}}>ChromaDB</span></td>
                <td>485</td>
                <td>169 HTML pages — full docs site</td>
              </tr>
            </tbody>
          </table>
          <p style={{marginTop:16, color:"var(--ink-3)", fontSize:14}}>More sources (MLflow, LlamaIndex, FAISS) are planned.</p>
        </>
      ),
    },
    {
      id: "how-it-works",
      title: "How retrieval works",
      content: (
        <>
          <p>Every query goes through a 4-step pipeline:</p>
          <div className="docs-pipeline">
            <div className="docs-step">
              <span className="docs-step-num">01</span>
              <div>
                <strong>Hybrid retrieval</strong>
                <p>BM25 keyword search + vector semantic search run in parallel. Results are fused using Reciprocal Rank Fusion (RRF) to get the top 20 candidates.</p>
              </div>
            </div>
            <div className="docs-step">
              <span className="docs-step-num">02</span>
              <div>
                <strong>Cohere reranking</strong>
                <p>A cross-encoder reads each (query, chunk) pair and outputs a true relevance score. Top 20 → top 5 chunks with scores between 0 and 1.</p>
              </div>
            </div>
            <div className="docs-step">
              <span className="docs-step-num">03</span>
              <div>
                <strong>GPT-4o-mini generation</strong>
                <p>The top 5 chunks are assembled into a numbered context block. GPT-4o-mini generates a grounded answer with inline <code>[N]</code> citations — it cannot fabricate beyond the provided context.</p>
              </div>
            </div>
            <div className="docs-step">
              <span className="docs-step-num">04</span>
              <div>
                <strong>Confidence score</strong>
                <p>The confidence meter shows the top chunk's reranker score — a real relevance signal, not a hallucinated percentage.</p>
              </div>
            </div>
          </div>
        </>
      ),
    },
    {
      id: "free-tier",
      title: "Free tier limits",
      content: (
        <>
          <p>The free plan includes:</p>
          <ul>
            <li>100 queries per month</li>
            <li>Access to all 3 indexed sources (LangChain, HuggingFace, ChromaDB)</li>
            <li>Full RAG pipeline — hybrid retrieval, reranking, citations</li>
            <li>Multi-turn conversation history</li>
          </ul>
          <p>After 100 queries, the API returns a <code>402</code> status and asks you to upgrade. Upgrade plans are coming soon.</p>
        </>
      ),
    },
    {
      id: "tips",
      title: "Tips for better answers",
      content: (
        <>
          <ul>
            <li><strong>Be specific.</strong> "How do I add a custom retriever to a LangChain chain?" beats "how does retrieval work?"</li>
            <li><strong>Use source filters.</strong> If you know which library you're asking about, select it — this narrows retrieval and improves precision.</li>
            <li><strong>Follow up.</strong> Ask clarifying questions. The system enriches follow-up queries with your previous question so "explain more" still retrieves relevant chunks.</li>
            <li><strong>Check citations.</strong> Every answer cites source chunks. If a claim seems off, click the source to read the original text.</li>
            <li><strong>Low confidence?</strong> A confidence score below 0.4 means the reranker wasn't sure the retrieved chunks were relevant. Rephrase your question or try a different source.</li>
          </ul>
        </>
      ),
    },
  ];

  return (
    <div style={{minHeight:"100vh", background:"var(--bg)"}}>
      <Nav go={go} theme={theme} toggleTheme={toggleTheme} user={user} />

      <div className="docs-layout">
        {/* Sidebar */}
        <aside className="docs-sidebar">
          <div className="docs-sidebar-inner">
            <div className="mono" style={{fontSize:11, color:"var(--ink-4)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:16}}>On this page</div>
            {sections.map(s => (
              <a key={s.id} href={"#" + s.id} className="docs-nav-link">{s.title}</a>
            ))}
            <div style={{marginTop:32, paddingTop:24, borderTop:"1px solid var(--line)"}}>
              <div className="mono" style={{fontSize:11, color:"var(--ink-4)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12}}>Resources</div>
              <a href="https://github.com/abuqaiselegant/AskWizardocs" target="_blank" rel="noreferrer" className="docs-nav-link">GitHub README ↗</a>
              <a href="#" onClick={(e) => { e.preventDefault(); go("api_reference"); }} className="docs-nav-link">API Reference</a>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="docs-main">
          <div className="docs-header">
            <span className="mono" style={{fontSize:12, color:"var(--accent)", letterSpacing:"0.08em"}}>DOCUMENTATION</span>
            <h1 style={{fontFamily:"var(--font-display)", fontSize:40, fontWeight:600, margin:"12px 0 8px", letterSpacing:"-0.02em"}}>Wizardocs User Guide</h1>
            <p style={{color:"var(--ink-3)", fontSize:16, maxWidth:640}}>
              Everything you need to ask smarter questions and get grounded, cited answers from ML documentation.
            </p>
            <a href="https://github.com/abuqaiselegant/AskWizardocs" target="_blank" rel="noreferrer"
               className="btn ghost" style={{marginTop:16, display:"inline-flex", alignItems:"center", gap:8, fontSize:14}}>
              View on GitHub ↗
            </a>
          </div>

          {sections.map(s => (
            <section key={s.id} id={s.id} className="docs-section">
              <h2>{s.title}</h2>
              {s.content}
            </section>
          ))}
        </main>
      </div>

      <Footer go={go} />

      <style>{`
        .docs-layout {
          display: grid;
          grid-template-columns: 240px 1fr;
          max-width: 1200px;
          margin: 0 auto;
          padding: 48px 32px;
          gap: 64px;
          min-height: calc(100vh - 64px);
        }
        .docs-sidebar { position: relative; }
        .docs-sidebar-inner {
          position: sticky;
          top: 96px;
          padding: 24px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: var(--radius);
        }
        .docs-nav-link {
          display: block;
          padding: 6px 0;
          font-size: 13.5px;
          color: var(--ink-3);
          transition: color 0.15s;
        }
        .docs-nav-link:hover { color: var(--ink); }
        .docs-main { max-width: 720px; }
        .docs-header { margin-bottom: 56px; padding-bottom: 40px; border-bottom: 1px solid var(--line); }
        .docs-section { margin-bottom: 56px; padding-bottom: 48px; border-bottom: 1px solid var(--line); }
        .docs-section:last-child { border-bottom: none; }
        .docs-section h2 {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 20px;
          letter-spacing: -0.01em;
        }
        .docs-section p { color: var(--ink-2); line-height: 1.7; margin: 0 0 16px; }
        .docs-section ol, .docs-section ul { color: var(--ink-2); line-height: 1.8; padding-left: 20px; }
        .docs-section li { margin-bottom: 8px; }
        .docs-section code {
          background: var(--surface-3);
          border: 1px solid var(--line);
          border-radius: 4px;
          padding: 2px 6px;
          font-family: var(--font-mono);
          font-size: 12.5px;
          color: var(--accent);
        }
        .docs-table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
          font-size: 14px;
        }
        .docs-table th {
          text-align: left;
          padding: 10px 16px;
          border-bottom: 1px solid var(--line);
          color: var(--ink-3);
          font-weight: 500;
          font-size: 12px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          font-family: var(--font-mono);
        }
        .docs-table td {
          padding: 12px 16px;
          border-bottom: 1px solid var(--line);
          color: var(--ink-2);
          vertical-align: middle;
        }
        .docs-table tr:last-child td { border-bottom: none; }
        .docs-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          font-family: var(--font-mono);
        }
        .docs-pipeline { display: flex; flex-direction: column; gap: 24px; margin-top: 8px; }
        .docs-step {
          display: flex;
          gap: 20px;
          padding: 20px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: var(--radius);
        }
        .docs-step-num {
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--accent);
          font-weight: 600;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .docs-step strong { display: block; margin-bottom: 6px; color: var(--ink); }
        .docs-step p { margin: 0; font-size: 14px; color: var(--ink-3); }
        @media (max-width: 800px) {
          .docs-layout { grid-template-columns: 1fr; padding: 32px 20px; }
          .docs-sidebar { display: none; }
        }
      `}</style>
    </div>
  );
}

export { Docs };
