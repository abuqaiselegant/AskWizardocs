// Shared primitives: Nav, Footer, BookShelf animation, Tweaks panel, Toast

const NAV_LINKS = [
  { id: "features", label: "Features" },
  { id: "howitworks", label: "How it works" },
  { id: "pricing", label: "Pricing" },
  { id: "docs", label: "Docs" },
];

function Nav({ page, go, user }) {
  return (
    <nav className="wd-nav">
      <button className="wd-logo" onClick={() => go("landing")}>
        <I.Logo size={26} style={{color: "var(--accent)"}} />
        <span>Wizardocs<span style={{color:"var(--accent)"}}>.</span></span>
      </button>
      <div className="wd-nav-links">
        {NAV_LINKS.map(l => <a key={l.id} href={`#${l.id}`}>{l.label}</a>)}
      </div>
      <div className="wd-nav-actions">
        <button className="btn ghost" onClick={() => go("signin")}>Sign in</button>
        <button className="btn primary" onClick={() => go("signup")}>Get started <I.Arrow size={14}/></button>
      </div>
      <style>{`
        .wd-nav {
          position: sticky; top: 0; z-index: 50;
          display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
          padding: 16px 32px;
          backdrop-filter: blur(20px) saturate(1.2);
          background: color-mix(in oklab, var(--bg) 70%, transparent);
          border-bottom: 1px solid var(--line);
        }
        .wd-logo {
          display: inline-flex; align-items: center; gap: 10px;
          font-family: var(--font-display); font-weight: 600; font-size: 17px;
          letter-spacing: -0.01em;
        }
        .wd-nav-links { display:flex; gap: 28px; justify-self: center; }
        .wd-nav-links a {
          font-size: 14px; color: var(--ink-2);
          transition: color .15s;
        }
        .wd-nav-links a:hover { color: var(--ink); }
        .wd-nav-actions { display:flex; gap: 10px; justify-self: end; align-items:center; }
        @media (max-width: 880px) {
          .wd-nav { grid-template-columns: 1fr auto; padding: 14px 20px; }
          .wd-nav-links { display:none; }
        }
      `}</style>
    </nav>
  );
}

// Tweaks panel — exposed when host toggles edit mode
function TweaksPanel({ open, onClose, tweaks, setTweaks }) {
  if (!open) return null;
  const accents = ["violet", "blue", "emerald", "amber", "rose"];
  const swatch = { violet:"#8b7cf6", blue:"#6aa8ff", emerald:"#5ad1a4", amber:"#f2b06b", rose:"#f07c9e" };
  return (
    <div className="tweaks">
      <div className="tweaks-head">
        <div className="mono" style={{fontSize:11, letterSpacing:"0.1em", color:"var(--ink-3)"}}>TWEAKS</div>
        <button onClick={onClose} aria-label="Close"><I.X size={14}/></button>
      </div>
      <div className="tweaks-row">
        <label>Theme</label>
        <div className="seg">
          {["dark","light"].map(t => (
            <button key={t} className={tweaks.theme===t ? "on" : ""} onClick={() => setTweaks({theme:t})}>{t}</button>
          ))}
        </div>
      </div>
      <div className="tweaks-row">
        <label>Accent</label>
        <div className="swatches">
          {accents.map(a => (
            <button key={a} className={"sw " + (tweaks.accent===a?"on":"")} style={{background: swatch[a]}} onClick={() => setTweaks({accent:a})} aria-label={a}/>
          ))}
        </div>
      </div>
      <div className="tweaks-row">
        <label>Motion</label>
        <div className="seg">
          {["full","low","none"].map(m => (
            <button key={m} className={tweaks.motion===m ? "on" : ""} onClick={() => setTweaks({motion:m})}>{m}</button>
          ))}
        </div>
      </div>
      <style>{`
        .tweaks {
          position: fixed; right: 20px; bottom: 20px; z-index: 200;
          width: 280px;
          background: var(--surface);
          border: 1px solid var(--line-2);
          border-radius: 14px;
          padding: 14px;
          box-shadow: 0 30px 80px rgba(0,0,0,0.45), 0 0 0 1px var(--line);
          animation: pageIn .25s ease both;
        }
        .tweaks-head { display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px; }
        .tweaks-row { display:flex; justify-content: space-between; align-items:center; padding: 8px 0; border-top: 1px dashed var(--line); }
        .tweaks-row:nth-child(2) { border-top: 0; }
        .tweaks-row label { font-size: 13px; color: var(--ink-2); }
        .seg { display:inline-flex; background: var(--bg); border:1px solid var(--line); border-radius: 8px; padding: 2px; }
        .seg button {
          padding: 5px 10px; font-size: 12px; border-radius: 6px; color: var(--ink-2);
          font-family: var(--font-mono);
        }
        .seg button.on { background: var(--surface-3); color: var(--ink); }
        .swatches { display:inline-flex; gap: 6px; }
        .sw {
          width: 20px; height: 20px; border-radius: 50%;
          outline: 2px solid transparent; outline-offset: 2px;
          transition: outline-color .15s;
        }
        .sw.on { outline-color: var(--ink); }
      `}</style>
    </div>
  );
}

// Cartoony animated book scene — hand-drawn feel, wobbly books with faces,
// a big "wizard tome" that opens and shoots pages while bouncing on a shelf.
function BookShelf({ intensity = "full" }) {
  // Cartoony shelf books — bright tones, thick outlines, wobbly vibes
  const shelfBooks = [
    { x: 18,  h: 90,  w: 22, tone: "#e9a36b", tilt: -3, bob: 0.0 },
    { x: 42,  h: 110, w: 24, tone: "#6fb3c9", tilt:  2, bob: 0.2 },
    { x: 68,  h: 82,  w: 20, tone: "#c17ad1", tilt: -1, bob: 0.4 },
    { x: 92,  h: 120, w: 26, tone: "#e4cb6a", tilt:  4, bob: 0.1 },
    { x: 120, h: 96,  w: 22, tone: "#8a7ff0", tilt: -2, bob: 0.5 },
    { x: 144, h: 108, w: 24, tone: "#d96a86", tilt:  1, bob: 0.3 },
    // leaning book
    { x: 172, h: 100, w: 22, tone: "#74c99a", tilt: 14, bob: 0.0, lean: true },
    { x: 198, h: 88,  w: 20, tone: "#e9a36b", tilt: -2, bob: 0.45 },
    // right cluster
    { x: 280, h: 104, w: 24, tone: "#6fb3c9", tilt:  3, bob: 0.15 },
    { x: 306, h: 92,  w: 22, tone: "#c17ad1", tilt: -4, bob: 0.35 },
    { x: 330, h: 118, w: 26, tone: "#e4cb6a", tilt:  1, bob: 0.25 },
    { x: 358, h: 96,  w: 22, tone: "#d96a86", tilt: -2, bob: 0.5 },
  ];
  // Stacked books on lower shelf
  const stack = [
    { y: 0, w: 160, tone: "#8a7ff0", tilt:  2 },
    { y: 22, w: 140, tone: "#e9a36b", tilt: -3 },
    { y: 44, w: 170, tone: "#74c99a", tilt:  1 },
    { y: 66, w: 130, tone: "#d96a86", tilt: -2 },
  ];

  return (
    <div className={"shelf " + (intensity==="none"?"no-anim":"")}>
      <div className="shelf-scene">
        {/* Paper-grain background */}
        <div className="paper"/>
        <div className="paper-dots"/>

        <svg className="scene" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="wobble">
              <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="3"/>
              <feDisplacementMap in="SourceGraphic" scale="1.2"/>
            </filter>
            <linearGradient id="glowAcc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--accent-2)"/>
              <stop offset="100%" stopColor="var(--accent)"/>
            </linearGradient>
          </defs>

          {/* Floor shadow (subtle, no card frame) */}
          <ellipse cx="200" cy="370" rx="140" ry="6" fill="#000" opacity="0.25"/>

          {/* Shelf plank — top */}
          <g className="plank top">
            <rect x="20" y="200" width="360" height="10" rx="4" fill="#3a2a1c" stroke="#0a0a0f" strokeWidth="2.5"/>
            <rect x="20" y="200" width="360" height="3" fill="#d4a574" opacity="0.6"/>
          </g>

          {/* Top row of books — playful tilts, bounce */}
          <g className="row row-top">
            {shelfBooks.map((b, i) => (
              <g key={i} className={"cbook b" + i} style={{ animationDelay: `${b.bob}s`, transformOrigin: `${b.x + b.w/2}px 200px` }}
                 transform={`rotate(${b.tilt} ${b.x + b.w/2} ${200 - b.h/2})`}>
                <rect x={b.x} y={200 - b.h} width={b.w} height={b.h} rx="3"
                      fill={b.tone} stroke="#0a0a0f" strokeWidth="2.5"/>
                {/* spine bands */}
                <rect x={b.x + 2} y={200 - b.h + 10} width={b.w - 4} height="3" fill="rgba(0,0,0,0.25)"/>
                <rect x={b.x + 2} y={200 - 14} width={b.w - 4} height="3" fill="rgba(0,0,0,0.25)"/>
                {/* title bar */}
                <rect x={b.x + b.w*0.2} y={200 - b.h*0.55} width={b.w*0.6} height="2.5" fill="rgba(0,0,0,0.35)"/>
                <rect x={b.x + b.w*0.25} y={200 - b.h*0.5} width={b.w*0.5} height="2" fill="rgba(0,0,0,0.3)"/>
                {/* little highlight */}
                <rect x={b.x + 2} y={200 - b.h + 3} width="2.5" height={b.h - 6} fill="rgba(255,255,255,0.35)"/>
              </g>
            ))}
          </g>

          {/* Shelf plank — bottom */}
          <g className="plank bottom">
            <rect x="20" y="330" width="360" height="10" rx="4" fill="#3a2a1c" stroke="#0a0a0f" strokeWidth="2.5"/>
            <rect x="20" y="330" width="360" height="3" fill="#d4a574" opacity="0.6"/>
          </g>

          {/* Stacked books (left side of bottom shelf) */}
          <g className="stack">
            {stack.map((s, i) => (
              <g key={i} className="sb" style={{animationDelay: `${i*0.08}s`}} transform={`rotate(${s.tilt} ${60 + s.w/2} ${324 - s.y})`}>
                <rect x={60} y={324 - s.y - 18} width={s.w} height="18" rx="3"
                      fill={s.tone} stroke="#0a0a0f" strokeWidth="2.5"/>
                <rect x={62} y={324 - s.y - 14} width={s.w - 4} height="2" fill="rgba(0,0,0,0.3)"/>
                <rect x={62} y={324 - s.y - 7} width={s.w - 4} height="2" fill="rgba(0,0,0,0.3)"/>
              </g>
            ))}
            {/* sleepy book with Zzz */}
            <g className="zzz">
              <text x={230} y={280} fontFamily="Fraunces, serif" fontStyle="italic" fontSize="18" fill="var(--accent-2)" opacity="0.7">z</text>
              <text x={240} y={268} fontFamily="Fraunces, serif" fontStyle="italic" fontSize="14" fill="var(--accent-2)" opacity="0.5">z</text>
              <text x={246} y={258} fontFamily="Fraunces, serif" fontStyle="italic" fontSize="10" fill="var(--accent-2)" opacity="0.4">z</text>
            </g>
          </g>

          {/* A couple of wobbling single books on bottom shelf right */}
          <g className="cbook br0" transform="rotate(-3 280 290)">
            <rect x="268" y="240" width="24" height="90" rx="3" fill="#6fb3c9" stroke="#0a0a0f" strokeWidth="2.5"/>
            <rect x="270" y="250" width="20" height="2.5" fill="rgba(0,0,0,0.3)"/>
            <rect x="270" y="320" width="20" height="2.5" fill="rgba(0,0,0,0.3)"/>
          </g>
          <g className="cbook br1" transform="rotate(4 320 290)">
            <rect x="306" y="252" width="26" height="78" rx="3" fill="#e4cb6a" stroke="#0a0a0f" strokeWidth="2.5"/>
            <rect x="308" y="260" width="22" height="2.5" fill="rgba(0,0,0,0.3)"/>
          </g>
          <g className="cbook br2" transform="rotate(-2 355 290)">
            <rect x="343" y="232" width="24" height="98" rx="3" fill="#c17ad1" stroke="#0a0a0f" strokeWidth="2.5"/>
            <rect x="345" y="244" width="20" height="2.5" fill="rgba(0,0,0,0.3)"/>
            <rect x="345" y="320" width="20" height="2.5" fill="rgba(0,0,0,0.3)"/>
          </g>

          {/* THE WIZARD TOME — hero book, bouncing + opening */}
          <g className="tome" transform="translate(180 110)">
            {/* glow */}
            <circle cx="20" cy="50" r="60" fill="var(--accent)" opacity="0.25" className="tome-aura"/>
            <circle cx="20" cy="50" r="46" fill="var(--accent)" opacity="0.35" className="tome-aura tome-aura-2"/>

            {/* pages fan behind */}
            <g className="pages">
              <rect x="-8" y="6" width="56" height="84" rx="3" fill="#fbf1d6" stroke="#0a0a0f" strokeWidth="2.5" transform="rotate(-6 20 48)"/>
              <rect x="-4" y="8" width="52" height="80" rx="3" fill="#fdf6e4" stroke="#0a0a0f" strokeWidth="2.5" transform="rotate(-2 20 48)"/>
            </g>

            {/* left cover */}
            <g className="cover-l">
              <path d="M 22 4 L -4 4 Q -10 4 -10 10 L -10 86 Q -10 92 -4 92 L 22 92 Z"
                    fill="url(#glowAcc)" stroke="#0a0a0f" strokeWidth="2.5"/>
              {/* star emblem */}
              <g transform="translate(6 48)" className="emblem">
                <path d="M 0 -10 L 2.5 -3 L 10 -3 L 4 1.5 L 6.5 9 L 0 4.5 L -6.5 9 L -4 1.5 L -10 -3 L -2.5 -3 Z"
                      fill="#fbf1d6" stroke="#0a0a0f" strokeWidth="1.5" strokeLinejoin="round"/>
              </g>
            </g>

            {/* right cover (opens) */}
            <g className="cover-r">
              <path d="M 22 4 L 48 4 Q 54 4 54 10 L 54 86 Q 54 92 48 92 L 22 92 Z"
                    fill="url(#glowAcc)" stroke="#0a0a0f" strokeWidth="2.5"/>
              {/* lines on inside page, visible when open */}
              <g className="page-lines" opacity="0">
                <rect x="26" y="16" width="24" height="2" rx="1" fill="#0a0a0f" opacity="0.35"/>
                <rect x="26" y="22" width="20" height="2" rx="1" fill="#0a0a0f" opacity="0.25"/>
                <rect x="26" y="28" width="22" height="2" rx="1" fill="#0a0a0f" opacity="0.3"/>
                <rect x="26" y="36" width="18" height="2" rx="1" fill="#0a0a0f" opacity="0.25"/>
              </g>
            </g>

            {/* Spine + cute face */}
            <g className="spine-face">
              <rect x="18" y="4" width="8" height="88" fill="#6a5bd4" stroke="#0a0a0f" strokeWidth="2"/>
              <circle cx="22" cy="44" r="1.2" fill="#0a0a0f" className="eye"/>
              <circle cx="22" cy="54" r="1.2" fill="#0a0a0f" className="eye"/>
            </g>

            {/* Flying sparkles emerging from the open page */}
            <g className="sparkles">
              <g className="spark s1"><path d="M 0 0 L 1 -3 L 2 0 L 5 1 L 2 2 L 1 5 L 0 2 L -3 1 Z" fill="#fff" opacity="0.9"/></g>
              <g className="spark s2"><path d="M 0 0 L 1 -3 L 2 0 L 5 1 L 2 2 L 1 5 L 0 2 L -3 1 Z" fill="var(--accent-2)" opacity="0.9"/></g>
              <g className="spark s3"><path d="M 0 0 L 1 -3 L 2 0 L 5 1 L 2 2 L 1 5 L 0 2 L -3 1 Z" fill="#fbf1d6" opacity="0.9"/></g>
              <g className="spark s4"><path d="M 0 0 L 1 -3 L 2 0 L 5 1 L 2 2 L 1 5 L 0 2 L -3 1 Z" fill="#fff" opacity="0.9"/></g>
              <g className="spark s5"><path d="M 0 0 L 1 -3 L 2 0 L 5 1 L 2 2 L 1 5 L 0 2 L -3 1 Z" fill="var(--accent)" opacity="0.9"/></g>
            </g>
          </g>

          {/* Little speech bubble */}
          <g className="bubble">
            <path d="M 300 80 Q 300 66 314 66 L 360 66 Q 374 66 374 80 L 374 96 Q 374 110 360 110 L 328 110 L 320 120 L 322 110 L 314 110 Q 300 110 300 96 Z"
                  fill="#fbf1d6" stroke="#0a0a0f" strokeWidth="2.5"/>
            <circle cx="317" cy="88" r="2" fill="#0a0a0f"/>
            <circle cx="327" cy="88" r="2" fill="#0a0a0f"/>
            <circle cx="337" cy="88" r="2" fill="#0a0a0f"/>
            <path d="M 315 98 Q 325 104 337 98" stroke="#0a0a0f" strokeWidth="2" fill="none" strokeLinecap="round"/>
          </g>

          {/* Tiny bouncing bookworm */}
          <g className="worm">
            <circle cx="90" cy="324" r="5" fill="#74c99a" stroke="#0a0a0f" strokeWidth="2"/>
            <circle cx="100" cy="322" r="6" fill="#74c99a" stroke="#0a0a0f" strokeWidth="2"/>
            <circle cx="111" cy="324" r="5" fill="#74c99a" stroke="#0a0a0f" strokeWidth="2"/>
            <circle cx="98" cy="320" r="0.8" fill="#0a0a0f"/>
            <circle cx="102" cy="320" r="0.8" fill="#0a0a0f"/>
            <path d="M 106 318 L 108 314 M 110 318 L 113 315" stroke="#0a0a0f" strokeWidth="1.2" strokeLinecap="round"/>
          </g>

          {/* Twinkles scattered around */}
          <g className="twinkles">
            {[[330,40,0.6],[360,160,1.2],[50,180,1.8],[200,50,0.9]].map((t, i) => (
              <g key={i} transform={`translate(${t[0]} ${t[1]})`} className="tw" style={{animationDelay: `${t[2]}s`}}>
                <path d="M 0 -6 L 1.5 -1.5 L 6 0 L 1.5 1.5 L 0 6 L -1.5 1.5 L -6 0 L -1.5 -1.5 Z"
                      fill="var(--accent-2)"/>
              </g>
            ))}
          </g>
        </svg>
      </div>
      <style>{`
        .shelf {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          max-width: 560px;
          margin-inline: auto;
        }
        .shelf-scene {
          position: absolute; inset: 0;
          background: transparent;
          border: 0;
          overflow: visible;
        }
        .paper { display: none; }
        .paper-dots {
          position:absolute; inset: 0;
          background-image: radial-gradient(color-mix(in oklab, var(--ink) 18%, transparent) 1px, transparent 1px);
          background-size: 26px 26px;
          opacity: 0.5;
          mask-image: radial-gradient(ellipse 60% 55% at center, black 20%, transparent 75%);
          pointer-events: none;
        }
        .scene { position: absolute; inset: 0; width: 100%; height: 100%; }

        /* Book wobble */
        .cbook { animation: wobble 3.5s ease-in-out infinite; transform-box: fill-box; transform-origin: bottom center; }
        .cbook.b1 { animation-duration: 3.1s; }
        .cbook.b3 { animation-duration: 4.2s; }
        .cbook.b5 { animation-duration: 3.8s; }
        .cbook.b7 { animation-duration: 3.3s; }
        .cbook.b9 { animation-duration: 4.0s; }
        @keyframes wobble {
          0%, 100% { transform: translateY(0) rotate(var(--r, 0deg)); }
          50%      { transform: translateY(-3px); }
        }

        /* Stack breathes */
        .sb { transform-box: fill-box; transform-origin: bottom center; animation: breathe 4s ease-in-out infinite; }
        @keyframes breathe {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-1.5px); }
        }

        /* Zzz floats up */
        .zzz text { animation: zFloat 3s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .zzz text:nth-child(2) { animation-delay: 0.4s; }
        .zzz text:nth-child(3) { animation-delay: 0.8s; }
        @keyframes zFloat {
          0%, 100% { transform: translateY(0); opacity: 0.3; }
          50%      { transform: translateY(-6px); opacity: 0.8; }
        }

        /* Bookworm wiggles across */
        .worm { animation: wormMove 8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes wormMove {
          0%   { transform: translateX(0) translateY(0); }
          25%  { transform: translateX(40px) translateY(-2px); }
          50%  { transform: translateX(90px) translateY(0); }
          75%  { transform: translateX(150px) translateY(-2px); }
          100% { transform: translateX(220px) translateY(0); }
        }

        /* Twinkles pulse */
        .tw { transform-box: fill-box; transform-origin: center; animation: twinkle 2.2s ease-in-out infinite; }
        @keyframes twinkle {
          0%, 100% { transform: scale(0.4); opacity: 0.3; }
          50%      { transform: scale(1); opacity: 1; }
        }

        /* THE TOME — bounces */
        .tome { transform-box: fill-box; transform-origin: 20px 92px; animation: bounce 2.2s cubic-bezier(.4,0,.2,1) infinite; }
        @keyframes bounce {
          0%, 100% { transform: translate(180px, 110px) rotate(0); }
          40%      { transform: translate(180px, 94px)  rotate(-3deg); }
          60%      { transform: translate(180px, 94px)  rotate(3deg); }
        }

        .tome-aura { transform-box: fill-box; transform-origin: center; animation: auraPulse 2.2s ease-in-out infinite; }
        .tome-aura-2 { animation-delay: 0.4s; }
        @keyframes auraPulse {
          0%, 100% { transform: scale(0.85); opacity: 0.2; }
          50%      { transform: scale(1.2);  opacity: 0.5; }
        }

        /* Right cover opens */
        .cover-r { transform-box: fill-box; transform-origin: 22px 48px; animation: openClose 3s ease-in-out infinite; }
        @keyframes openClose {
          0%, 10%, 90%, 100% { transform: rotateY(0deg); }
          40%, 60%           { transform: rotateY(-70deg); }
        }
        .page-lines { animation: pageShow 3s ease-in-out infinite; }
        @keyframes pageShow {
          0%, 20%, 80%, 100% { opacity: 0; }
          40%, 60%           { opacity: 1; }
        }

        /* Eyes blink */
        .eye { transform-box: fill-box; transform-origin: center; animation: blink2 4s ease-in-out infinite; }
        @keyframes blink2 {
          0%, 45%, 50%, 100% { transform: scaleY(1); }
          47%                { transform: scaleY(0.1); }
        }

        /* Sparkles fly out in arcs */
        .spark { transform-box: fill-box; transform-origin: center; opacity: 0; }
        .s1 { animation: spark1 2.4s ease-out infinite 0.2s; }
        .s2 { animation: spark2 2.4s ease-out infinite 0.5s; }
        .s3 { animation: spark3 2.4s ease-out infinite 0.8s; }
        .s4 { animation: spark4 2.4s ease-out infinite 1.1s; }
        .s5 { animation: spark5 2.4s ease-out infinite 1.4s; }
        @keyframes spark1 { 0% { transform: translate(30px, 40px) scale(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(90px, -30px) scale(1.2); opacity: 0; } }
        @keyframes spark2 { 0% { transform: translate(30px, 40px) scale(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(110px, 10px) scale(1); opacity: 0; } }
        @keyframes spark3 { 0% { transform: translate(30px, 40px) scale(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(70px, -60px) scale(1.3); opacity: 0; } }
        @keyframes spark4 { 0% { transform: translate(30px, 40px) scale(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(130px, -20px) scale(0.9); opacity: 0; } }
        @keyframes spark5 { 0% { transform: translate(30px, 40px) scale(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(50px, -50px) scale(1.1); opacity: 0; } }

        /* Speech bubble bob */
        .bubble { transform-box: fill-box; transform-origin: center; animation: bubbleBob 2s ease-in-out infinite; }
        @keyframes bubbleBob {
          0%, 100% { transform: translateY(0) rotate(0); }
          50%      { transform: translateY(-4px) rotate(-1deg); }
        }

        .no-anim * { animation: none !important; }
      `}</style>
    </div>
  );
}

// Floating parallax doc cards
function FloatingDocs({ intensity = "full" }) {
  const [mx, setMx] = React.useState(0);
  const [my, setMy] = React.useState(0);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (intensity === "none") return;
    const handle = (e) => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      setMx(((e.clientX - r.left) / r.width - 0.5) * 2);
      setMy(((e.clientY - r.top)  / r.height - 0.5) * 2);
    };
    window.addEventListener("mousemove", handle);
    return () => window.removeEventListener("mousemove", handle);
  }, [intensity]);

  const docs = [
    { t: "architecture.md",   tag: "markdown", lines: 6,  x:-42, y:-26, z:40, rot:-8 },
    { t: "rfc-0042.pdf",      tag: "pdf",      lines: 5,  x: 38, y:-34, z:60, rot:6 },
    { t: "users_table.sql",   tag: "sql",      lines: 4,  x:-38, y: 30, z:20, rot:4 },
    { t: "notion-export.zip", tag: "archive",  lines: 3,  x: 42, y: 24, z:30, rot:-5 },
    { t: "paper_2024.tex",    tag: "latex",    lines: 5,  x: 0,  y: 0,  z:80, rot:0 },
  ];

  return (
    <div ref={ref} className="floating-docs">
      {docs.map((d, i) => (
        <div key={i}
          className="fd"
          style={{
            transform: `translate3d(calc(${d.x}% + ${-mx*d.z/4}px), calc(${d.y}% + ${-my*d.z/4}px), 0) rotate(${d.rot + mx*2}deg)`,
            zIndex: d.z,
            animationDelay: `${i * 0.15}s`,
          }}>
          <div className="fd-head">
            <div className="fd-dot"/>
            <div className="mono" style={{fontSize:10, color:"var(--ink-3)"}}>{d.tag}</div>
          </div>
          <div className="mono" style={{fontSize:12, color:"var(--ink)", marginTop: 4}}>{d.t}</div>
          <div className="fd-body">
            {Array.from({length:d.lines}).map((_, j) => (
              <div key={j} className="fd-line" style={{width: `${40 + ((i+j)*17)%55}%`}}/>
            ))}
          </div>
        </div>
      ))}
      <style>{`
        .floating-docs {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          max-width: 560px;
          margin-inline: auto;
        }
        .fd {
          position: absolute; left: 50%; top: 50%;
          width: 190px;
          margin-left: -95px; margin-top: -60px;
          padding: 12px;
          background: linear-gradient(180deg, var(--surface-2), var(--surface));
          border: 1px solid var(--line-2);
          border-radius: 10px;
          box-shadow: 0 30px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px var(--line);
          transition: transform .35s cubic-bezier(.2,.8,.2,1);
          animation: fdFloat 6s ease-in-out infinite;
        }
        @keyframes fdFloat {
          0%, 100% { margin-top: -60px }
          50% { margin-top: -68px }
        }
        .fd-head { display:flex; align-items:center; gap:8px; }
        .fd-dot { width:6px; height:6px; border-radius:50%; background: var(--accent); box-shadow: 0 0 8px var(--accent); }
        .fd-body { margin-top: 10px; display: flex; flex-direction: column; gap: 5px; }
        .fd-line { height: 3px; border-radius: 2px; background: var(--line-2); }
      `}</style>
    </div>
  );
}

window.Nav = Nav;
window.TweaksPanel = TweaksPanel;
window.BookShelf = BookShelf;
window.FloatingDocs = FloatingDocs;
