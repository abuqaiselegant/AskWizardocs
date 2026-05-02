// Minimal, crisp line icons — 1.5 stroke, square endings
const Icon = ({ d, size = 18, stroke = 1.5, fill = "none", children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {d ? <path d={d} /> : children}
  </svg>
);

const I = {
  Book: (p) => <Icon {...p}><path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4z"/><path d="M4 16a4 4 0 0 1 4-4h10"/></Icon>,
  Send: (p) => <Icon {...p}><path d="M4 12 20 4l-6 16-3-7-7-1z"/></Icon>,
  Search: (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Icon>,
  Sparkle: (p) => <Icon {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></Icon>,
  Spark: (p) => <Icon {...p}><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z"/></Icon>,
  Bookmark: (p) => <Icon {...p}><path d="M6 3h12v18l-6-4-6 4z"/></Icon>,
  Clock: (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>,
  Settings: (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></Icon>,
  Plus: (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>,
  Arrow: (p) => <Icon {...p}><path d="M5 12h14M13 5l7 7-7 7"/></Icon>,
  ArrowUp: (p) => <Icon {...p}><path d="M12 19V5M5 12l7-7 7 7"/></Icon>,
  Upload: (p) => <Icon {...p}><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3M12 3v12M7 8l5-5 5 5"/></Icon>,
  User: (p) => <Icon {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></Icon>,
  Logo: ({ size = 28, ...rest }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" {...rest}>
      <defs>
        <linearGradient id="lg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.3"/>
          <stop offset="1" stopColor="currentColor" stopOpacity="1"/>
        </linearGradient>
      </defs>
      <rect x="5" y="4" width="14" height="24" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <rect x="9" y="7" width="14" height="24" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="url(#lg)" opacity="0.2"/>
      <path d="M9 7v24" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="22" cy="11" r="2.5" fill="currentColor"/>
    </svg>
  ),
  Check: (p) => <Icon {...p}><path d="m5 12 5 5 9-11"/></Icon>,
  Copy: (p) => <Icon {...p}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></Icon>,
  Thumb: (p) => <Icon {...p}><path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 4 0v5h5a2 2 0 0 1 2 2.4l-1.6 7A2 2 0 0 1 16.4 20H7"/></Icon>,
  File: (p) => <Icon {...p}><path d="M7 3h8l5 5v13H7z"/><path d="M14 3v6h6"/></Icon>,
  Cite: (p) => <Icon {...p}><path d="M7 7h4v4a4 4 0 0 1-4 4M15 7h4v4a4 4 0 0 1-4 4"/></Icon>,
  Menu: (p) => <Icon {...p}><path d="M4 6h16M4 12h16M4 18h16"/></Icon>,
  X: (p) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18"/></Icon>,
  Github: (p) => <Icon {...p} fill="currentColor" stroke="none"><path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.2.8-.6v-2.1c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0C17 4.9 18 5.2 18 5.2c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z"/></Icon>,
  Google: (p) => <Icon {...p} fill="currentColor" stroke="none"><path d="M21.35 11.1H12v3.24h5.35c-.23 1.24-1.58 3.65-5.35 3.65-3.22 0-5.85-2.67-5.85-5.96S8.78 6.07 12 6.07c1.83 0 3.06.78 3.77 1.46l2.57-2.47C16.75 3.56 14.6 2.5 12 2.5 6.95 2.5 2.9 6.55 2.9 11.6S6.95 20.7 12 20.7c6.93 0 9.5-4.87 9.5-7.33 0-.49-.05-.87-.15-1.27z"/></Icon>,
  Shield: (p) => <Icon {...p}><path d="M12 3 4 6v6c0 4.5 3.5 8.5 8 9 4.5-.5 8-4.5 8-9V6z"/></Icon>,
  Zap: (p) => <Icon {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></Icon>,
  Layers: (p) => <Icon {...p}><path d="m12 3 9 5-9 5-9-5zM3 14l9 5 9-5M3 19l9 5 9-5"/></Icon>,
  Chevron: (p) => <Icon {...p}><path d="m9 6 6 6-6 6"/></Icon>,
  Dot: (p) => <Icon {...p}><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></Icon>,
  Sun: (p) => <Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></Icon>,
  Moon: (p) => <Icon {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></Icon>,
};

window.I = I;
