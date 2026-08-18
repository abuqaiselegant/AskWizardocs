// Top-level app: session management, page routing, dark/light theme toggle
import React from "react";
import { sb } from "./supabase.js";
import { Landing } from "./landing.jsx";
import { AuthShell } from "./auth.jsx";
import { Chat } from "./chat.jsx";
import { Profile } from "./profile.jsx";
import { Docs } from "./docs.jsx";
import { ApiReference } from "./api_reference.jsx";
import { Manifesto } from "./manifesto.jsx";
import { Contact } from "./contact.jsx";

// Clear legacy tweaks key from old sessions
try { localStorage.removeItem("wd-tweaks"); } catch {}

function App() {
  const [page, setPage]   = React.useState("landing");
  const [user, setUser]   = React.useState(null);
  const [ready, setReady] = React.useState(false); // true once session check completes
  const [theme, setTheme] = React.useState(() => {
    try { return localStorage.getItem("wd-theme") || "dark"; } catch { return "dark"; }
  });

  React.useEffect(() => {
    // Single source of truth — no getSession() to avoid race conditions.
    // onAuthStateChange fires INITIAL_SESSION synchronously on mount.
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        // Startup: restore last page for logged-in users, landing for guests
        if (session) {
          setUser(session.user);
          const last = localStorage.getItem("wd-page");
          setPage(last && ["chat", "profile"].includes(last) ? last : "chat");
        } else {
          setPage("landing");
        }
        setReady(true);
      } else if (event === "SIGNED_IN") {
        // Fires for both fresh OAuth login AND silent token refreshes on tab refocus.
        // Only navigate away if the user isn't already on a protected page.
        setUser(session.user);
        setPage(p => ["chat", "profile"].includes(p) ? p : "landing");
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setPage("landing");
      }
      // TOKEN_REFRESHED: silently update user, no page change
      if (event === "TOKEN_REFRESHED" && session) {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  React.useEffect(() => {
    // Only persist pages that make sense to restore on next visit
    if (ready && ["chat", "profile"].includes(page)) {
      localStorage.setItem("wd-page", page);
    }
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
      {page === "landing"       && <Landing      go={go} theme={theme} toggleTheme={toggleTheme} user={user}/>}
      {["signin", "signup"].includes(page) && <AuthShell go={go}/>}
      {page === "chat"          && <Chat         go={go} theme={theme} toggleTheme={toggleTheme} user={user}/>}
      {page === "profile"       && <Profile      go={go} theme={theme} toggleTheme={toggleTheme} user={user}/>}
      {page === "docs"          && <Docs         go={go} theme={theme} toggleTheme={toggleTheme} user={user}/>}
      {page === "api_reference" && <ApiReference go={go} theme={theme} toggleTheme={toggleTheme} user={user}/>}
      {page === "manifesto"     && <Manifesto    go={go} theme={theme} toggleTheme={toggleTheme} user={user}/>}
      {page === "contact"       && <Contact      go={go} theme={theme} toggleTheme={toggleTheme} user={user}/>}
    </div>
  );
}

export { App };
