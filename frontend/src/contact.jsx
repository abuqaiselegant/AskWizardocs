// Contact page — email + form

function Contact({ go, theme, toggleTheme, user }) {
  const [form, setForm] = React.useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = React.useState(null); // null | "sending" | "sent" | "error"

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setStatus("sending");

    // mailto fallback — opens default email client with pre-filled content
    // Replace with a backend endpoint or Formspree when ready
    const subject = encodeURIComponent(form.subject || "Contact from Wizardocs");
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`
    );
    window.location.href = `mailto:aqaisnotts@gmail.com?subject=${subject}&body=${body}`;
    setStatus("sent");
  };

  return (
    <div style={{minHeight:"100vh", background:"var(--bg)"}}>
      <Nav go={go} theme={theme} toggleTheme={toggleTheme} user={user} />

      <div className="contact-layout">

        {/* Left — info */}
        <div className="contact-info">
          <span className="mono" style={{fontSize:11, color:"var(--accent)", letterSpacing:"0.12em"}}>CONTACT</span>
          <h1 className="contact-title">Get in touch</h1>
          <p style={{color:"var(--ink-3)", fontSize:16, lineHeight:1.7, marginBottom:40}}>
            Questions, feedback, or partnership ideas — reach out directly.
            We read every message.
          </p>

          <div className="contact-channels">
            <a href="mailto:aqaisnotts@gmail.com" className="contact-channel">
              <div className="contact-channel-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </div>
              <div>
                <div style={{fontSize:13, color:"var(--ink-3)", marginBottom:4}}>Email</div>
                <div style={{fontSize:15, color:"var(--ink)", fontWeight:500}}>aqaisnotts@gmail.com</div>
              </div>
            </a>

            <a href="https://github.com/abuqaiselegant/AskWizardocs" target="_blank" rel="noreferrer" className="contact-channel">
              <div className="contact-channel-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
              </div>
              <div>
                <div style={{fontSize:13, color:"var(--ink-3)", marginBottom:4}}>GitHub</div>
                <div style={{fontSize:15, color:"var(--ink)", fontWeight:500}}>abuqaiselegant/AskWizardocs ↗</div>
              </div>
            </a>
          </div>

          <div className="contact-response-note mono" style={{fontSize:12, color:"var(--ink-4)", marginTop:40}}>
            Typical response time: 1–2 business days.
          </div>
        </div>

        {/* Right — form */}
        <div className="contact-form-wrap">
          {status === "sent" ? (
            <div className="contact-success">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--good)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <h2>Message sent</h2>
              <p>Your email client should have opened with the pre-filled message. If it didn't, email us directly at <a href="mailto:aqaisnotts@gmail.com" style={{color:"var(--accent)"}}>aqaisnotts@gmail.com</a>.</p>
              <button className="btn primary" onClick={() => setStatus(null)} style={{marginTop:24}}>Send another</button>
            </div>
          ) : (
            <form className="contact-form" onSubmit={submit}>
              <div className="contact-form-row">
                <div className="contact-field">
                  <label>Name <span style={{color:"var(--accent)"}}>*</span></label>
                  <input
                    type="text"
                    placeholder="Your name"
                    value={form.name}
                    onChange={set("name")}
                    required
                  />
                </div>
                <div className="contact-field">
                  <label>Email <span style={{color:"var(--accent)"}}>*</span></label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={set("email")}
                    required
                  />
                </div>
              </div>

              <div className="contact-field">
                <label>Subject</label>
                <input
                  type="text"
                  placeholder="What's this about?"
                  value={form.subject}
                  onChange={set("subject")}
                />
              </div>

              <div className="contact-field">
                <label>Message <span style={{color:"var(--accent)"}}>*</span></label>
                <textarea
                  rows={6}
                  placeholder="Tell us what's on your mind..."
                  value={form.message}
                  onChange={set("message")}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn primary"
                disabled={status === "sending" || !form.name || !form.email || !form.message}
                style={{width:"100%", justifyContent:"center"}}
              >
                {status === "sending" ? "Opening email client…" : "Send message"}
              </button>

              <p style={{fontSize:12, color:"var(--ink-4)", marginTop:12, textAlign:"center", fontFamily:"var(--font-mono)"}}>
                Submitting opens your email client with this message pre-filled.
              </p>
            </form>
          )}
        </div>
      </div>

      <Footer go={go} />

      <style>{`
        .contact-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          max-width: 1100px;
          margin: 0 auto;
          padding: 80px 32px 120px;
          gap: 80px;
          align-items: start;
        }
        .contact-title {
          font-family: var(--font-display);
          font-size: 42px;
          font-weight: 600;
          letter-spacing: -0.025em;
          margin: 16px 0 20px;
        }
        .contact-channels { display: flex; flex-direction: column; gap: 16px; }
        .contact-channel {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px 20px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          color: inherit;
          transition: border-color 0.15s, background 0.15s;
        }
        .contact-channel:hover { border-color: var(--line-2); background: var(--surface-2); }
        .contact-channel-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--surface-3);
          border: 1px solid var(--line);
          border-radius: 8px;
          color: var(--accent);
          flex-shrink: 0;
        }
        .contact-form-wrap {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 40px;
        }
        .contact-form { display: flex; flex-direction: column; gap: 20px; }
        .contact-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .contact-field { display: flex; flex-direction: column; gap: 8px; }
        .contact-field label {
          font-size: 13px;
          font-weight: 500;
          color: var(--ink-2);
          letter-spacing: 0.01em;
        }
        .contact-field input, .contact-field textarea {
          background: var(--bg);
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
          padding: 11px 14px;
          font-size: 14px;
          color: var(--ink);
          outline: none;
          transition: border-color 0.15s;
          resize: vertical;
        }
        .contact-field input::placeholder, .contact-field textarea::placeholder { color: var(--ink-4); }
        .contact-field input:focus, .contact-field textarea:focus { border-color: var(--accent); }
        .contact-success {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 24px 0;
          gap: 12px;
        }
        .contact-success h2 {
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 600;
          margin: 0;
        }
        .contact-success p { color: var(--ink-3); font-size: 15px; line-height: 1.7; margin: 0; }
        @media (max-width: 800px) {
          .contact-layout { grid-template-columns: 1fr; padding: 48px 20px 80px; gap: 40px; }
          .contact-form-row { grid-template-columns: 1fr; }
          .contact-form-wrap { padding: 24px; }
        }
      `}</style>
    </div>
  );
}
