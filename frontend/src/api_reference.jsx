// API Reference page — clean, professional endpoint documentation
import React from "react";
import { Nav, Footer } from "./shared.jsx";

function ApiReference({ go, theme, toggleTheme, user }) {
  const [copied, setCopied] = React.useState(null);

  const copy = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  function CodeBlock({ id, code, lang = "json" }) {
    return (
      <div className="api-code-block">
        <div className="api-code-header">
          <span className="mono" style={{fontSize:11, color:"var(--ink-4)"}}>{lang}</span>
          <button className="api-copy-btn" onClick={() => copy(code, id)}>
            {copied === id ? "copied" : "copy"}
          </button>
        </div>
        <pre><code>{code}</code></pre>
      </div>
    );
  }

  function EndpointBadge({ method }) {
    const colors = {
      POST: { bg: "rgba(125,211,163,0.15)", color: "#7dd3a3" },
      GET:  { bg: "rgba(106,168,255,0.15)", color: "#6aa8ff" },
    };
    const c = colors[method] || colors.GET;
    return (
      <span className="api-method-badge" style={{background: c.bg, color: c.color}}>{method}</span>
    );
  }

  // Verified against api/main.py + api/db.py on 2026-08-18. Every entry below
  // was previously wrong: /ask took "query" not "question", /chats was shown
  // wrapped in a {chats:[...]} object, /profile listed four fields that do not
  // exist, and /health advertised a chunk count it never returns.
  const endpoints = [
    {
      id: "ask",
      method: "POST",
      path: "/ask",
      auth: true,
      summary: "Ask a question",
      description: "Submit a question and receive a grounded answer with inline citations from the indexed documentation. Uses hybrid retrieval (BM25 + vector), Cohere reranking, and GPT-4o-mini generation.",
      request: {
        schema: [
          { field: "question", type: "string",        required: true,  desc: "The question to answer. Max 2000 characters." },
          { field: "source",   type: "string | null", required: false, desc: 'Filter retrieval to one source. One of: "langchain", "huggingface", "chromadb". Omit or set null to search all sources.' },
          { field: "history",  type: "array",         required: false, desc: 'Prior conversation turns, max 6. Each item is {role: "user" | "assistant", content: string} with content up to 8000 characters. Any other role is rejected.' },
          { field: "chat_id",  type: "string | null", required: false, desc: "UUID of an existing chat to persist this exchange to. Must belong to the caller. Omit to skip persistence." },
        ],
        example: `{
  "question": "How do I use LoRA with PEFT for fine-tuning?",
  "source": "huggingface",
  "history": [
    { "role": "user",      "content": "What is PEFT?" },
    { "role": "assistant", "content": "PEFT stands for..." }
  ],
  "chat_id": null
}`,
      },
      response: {
        schema: [
          { field: "answer",     type: "string", desc: "Markdown-formatted answer with inline [N] citation markers." },
          { field: "sources",    type: "array",  desc: "Cited chunks, in citation order. Each: {number, title, url, source, score, snippet}. score is null when the reranker fell back to RRF ordering." },
          { field: "confidence", type: "number | null", desc: "Top chunk reranker score (0–1). null when the reranker fell back to RRF ordering, or nothing was retrieved — same condition as a null score above." },
          { field: "followups",  type: "array",  desc: "3 context-aware follow-up question strings. Empty array if generation failed." },
        ],
        example: `{
  "answer": "To use LoRA with PEFT, first install the library...[1][2]",
  "sources": [
    {
      "number": 1,
      "title": "PEFT LoRA Tutorial",
      "url": "https://github.com/huggingface/peft/blob/main/docs/source/conceptual_guides/lora.md",
      "source": "huggingface",
      "score": 0.91,
      "snippet": "LoRA decomposes the weight update into two low-rank matrices..."
    }
  ],
  "confidence": 0.91,
  "followups": [
    "What are the best LoRA rank values for LLaMA?",
    "How does QLoRA differ from standard LoRA?",
    "Can I apply LoRA to vision models?"
  ]
}`,
      },
      errors: [
        { code: 400, desc: "Question is empty or whitespace only." },
        { code: 401, desc: "Missing or invalid Authorization header." },
        { code: 402, desc: "Free tier quota exceeded (100 queries/month)." },
        { code: 404, desc: "chat_id does not exist or does not belong to you." },
        { code: 422, desc: "Malformed body, or a bound exceeded (question > 2000 chars, history > 6 turns, content > 8000 chars, role not user/assistant)." },
      ],
    },
    {
      id: "create-chat",
      method: "POST",
      path: "/chats",
      auth: true,
      summary: "Create a chat",
      description: "Creates a new chat in the caller's workspace and returns its id. Enforces the storage cap: the chat falling to position 3 has its messages deleted, and chats beyond position 10 are removed entirely.",
      request: {
        schema: [
          { field: "title", type: "string", required: true, desc: "Chat title. Max 200 characters; stored truncated to 80." },
        ],
        example: `{ "title": "How do I use LoRA with PEFT?" }`,
      },
      response: {
        schema: [
          { field: "chat_id", type: "string", desc: "UUID of the newly created chat." },
        ],
        example: `{ "chat_id": "a1b2c3d4-..." }`,
      },
      errors: [
        { code: 401, desc: "Missing or invalid Authorization header." },
        { code: 500, desc: "Workspace or chat could not be created." },
      ],
    },
    {
      id: "chats",
      method: "GET",
      path: "/chats",
      auth: true,
      summary: "List chats",
      description: "Returns the caller's 10 most recent chats, newest first. Titles only — messages are fetched separately, and are retained for the 2 most recent chats only.",
      request: { schema: [], example: null },
      response: {
        schema: [
          { field: "(array)", type: "array", desc: "A bare JSON array — not an object. Each item: {id, title, created_at}." },
        ],
        example: `[
  {
    "id": "a1b2c3d4-...",
    "title": "How do I use LoRA with PEFT?",
    "created_at": "2026-08-18T12:00:00Z"
  }
]`,
      },
      errors: [
        { code: 401, desc: "Missing or invalid Authorization header." },
      ],
    },
    {
      id: "chat-messages",
      method: "GET",
      path: "/chats/{chat_id}/messages",
      auth: true,
      summary: "Get chat messages",
      description: "Returns the stored messages for one chat, oldest first. Only the 2 most recent chats retain messages; older chats return an empty array.",
      request: { schema: [], example: null },
      response: {
        schema: [
          { field: "(array)", type: "array", desc: "A bare JSON array. Each item: {role, content, sources_json, created_at}. sources_json is null for user turns and holds the cited sources for assistant turns." },
        ],
        example: `[
  {
    "role": "user",
    "content": "How do I use LoRA with PEFT?",
    "sources_json": null,
    "created_at": "2026-08-18T12:00:00Z"
  },
  {
    "role": "assistant",
    "content": "To use LoRA with PEFT...[1]",
    "sources_json": [
      { "number": 1, "title": "PEFT LoRA Tutorial", "url": "https://...", "source": "huggingface", "score": 0.91, "snippet": "LoRA decomposes..." }
    ],
    "created_at": "2026-08-18T12:00:04Z"
  }
]`,
      },
      errors: [
        { code: 401, desc: "Missing or invalid Authorization header." },
        { code: 404, desc: "Chat does not exist or does not belong to you." },
      ],
    },
    {
      id: "delete-chats",
      method: "DELETE",
      path: "/chats",
      auth: true,
      summary: "Clear all chats",
      description: "Deletes every chat in the caller's workspace. Messages are removed by cascade. This cannot be undone.",
      request: { schema: [], example: null },
      response: {
        schema: [
          { field: "ok", type: "boolean", desc: "Always true when the request succeeded." },
        ],
        example: `{ "ok": true }`,
      },
      errors: [
        { code: 401, desc: "Missing or invalid Authorization header." },
      ],
    },
    {
      id: "profile",
      method: "GET",
      path: "/profile",
      auth: true,
      summary: "Get user profile",
      description: "Returns account info and usage for the authenticated user. Email and join date are not served here — the frontend reads those from the Supabase session.",
      request: { schema: [], example: null },
      response: {
        schema: [
          { field: "name",           type: "string | null", desc: "Display name from users_profile." },
          { field: "plan",           type: "string",        desc: 'Current plan. "free" or "pro".' },
          { field: "chunks_indexed", type: "number",        desc: "Chunks indexed by this workspace. Always 0 until bring-your-own-docs ships." },
          { field: "queries_used",   type: "number",        desc: "Queries used in the current calendar month. The free-tier limit is 100." },
        ],
        example: `{
  "name": "Ada Lovelace",
  "plan": "free",
  "chunks_indexed": 0,
  "queries_used": 42
}`,
      },
      errors: [
        { code: 401, desc: "Missing or invalid Authorization header." },
      ],
    },
    {
      id: "health",
      method: "GET",
      path: "/health",
      auth: false,
      summary: "Health check",
      description: "Lightweight liveness probe. The only unauthenticated endpoint.",
      request: { schema: [], example: null },
      response: {
        schema: [
          { field: "status", type: "string", desc: '"ok"' },
        ],
        example: `{ "status": "ok" }`,
      },
      errors: [],
    },
  ];

  return (
    <div style={{minHeight:"100vh", background:"var(--bg)"}}>
      <Nav go={go} theme={theme} toggleTheme={toggleTheme} user={user} />

      <div className="api-layout">
        {/* Sidebar */}
        <aside className="api-sidebar">
          <div className="api-sidebar-inner">
            <div className="mono" style={{fontSize:11, color:"var(--ink-4)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:16}}>Endpoints</div>
            {endpoints.map(ep => (
              <a key={ep.id} href={"#" + ep.id} className="api-nav-link">
                <EndpointBadge method={ep.method} />
                <span className="mono" style={{fontSize:12}}>{ep.path}</span>
              </a>
            ))}
            <div style={{marginTop:32, paddingTop:24, borderTop:"1px solid var(--line)"}}>
              <div className="mono" style={{fontSize:11, color:"var(--ink-4)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12}}>See also</div>
              <a href="#" onClick={(e) => { e.preventDefault(); go("docs"); }} className="api-nav-link-plain">User Guide</a>
              <a href="https://github.com/abuqaiselegant/AskWizardocs" target="_blank" rel="noreferrer" className="api-nav-link-plain">GitHub ↗</a>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="api-main">
          <div className="api-header">
            <span className="mono" style={{fontSize:12, color:"var(--accent)", letterSpacing:"0.08em"}}>API REFERENCE</span>
            <h1 style={{fontFamily:"var(--font-display)", fontSize:40, fontWeight:600, margin:"12px 0 8px", letterSpacing:"-0.02em"}}>Wizardocs API</h1>
            <p style={{color:"var(--ink-3)", fontSize:16, maxWidth:640, marginBottom:24}}>
              REST API powering Wizardocs. The API is a separate origin from this site — the frontend is served from Vercel and calls the backend cross-origin, which is why CORS is scoped to the Wizardocs domain.
            </p>

            <div className="api-info-row">
              <div className="api-info-chip">
                <span className="mono" style={{fontSize:11, color:"var(--ink-3)"}}>Base URL</span>
                <code>https://wizardocs.duckdns.org</code>
              </div>
              <div className="api-info-chip">
                <span className="mono" style={{fontSize:11, color:"var(--ink-3)"}}>Auth</span>
                <code>Bearer &lt;supabase-jwt&gt;</code>
              </div>
              <div className="api-info-chip">
                <span className="mono" style={{fontSize:11, color:"var(--ink-3)"}}>Content-Type</span>
                <code>application/json</code>
              </div>
            </div>

            <div style={{marginTop:24, padding:16, background:"var(--surface)", border:"1px solid var(--line)", borderRadius:"var(--radius)", fontSize:14, color:"var(--ink-3)"}}>
              <strong style={{color:"var(--ink)"}}>Authentication</strong> — All endpoints except <code className="api-inline-code">/health</code> require a Supabase JWT in the <code className="api-inline-code">Authorization</code> header. The token is obtained via Supabase Google OAuth (GitHub is not enabled) and is automatically included by the Wizardocs frontend.
            </div>
          </div>

          {endpoints.map(ep => (
            <section key={ep.id} id={ep.id} className="api-endpoint">
              <div className="api-endpoint-title">
                <EndpointBadge method={ep.method} />
                <code className="api-path">{ep.path}</code>
                {!ep.auth && <span className="api-no-auth">no auth</span>}
              </div>
              <h2>{ep.summary}</h2>
              <p style={{color:"var(--ink-3)", fontSize:15, lineHeight:1.7, margin:"0 0 28px"}}>{ep.description}</p>

              {ep.request.schema.length > 0 && (
                <>
                  <h3>Request body</h3>
                  <table className="api-table">
                    <thead>
                      <tr>
                        <th>Field</th><th>Type</th><th>Required</th><th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ep.request.schema.map(f => (
                        <tr key={f.field}>
                          <td><code className="api-field">{f.field}</code></td>
                          <td><span className="api-type">{f.type}</span></td>
                          <td>{f.required ? <span style={{color:"var(--good)"}}>yes</span> : <span style={{color:"var(--ink-4)"}}>no</span>}</td>
                          <td style={{color:"var(--ink-3)", fontSize:13}}>{f.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {ep.request.example && (
                    <CodeBlock id={ep.id + "-req"} code={ep.request.example} lang="json — request" />
                  )}
                </>
              )}

              <h3>Response</h3>
              <table className="api-table">
                <thead>
                  <tr><th>Field</th><th>Type</th><th>Description</th></tr>
                </thead>
                <tbody>
                  {ep.response.schema.map(f => (
                    <tr key={f.field}>
                      <td><code className="api-field">{f.field}</code></td>
                      <td><span className="api-type">{f.type}</span></td>
                      <td style={{color:"var(--ink-3)", fontSize:13}}>{f.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <CodeBlock id={ep.id + "-res"} code={ep.response.example} lang="json — response" />

              {ep.errors.length > 0 && (
                <>
                  <h3>Error codes</h3>
                  <div className="api-errors">
                    {ep.errors.map(e => (
                      <div key={e.code} className="api-error-row">
                        <code className="api-error-code">{e.code}</code>
                        <span style={{color:"var(--ink-3)", fontSize:14}}>{e.desc}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          ))}
        </main>
      </div>

      <Footer go={go} />

      <style>{`
        .api-layout {
          display: grid;
          grid-template-columns: 260px 1fr;
          max-width: 1200px;
          margin: 0 auto;
          padding: 48px 32px;
          gap: 64px;
        }
        .api-sidebar { position: relative; }
        .api-sidebar-inner {
          position: sticky;
          top: 96px;
          padding: 24px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: var(--radius);
        }
        .api-nav-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 7px 0;
          color: var(--ink-3);
          font-size: 13px;
          transition: color 0.15s;
        }
        .api-nav-link:hover { color: var(--ink); }
        .api-nav-link-plain {
          display: block;
          padding: 6px 0;
          font-size: 13.5px;
          color: var(--ink-3);
        }
        .api-nav-link-plain:hover { color: var(--ink); }
        .api-method-badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          flex-shrink: 0;
        }
        .api-main { max-width: 800px; }
        .api-header { margin-bottom: 56px; padding-bottom: 40px; border-bottom: 1px solid var(--line); }
        .api-info-row { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
        .api-info-chip {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px 16px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: var(--radius);
        }
        .api-info-chip code {
          font-family: var(--font-mono);
          font-size: 12.5px;
          color: var(--ink);
        }
        .api-endpoint {
          margin-bottom: 64px;
          padding-bottom: 48px;
          border-bottom: 1px solid var(--line);
        }
        .api-endpoint:last-child { border-bottom: none; }
        .api-endpoint-title {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .api-path {
          font-family: var(--font-mono);
          font-size: 15px;
          color: var(--ink);
          font-weight: 500;
        }
        .api-no-auth {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--ink-4);
          border: 1px solid var(--line);
          padding: 2px 8px;
          border-radius: 4px;
        }
        .api-endpoint h2 {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 12px;
          letter-spacing: -0.01em;
        }
        .api-endpoint h3 {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 600;
          margin: 28px 0 12px;
          color: var(--ink-3);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .api-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 13.5px;
        }
        .api-table th {
          text-align: left;
          padding: 9px 14px;
          background: var(--surface);
          border: 1px solid var(--line);
          color: var(--ink-3);
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-family: var(--font-mono);
          font-weight: 500;
        }
        .api-table td {
          padding: 11px 14px;
          border: 1px solid var(--line);
          color: var(--ink-2);
          vertical-align: top;
          line-height: 1.5;
        }
        .api-field {
          font-family: var(--font-mono);
          font-size: 12.5px;
          color: var(--accent);
          background: var(--accent-soft);
          padding: 2px 6px;
          border-radius: 3px;
          white-space: nowrap;
        }
        .api-type {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--ink-3);
          white-space: nowrap;
        }
        .api-code-block {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          overflow: hidden;
          margin-bottom: 20px;
        }
        .api-code-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
          border-bottom: 1px solid var(--line);
          background: var(--surface-2);
        }
        .api-copy-btn {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--ink-4);
          cursor: pointer;
          padding: 3px 8px;
          border: 1px solid var(--line);
          border-radius: 4px;
          transition: color 0.15s, border-color 0.15s;
        }
        .api-copy-btn:hover { color: var(--ink); border-color: var(--ink-3); }
        .api-code-block pre {
          margin: 0;
          padding: 20px;
          overflow-x: auto;
          font-family: var(--font-mono);
          font-size: 12.5px;
          line-height: 1.7;
          color: var(--ink-2);
        }
        .api-code-block code { font-family: inherit; }
        .api-inline-code {
          font-family: var(--font-mono);
          font-size: 12.5px;
          background: var(--surface-3);
          padding: 2px 6px;
          border-radius: 3px;
          color: var(--accent);
        }
        .api-errors { display: flex; flex-direction: column; gap: 8px; }
        .api-error-row {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 10px 16px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
        }
        .api-error-code {
          font-family: var(--font-mono);
          font-size: 12.5px;
          color: var(--danger);
          flex-shrink: 0;
          min-width: 36px;
        }
        @media (max-width: 800px) {
          .api-layout { grid-template-columns: 1fr; padding: 32px 20px; }
          .api-sidebar { display: none; }
        }
      `}</style>
    </div>
  );
}

export { ApiReference };
