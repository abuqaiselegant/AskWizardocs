"""
architecture.py — generates docs/architecture.svg (the POST /ask request path).

The diagram is generated rather than hand-drawn so the coordinates cannot drift:
edit the `stages` list below and re-run. Same reasoning as chunk_schema.py — one
writer, so the picture and the labels can't disagree with each other.

    python docs/architecture.py

Stdlib only. Colours are the product's own dark theme (frontend/index.html).
"""

W = 1180
C = dict(bg="#0d0d14", panel="#171722", panel2="#12121a", line="#2c2c3c",
         ink="#e8e6e0", ink2="#b8b6b0", ink3="#78767a",
         rose="#f07c9e", good="#7dd3a3", warn="#f5b57c",
         violet="#8b5cf6", teal="#2ca190", blue="#6aa8ff")

SANS = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif"
MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"

o = []
def esc(t): return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
def rect(x, y, w, h, fill, stroke=None, rx=10):
    s = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"'
    if stroke: s += f' stroke="{stroke}" stroke-width="1"'
    o.append(s + "/>")
def text(x, y, t, size=13, fill=C["ink2"], weight="400", font=SANS, anchor="start"):
    o.append(f'<text x="{x}" y="{y}" font-family="{font}" font-size="{size}" '
             f'font-weight="{weight}" fill="{fill}" text-anchor="{anchor}">{esc(t)}</text>')
def head_down(x, y, col):
    o.append(f'<path d="M {x-4.5} {y-7} L {x+4.5} {y-7} L {x} {y} Z" fill="{col}"/>')
def arrow_down(x, y1, y2, col):
    o.append(f'<path d="M {x} {y1} L {x} {y2-7}" stroke="{col}" stroke-width="1.6" fill="none"/>')
    head_down(x, y2, col)
def arrow_right(x1, x2, y, col, dashed=False):
    d = ' stroke-dasharray="4 4"' if dashed else ''
    o.append(f'<path d="M {x1} {y} L {x2-7} {y}" stroke="{col}" stroke-width="1.5" fill="none"{d}/>')
    o.append(f'<path d="M {x2-7} {y-4.5} L {x2-7} {y+4.5} L {x2} {y} Z" fill="{col}"/>')

PIPE_X, PIPE_W = 40, 600
EXT_X,  EXT_W  = 770, 370

stages = [
    ("1", "Verify the caller", C["rose"],
     ["api/auth.py — ES256 JWT, signing key fetched from JWKS"],
     ("Supabase Auth", "JWKS", C["good"])),
    ("2", "Gate the request", C["rose"],
     ["begin_ask() — ownership + plan + quota in ONE round trip",
      "ownership settles before the counter moves"],
     ("Supabase Postgres", "begin_ask()", C["good"])),
    ("3", "Hybrid retrieval", C["warn"],
     ["BM25 over 13,280 chunks, in-process  +  Chroma vector search",
      "RRF fusion (k=60) → top 20 candidates"],
     ("OpenAI", "text-embedding-3-small", C["blue"])),
    ("4", "Rerank", C["warn"],
     ["cross-encoder reads (query, chunk) pairs → top 20 becomes top 5",
      "fails safe: on Cohere error, keeps RRF order and drops the score"],
     ("Cohere", "rerank-english-v3.0", C["violet"])),
    ("5", "Generate", C["teal"],
     ["citation-strict prompt → answer with inline [N] markers",
      "parse [N] → cited sources; confidence = top rerank score"],
     ("OpenAI", "gpt-4o-mini", C["blue"])),
    ("6", "Persist", C["ink3"],
     ["save_messages() — non-fatal, logged; /ask refunds the quota on failure"],
     ("Supabase Postgres", "messages", C["good"])),
]

PAD_TOP, EDGE_H, GAP, DROP = 96, 62, 20, 62
def stage_h(details): return 62 + 19 * len(details)

y = PAD_TOP + EDGE_H + DROP
positions = []
for s in stages:
    h = stage_h(s[3]); positions.append((y, h)); y += h + GAP
last_bottom = positions[-1][0] + positions[-1][1]
H = last_bottom + 52

o.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
         f'viewBox="0 0 {W} {H}" role="img" '
         f'aria-label="Wizardocs request path for POST /ask">')
rect(0, 0, W, H, C["bg"], rx=0)

text(40, 44, "Wizardocs — the POST /ask request path", 19, C["ink"], "600")
text(40, 68, "React SPA on Vercel  →  Caddy + FastAPI on one EC2 box  →  Supabase, OpenAI, Cohere",
     13, C["ink3"])

edge = [("Browser", "React 18 + Vite · Vercel"),
        ("Caddy", "TLS · auto-renewed certs"),
        ("FastAPI", "uvicorn · EC2 t3.small")]
ew, egap = 300, 40
for i, (t, sub) in enumerate(edge):
    x = 40 + i * (ew + egap)
    rect(x, PAD_TOP, ew, EDGE_H, C["panel2"], C["line"])
    text(x + 18, PAD_TOP + 26, t, 14, C["ink"], "600")
    text(x + 18, PAD_TOP + 45, sub, 12, C["ink3"], font=MONO)
    if i < len(edge) - 1:
        arrow_right(x + ew + 8, x + ew + egap - 8, PAD_TOP + EDGE_H / 2, C["line"])

# Elbow from the FastAPI box across to the top of the pipeline. Drawn as one
# path so the corner stays square if the column widths ever change.
fx = 40 + 2 * (ew + egap) + ew / 2
px = PIPE_X + PIPE_W / 2
mid = PAD_TOP + EDGE_H + 26
o.append(f'<path d="M {fx} {PAD_TOP+EDGE_H+4} V {mid} H {px} V {positions[0][0]-7}" '
         f'stroke="{C["line"]}" stroke-width="1.6" fill="none"/>')
head_down(px, positions[0][0], C["line"])
text(fx - 14, mid - 9, "authenticated request", 11, C["ink3"], font=MONO, anchor="end")

for i, (s, (sy, sh)) in enumerate(zip(stages, positions)):
    num, title, accent, details, ext = s
    rect(PIPE_X, sy, PIPE_W, sh, C["panel"], C["line"])
    o.append(f'<path d="M {PIPE_X+1} {sy+11} L {PIPE_X+1} {sy+sh-11}" '
             f'stroke="{accent}" stroke-width="3" stroke-linecap="round"/>')
    text(PIPE_X + 22, sy + 28, num, 12, accent, "700", font=MONO)
    text(PIPE_X + 44, sy + 28, title, 15, C["ink"], "600")
    for j, d in enumerate(details):
        text(PIPE_X + 44, sy + 52 + j * 19, d, 12.5, C["ink2"], font=MONO)

    name, detail, col = ext
    eh = 46
    ey = sy + (sh - eh) / 2
    rect(EXT_X, ey, EXT_W, eh, C["panel2"], C["line"], rx=8)
    o.append(f'<circle cx="{EXT_X+18}" cy="{ey+eh/2}" r="4" fill="{col}"/>')
    text(EXT_X + 32, ey + 21, name, 12.5, C["ink"], "600")
    text(EXT_X + 32, ey + 37, detail, 11.5, C["ink3"], font=MONO)
    arrow_right(PIPE_X + PIPE_W + 8, EXT_X - 8, sy + sh / 2, C["line"], dashed=True)

    if i < len(stages) - 1:
        arrow_down(px, sy + sh + 3, positions[i + 1][0] - 3, C["line"])

ry = last_bottom + 26
o.append(f'<path d="M {px} {ry-23} L {px} {ry-6}" stroke="{C["rose"]}" stroke-width="1.6"/>')
head_down(px, ry + 1, C["rose"])
text(px + 14, ry - 4, "200  ·  answer, sources[], confidence, followups[]", 12, C["rose"], font=MONO)
text(EXT_X, ry - 4, "dashed = network call off the box", 11, C["ink3"], font=MONO)

o.append("</svg>")
open("docs/architecture.svg", "w").write("\n".join(o))
print(f"wrote docs/architecture.svg  ({W}x{H})")
