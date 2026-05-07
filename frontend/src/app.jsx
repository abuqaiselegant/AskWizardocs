// Top-level app: session management, page routing, dark/light theme toggle

// Clear legacy tweaks key from old sessions
try { localStorage.removeItem("wd-tweaks"); } catch {}

const sb = window._supabase;

function App() {
  const [page, setPage]   = React.useState("landing");
  const [user, setUser]   = React.useState(null);
  const [ready, setReady] = React.useState(false); // true once session check completes
  const [theme, setTheme] = React.useState(() => {
    try { return localStorage.getItem("wd-theme") || "dark"; } catch { return "dark"; }
  });

  React.useEffect(() => {
    // Restore last page only after we know the session state
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        // If the user was mid-session, restore their last page (chat or profile)
        const last = localStorage.getItem("wd-page");
        setPage(last && ["chat", "profile"].includes(last) ? last : "chat");
      } else {
        // No session — always start on landing (never restore a protected page)
        setPage("landing");
      }
      setReady(true);
    });

    // Listen for sign-in / sign-out events (including OAuth redirect callback)
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUser(session.user);
        // After OAuth redirect land on home so user sees the authenticated nav
        if (event === "SIGNED_IN") setPage("landing");
      } else {
        setUser(null);
        setPage("landing");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  React.useEffect(() => {
    if (ready) localStorage.setItem("wd-page", page);
    window.scrollTo(0, 0);
  }, [page, ready]);

  React.useEffect(() => {
    document.body.dataset.theme  = theme;
    document.body.dataset.accent = "rose";
    document.body.dataset.motion = "low";
    try { localStorage.setItem("wd-theme", theme); } catch {}
  }, [theme]);

  const go = (p) => {
    // Protect chat and profile — redirect to signin if not authenticated
    if ((p === "chat" || p === "profile") && !user) {
      setPage("signin");
      return;
    }
    setPage(p);
  };

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  // Don't render anything until the initial session check resolves — prevents flash
  if (!ready) return null;

  return (
    <div>
      {page === "landing" && <Landing  go={go} theme={theme} toggleTheme={toggleTheme} user={user}/>}
      {page === "signin"  && <AuthShell go={go}/>}
      {page === "signup"  && <AuthShell go={go}/>}
      {page === "chat"    && <Chat     go={go} theme={theme} toggleTheme={toggleTheme} user={user}/>}
      {page === "profile" && <Profile  go={go} theme={theme} toggleTheme={toggleTheme} user={user}/>}
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
