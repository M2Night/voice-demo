# Voice Demo — Web (P0)

Frontend for the debt-collection voice agent demo.
Phase **P0**: a static landing page deployed to a public URL. No LiveKit, no token API, no agent yet.

## Stack
- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Deploy target: **Vercel**

## Local development

```bash
cd web
pnpm install      # only the first time
pnpm dev          # http://localhost:3000
```

Other scripts:
```bash
pnpm build        # production build
pnpm start        # serve the production build
pnpm lint         # eslint
```

## Deploy to Vercel (P0 goal)

P0's only goal is: **get this page reachable on a public URL.**

### 1. Push the repo to GitHub
If you haven't already:
```bash
# from the repo root
git init
git add .
git commit -m "P0: static landing page"
gh repo create voice-demo --public --source=. --push   # or push manually
```

### 2. Create a Vercel project
1. Go to https://vercel.com/new
2. Sign in with GitHub (free Hobby account is enough).
3. Import the `voice-demo` repository.
4. **Important:** set **Root Directory** to `web` (because the Next.js app is in a subdirectory).
5. Framework preset will auto-detect as **Next.js** — keep the defaults.
6. Click **Deploy**.

In ~1 minute you'll get a URL like `https://voice-demo-xxx.vercel.app`. That's the P0 deliverable.

### 3. Verify P0 acceptance
- [ ] The URL loads the landing page.
- [ ] You can open it on your phone (proves it's truly public).
- [ ] No errors in the browser console.

## What's next (preview)

| Phase | What we'll add |
|---|---|
| P1 | `/api/token` route to sign LiveKit JWTs |
| P2 | Browser joins a LiveKit room from this page |
| P3 | A Python agent worker (separate `agent/` dir) joins the same room |
| P4 | Agent plays a Fish Audio greeting |
| P5+ | Full STT → LLM → TTS loop |

For each later phase, env vars will be added in the Vercel dashboard
(Settings → Environment Variables). No secrets ever live in this repo.

## Layout

```
web/
├── src/
│   └── app/
│       ├── layout.tsx       # root layout, metadata
│       ├── page.tsx         # landing page (P0)
│       └── globals.css      # Tailwind imports
├── public/                  # static assets
├── package.json
└── README.md                # ← you are here
```