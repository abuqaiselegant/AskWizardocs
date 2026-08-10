# Deploying Wizardocs

The complete, end-to-end plan to take Wizardocs live on AWS with a real domain
and HTTPS.

## Architecture (what runs where)

Split deployment: the React frontend is a Vite-built static site on **Vercel**;
the FastAPI backend is **API-only** on **AWS**.

```
Frontend — Vercel (free, global CDN)
  your-domain.com   ·   Vite-built React (static files)
     │  fetch()  ───────────────────────────▶  Backend — AWS EC2 t3.small
     │                                           api.your-domain.com
     │                                           Caddy (:443, auto-HTTPS)
     │                                             └▶ FastAPI (:8000, internal)
     │                                                  ├─ API only (/ask, /chats, /profile)
     │                                                  ├─ corpus baked in (~260 MB)
     │  Supabase JS (Google OAuth)                      └─▶ OpenAI / Cohere APIs
     ▼                                                         │ REST
  Supabase (Postgres + Auth) ◀───────────────────────────────┘
```

- **Frontend → Vercel** (Vite build). Free Hobby tier, auto-deploy on `git push`.
- **Backend → AWS**, two containers (`docker-compose.prod.yml`): `api` + `caddy`,
  on the **`api.` subdomain**. Backend no longer serves the frontend.
- **Two origins**, so: `VITE_API_BASE` points the frontend at the API, backend
  CORS is scoped to the Vercel origin, and Supabase Auth URLs use the Vercel domain.
- **User data lives in Supabase**; the VM is stateless and disposable.
- **Compute:** AWS EC2 `t3.small` (2 GB). Warm footprint ~365 MB → clean headroom.
  ~$15/mo (≈6 months on the $100 credit).

> **Lightsail instead of EC2?** Backend steps are identical except: "security
> group" → Lightsail "Networking / firewall" tab, "Elastic IP" → Lightsail
> "static IP". Pick a 2 GB bundle. All Docker steps are the same.

> **Why the backend still needs HTTPS + a subdomain:** an HTTPS page on Vercel
> cannot call an `http://` backend (browsers block mixed content), so the API
> must be reachable at `https://api.your-domain.com` — hence Caddy stays.

---

## Fill these in before you start

| Placeholder | Your value | Where you get it |
|---|---|---|
| `DOMAIN` | `________________` | Register in Step 1 (root domain → Vercel frontend) |
| `API_DOMAIN` | `api.<DOMAIN>` | Subdomain for the AWS backend |
| `ELASTIC_IP` | `________________` | Allocated in Step 3 |
| `KEY.pem` | `________________` | Downloaded in Step 2 |

Two hostnames: **`DOMAIN`** (your-domain.com) serves the **frontend from Vercel**;
**`API_DOMAIN`** (api.your-domain.com) serves the **backend from AWS**.

You already have the 6 backend secrets locally in `.env`: `OPENAI_API_KEY`,
`COHERE_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_JWT_SECRET`. (The frontend only needs the public `SUPABASE_URL` +
`SUPABASE_ANON_KEY` + `VITE_API_BASE`, set as Vercel env vars.)

---

## Part A — Set up your AWS account (first time)

Do this once. Skip to Step 1 if you already have an AWS account.

### A1. Create the account
1. Go to <https://aws.amazon.com> → **Create an AWS Account** (top-right).
2. Enter a **root email** you control + an account name (e.g. `wizardocs-prod`).
   *This email is the master key to the whole account — guard it.*
3. Verify the email with the code AWS sends, then set a strong root password.
4. Choose **Personal** account and fill in your contact details.

### A2. Add payment + verify identity
1. Enter a credit/debit card. *AWS requires one even on free tier and places a
   small temporary hold (~$1) to verify — it's refunded.*
2. Verify your phone with the SMS/voice code.
3. On the support plan screen, pick **Basic support — Free**.

*You won't be charged while your credits cover usage; the card is for identity +
overage protection.*

### A3. Check / redeem your credits
1. Sign in to the **AWS Management Console**.
2. Search **Billing and Cost Management** → **Credits** in the left menu.
3. New accounts get free-tier credits automatically. If you have a promo code,
   click **Redeem credit** and enter it. Confirm the balance (~$100) and expiry.

### A4. Secure the account (standard practice — do it)
1. **Enable MFA on the root user:** top-right account menu → **Security
   credentials** → **Multi-factor authentication** → add an authenticator app
   (Google Authenticator / Authy). *Root without MFA is the #1 AWS mistake.*
2. *(Recommended)* Create a daily-use admin instead of root: **IAM** → **Users**
   → **Create user** → attach **AdministratorAccess** → sign in as that user from
   now on. *Root can delete billing and everything else; keep it locked away.*

### A5. Set a budget alarm (avoid surprise bills)
1. **Billing** → **Budgets** → **Create budget** → **Monthly cost** → set a cap
   (e.g. **$5**) → email alert at 80% and 100%.
2. *This warns you the moment real charges start once credits run out.*

### A6. Pick your region
1. Use the **region selector** (top-right, e.g. "N. Virginia us-east-1").
2. Choose a region close to your users and, ideally, the **same region as your
   Supabase project** (check Supabase → Project Settings → General). *Lower
   backend↔database latency.*
3. *Everything you create (EC2, Elastic IP) lives in one region — stay consistent.*

Account ready → continue below.

---

## Step 1 — Register a domain via Vercel  ⏳ (you're doing this)

You'll register/manage the domain **through Vercel** (Vercel → **Domains** → Buy,
or add an existing one and let Vercel manage DNS). This makes Vercel your DNS
manager, so every record — including the AWS `api` subdomain (Step 4) — is added
in Vercel's DNS panel. A `.com` or `.app` reads best for a product launch.

You'll use two hostnames off this one domain:
- **`DOMAIN`** (root, e.g. `wizardocs.app`) → the **frontend on Vercel** (Step 13).
- **`API_DOMAIN`** (`api.wizardocs.app`) → the **backend on AWS** (Step 4).

**Tell me the domain** and I'll pre-fill it into `Caddyfile`, the Vite env, and
the Supabase steps. Until then, leave `your-domain.com` as-is in the files.

> **Ordering note:** because DNS lives in Vercel, set up the Vercel project +
> domain (Steps 12–13) *before* the backend's cert step (Step 9) — or at least
> add the `api` A record (Step 4) as soon as the domain is in Vercel, since Caddy
> needs it to resolve.

## Step 2 — Launch the EC2 instance

An "instance" is a virtual server. AWS Console → search **EC2** → **Launch
instance**, then fill the form:

- **Name:** `wizardocs`
- **AMI** *(the operating system image)*: **Ubuntu Server 24.04 LTS (x86_64)**.
- **Instance type** *(the hardware size)*: **`t3.small`** — 2 vCPU, 2 GB RAM.
  *Matches our measured ~365 MB warm footprint with headroom.*
- **Key pair** *(your SSH login credential)*: **Create new key pair** → name it
  `wizardocs` → type RSA → **`.pem`** → it downloads once as `wizardocs.pem`.
  *You cannot re-download it — save it safely. This is `KEY.pem` in later steps.*
- **Network settings → Firewall (security group)**: **Create security group** and
  add these inbound rules *(the firewall — what traffic is allowed in)*:

  | Type | Port | Source | Why |
  |---|---|---|---|
  | SSH | 22 | **My IP** | your admin access only |
  | HTTP | 80 | Anywhere `0.0.0.0/0` | Caddy cert challenge + HTTP→HTTPS redirect |
  | HTTPS | 443 | Anywhere `0.0.0.0/0` | the app itself |

- **Configure storage:** **25 GB gp3**. *Room for the OS, image, and data.*

Click **Launch instance**. Then open **EC2 → Instances** — after ~1 minute the
state shows **Running**. You'll grab its address as a static IP in the next step.

*On your laptop, lock down the key file so SSH will accept it:*

```bash
chmod 400 /path/to/wizardocs.pem
```

## Step 3 — Allocate a static (Elastic) IP

EC2 → **Elastic IPs** → Allocate → then **Associate** it with the `wizardocs`
instance. Note it as `ELASTIC_IP`.

(Free while associated with a running instance. This keeps the IP stable across
reboots, so DNS never breaks.)

## Step 4 — Point the API subdomain at the server

> **DNS is managed in Vercel** (you're doing the domain via Vercel config). So
> the domain must first exist in a Vercel project (buy/add it in Vercel →
> **Domains**), then all DNS records — including this API one — are added in
> **Vercel → your domain → DNS Records**. The root domain auto-points to Vercel;
> you only add the `api` subdomain by hand.

In **Vercel → Domains → your domain → DNS Records**, add an **A record**:

| Type | Name | Value |
|---|---|---|
| A | `api` | `ELASTIC_IP` |

Wait for it to propagate, then verify from your laptop:

```bash
dig +short api.DOMAIN    # must print ELASTIC_IP before continuing
```

Caddy can only issue the HTTPS cert once this resolves.

## Step 5 — Install Docker on the VM

```bash
ssh -i KEY.pem ubuntu@ELASTIC_IP

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit                     # log out/in so the docker group applies
ssh -i KEY.pem ubuntu@ELASTIC_IP
docker --version         # confirm
```

Add swap so the image build doesn't run out of memory on 2 GB:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Step 6 — Get the code onto the VM

```bash
git clone https://github.com/abuqaiselegant/AskWizardocs.git wizardocs
cd wizardocs
```

(If the repo is private, use a deploy key or `gh` auth.)

## Step 7 — Push the data + secrets (they are gitignored)

`chroma_db/`, `chunks.jsonl`, and `.env` are **not** in git. Push them from your
**local machine** — run this in your local project root (not on the VM):

```bash
rsync -avzR -e "ssh -i KEY.pem" \
  chroma_db rag-dataset/data/processed/chunks.jsonl .env \
  ubuntu@ELASTIC_IP:~/wizardocs/
```

`-R` preserves paths so `chunks.jsonl` lands at
`~/wizardocs/rag-dataset/data/processed/chunks.jsonl`. Only the ~260 MB the app
needs is sent — the 666 MB raw HTML is excluded.

## Step 8 — Set the API domain in the Caddyfile

On the VM, edit `Caddyfile` and replace `your-domain.com` with **`API_DOMAIN`**
(`api.your-domain.com`) — the backend lives on the subdomain.

## Step 9 — Launch the backend

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f
```

First run builds the image (a few minutes) and Caddy fetches the TLS cert for
`API_DOMAIN`. Look for Caddy logs showing `certificate obtained successfully`.

Verify the API is live:

```bash
curl https://API_DOMAIN/health      # -> healthy
```

The backend is now done. The frontend (Steps 12–14) points at this URL.

## Step 10 — Tell Supabase about the production domain

Otherwise Google sign-in redirects to localhost and fails. The frontend lives on
the **root domain (Vercel)**, so use that here:

Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL:** `https://DOMAIN`
- **Redirect URLs:** add `https://DOMAIN`

## Step 11 — Verify (backend)

```bash
curl https://API_DOMAIN/health      # -> healthy
```

Backend is live and API-only. Now the frontend.

---

## Part C — Frontend: Vite migration + Vercel

The current frontend is React loaded from a CDN with in-browser Babel (no build).
Vite turns it into a real, minified production build. Because the router is
**state-based** (one URL, `/`), there are no client-side routes to special-case.

### Step 12a — One-time Vite migration (done once, in the repo)

Scope — mechanical, reuses all 11 existing components:

1. **Add tooling:** `package.json` with `react`, `react-dom`, `@supabase/supabase-js`,
   `marked`, `vite`, `@vitejs/plugin-react`; a minimal `vite.config.js`.
2. **Config → env:** replace the `window.*` globals with Vite env vars —
   `src/config.js` exports `API_BASE = import.meta.env.VITE_API_BASE`;
   `src/supabase.js` exports the client built from `VITE_SUPABASE_URL` +
   `VITE_SUPABASE_ANON_KEY`.
3. **Modules:** in each of the 11 `.jsx` files add `import React from 'react'`
   (keeps the existing `React.useState` calls working), `export` the components
   it defines, and `import` the ones/config/`marked` it uses.
4. **Entry:** `src/main.jsx` does `createRoot(...).render(<App/>)` (moved out of
   `app.jsx`); `index.html` keeps its `<head>` styles/fonts/splash but drops all
   CDN + Babel + `text/babel` script tags in favour of one
   `<script type="module" src="/src/main.jsx">`.
5. **`.env` files:** `.env.development` → `VITE_API_BASE=http://localhost:8000`;
   production values come from Vercel env vars (Step 12b), not committed.
6. **Backend cleanup:** the FastAPI static-serving routes (`api/main.py` lines
   ~120–134) and the `COPY frontend/` line in the `Dockerfile` become dead once
   Vercel owns the UI — remove them so the backend is cleanly API-only.
7. **Known specifics** (verified against the code):
   - Move `Footer` from `landing.jsx` into `shared.jsx` — it's used by 6 pages.
   - `window.marked.lexer` (chat.jsx) → `import { marked } from 'marked'`.
   - Put `favicon.svg` in `frontend/public/` so Vite serves it at `/favicon.svg`.
   - OAuth already uses `window.location.origin` — no change needed.

> This is a code change to the repo, not a server step. I can perform it and
> verify with `npm run build` + `npm run dev` before you deploy — say the word.

Verify locally after migration:

```bash
cd frontend && npm install && npm run dev     # open the printed localhost URL
npm run build                                  # must succeed → dist/
```

### Step 12b — Deploy to Vercel

1. Push the repo to GitHub (Vercel deploys from git).
2. Vercel dashboard → **Add New → Project** → import the repo.
3. **Root Directory:** `frontend`. Framework preset: **Vite** (auto-detected).
   Build command `npm run build`, output `dist` (defaults).
4. **Environment Variables** (Project Settings → Environment Variables):

   | Name | Value |
   |---|---|
   | `VITE_API_BASE` | `https://API_DOMAIN` |
   | `VITE_SUPABASE_URL` | your Supabase URL |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon key (public) |

5. **Deploy.** You get a `*.vercel.app` URL immediately.

### Step 13 — Attach the root domain to the Vercel project

Vercel → Project → **Settings → Domains** → add `DOMAIN`. Since Vercel already
manages this domain's DNS (Step 1), it wires the record and issues HTTPS
automatically — no manual DNS entry for the root. (The `api` subdomain record
from Step 4 stays pointed at AWS.)

### Step 14 — Scope backend CORS to the frontend

In `api/main.py`, change `allow_origins=["*"]` to `["https://DOMAIN"]` (plus
`http://localhost:5173` for local Vite dev), then redeploy the backend
(Step 9). Tightens the API to only your own frontend.

### Step 15 — Verify end to end

Open `https://DOMAIN`, sign in with Google, ask a question, confirm you get an
answer with citations. (Frontend on Vercel → API on AWS → Supabase auth.)

---

## Day-2 operations

**Update the frontend:** just `git push` — Vercel auto-builds and redeploys.

**Update the backend:**
```bash
ssh -i KEY.pem ubuntu@ELASTIC_IP
cd wizardocs && git pull
docker compose -f docker-compose.prod.yml up -d --build
```

**Update the corpus** (after re-ingesting locally): re-run the Step 7 `rsync`, then rebuild.

**Common commands:**
```bash
docker compose -f docker-compose.prod.yml ps       # status
docker compose -f docker-compose.prod.yml logs -f  # tail logs
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml down      # stop everything
```

**Backups:** nothing to back up on the VM — user data is in Supabase (managed
backups), and the corpus is reproducible from `scripts/`. The VM is disposable.

**Uptime:** add a free monitor (UptimeRobot / BetterStack) hitting
`https://API_DOMAIN/health` (backend) and `https://DOMAIN` (frontend) every
5 min so you know if either goes down.

**Cost:** ~$15/mo EC2 + ~$0.50/mo Elastic IP (only if unattached) + ~$10/yr
domain + **Vercel Hobby $0**. OpenAI/Cohere are pay-per-use (low at portfolio
traffic). $100 credit ≈ 6 months.

**Teardown:** `docker compose ... down`, terminate the instance, release the
Elastic IP. (Release the EIP or it bills when unattached.)

---

## Pre-flight checklist

**Backend (AWS)**
- [ ] Domain bought; `api` A record → `ELASTIC_IP`, `dig api.DOMAIN` resolves
- [ ] Security group: 22 (my IP), 80, 443 (all)
- [ ] Docker + swap installed on VM
- [ ] Code cloned; data + `.env` rsynced (`ls chroma_db && ls rag-dataset/data/processed/chunks.jsonl` on the VM)
- [ ] `API_DOMAIN` set in `Caddyfile`
- [ ] `docker compose -f docker-compose.prod.yml up -d --build` → Caddy got a cert
- [ ] `curl https://API_DOMAIN/health` → healthy

**Frontend (Vercel)**
- [ ] Vite migration done; `npm run build` succeeds locally
- [ ] Vercel project imported, root dir `frontend`, env vars set (`VITE_API_BASE` → `https://API_DOMAIN`)
- [ ] Root `DOMAIN` added in Vercel → DNS record added → HTTPS issued
- [ ] Backend CORS scoped to `https://DOMAIN`

**Go-live**
- [ ] Supabase Site URL + Redirect URLs → `https://DOMAIN`
- [ ] Open `https://DOMAIN` → Google sign-in + ask a question works end-to-end
