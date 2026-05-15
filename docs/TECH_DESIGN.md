# Debt Collection Voice Agent — Technical Design (MVP v1)

> Companion to `PRD.md`. Scope = P0 (MVP).
> Hard constraints: **LiveKit** (real-time audio) + **Fish Audio** (TTS) + web frontend.

---

## 0. Goals & Constraints
- **Goal:** ship a runnable, demo-ready debt-collection voice demo in the shortest time.
- **Hard constraints:** LiveKit + Fish Audio + web.
- **Interaction model:** real-time turn-taking (no full-duplex barge-in in MVP).
- **Principles, in order:** simplicity > demo-readiness > extensibility.
- **Cloud-first:** P0 deploys to the cloud from day one. No local-only milestone.

---

## 1. Design Notes (general)

### 1.1 Frontend hosting & public access
**Vercel Hobby** is publicly reachable by default; perfect for the Next.js page + token API.

### 1.2 Roles of deployment platforms
| Platform | Role |
|---|---|
| Vercel | Frontend + serverless token API |
| LiveKit Cloud | SFU + hosted Python Agent worker (one platform for both) |

### 1.3 Context & memory strategy (MVP)
- **No** cross-session memory, **no** database persistence.
- In-session only:
  - Last 4–6 conversation turns.
  - Slot fields: `committed_amount`, `committed_date`.
  - Flow state: `opening → negotiation → confirmation → closing`.

### 1.4 Cost mindset (no separate budget plan)
Costs stay negligible if we always remember:
- Single call ≤ 5 min.
- Agent reply ≤ 2 sentences (enforced in prompt + truncation).
- Auto-close after 5 user turns if no commitment yet.

---

## 2. Stack (MVP)

| Layer | Choice | Notes |
|---|---|---|
| Frontend framework | Next.js 14 (App Router) + TypeScript | SSR, Vercel-native, official LiveKit examples |
| Styling | Tailwind CSS | Utility classes in JSX, no separate CSS files |
| UI components | shadcn/ui | Copy-paste React components (button, card, dialog…) styled with Tailwind |
| Real-time media | LiveKit Cloud (Build plan, free tier) | Hosted SFU, no self-host needed |
| Agent orchestration | LiveKit Agents (Python) | Built-in VAD + STT/LLM/TTS pipeline |
| STT | Deepgram Streaming (via LiveKit Inference) | LiveKit Inference free tier, no API key needed |
| LLM | **GPT-5.2** (via LiveKit Inference) | LiveKit Inference hosted, no API key needed |
| TTS | Fish Audio via plugin (`livekit-plugins-fishaudio` or custom wrapper) | Required by constraint |
| Frontend deploy | Vercel Hobby | Free, public URL out of the box |
| Agent deploy | LiveKit Cloud (Agents) | Same project as the SFU; one `lk agent deploy` away |

---

## 3. End-to-End Architecture

```
┌───────────────────────────────────────────────────────────┐
│  Browser (Next.js on Vercel)                             │
│  ┌──────────────┐    ┌─────────────────────────────────┐ │
│  │ Call UI      │───▶│ LiveKit Web SDK (WebRTC)        │ │
│  │ Case card    │    │ - mic capture                   │ │
│  │ Transcript   │◀───│ - subscribe agent audio         │ │
│  │ Summary card │    │                                 │ │
│  └──────────────┘    └────────────────┬────────────────┘ │
└──────────────┬─────────────────────────┼─────────────────┘
               │ /api/token              │ WebRTC
               ▼                         ▼
     ┌───────────────────┐    ┌─────────────────────────┐
     │ Vercel Route      │    │  LiveKit Cloud (SFU)    │
     │ - sign JWT        │    │  Room: "demo-<uuid>"    │
     └───────────────────┘    └────────────┬────────────┘
                                           │ WebRTC
                                           ▼
     ┌────────────────────────────────────────────────────┐
     │  LiveKit Agent (Python, hosted on LiveKit Cloud)   │
     │                                                    │
     │   VAD ──▶ Deepgram STT ──▶ GPT-5.2 (LLM) ──▶ Fish ──┐
     │                                                    │
     │                  ◀──────── PCM ────────────────────┘
     └────────────────────────────────────────────────────┘
                       │ WebSocket
                       ▼
              ┌──────────────────┐
              │ Fish Audio API   │
              └──────────────────┘
```

---

## 4. Component Design

### 4.1 Frontend
- Single page (`/`). State machine driven by a React reducer.
- Key components: `CaseCard`, `Transcript`, `CallControls`, `SummaryCard`.
- LiveKit hooks: `useConnectionState`, `useTracks`, `useVoiceAssistant`.
- Captions: subscribe to the `transcription` data channel published by the agent.
- States mirror PRD §12 (`IDLE / CONNECTING / IN_CALL_AGENT_TURN / IN_CALL_USER_TURN / ENDING / ENDED / ERROR`).

### 4.2 Token API (Next.js Route)
- POST `/api/token` → `{ url, token }`.
- Server holds `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` (env vars only).
- Each call gets a fresh room name `demo-<short-uuid>`; agent is dispatched explicitly to that room.

### 4.3 Agent Worker (Python)
- Entrypoint: `agent.py`.
- Pipeline: `VoicePipelineAgent(vad, stt, llm, tts)` from `livekit-agents`.
- Slot extraction: a small post-LLM hook that parses `{amount, date}` from the
  conversation; when both filled, the agent confirms and emits an `ENDING` event.
- Hard limits: max 5 user turns OR 5 minutes call duration → graceful close.

### 4.4 Fish Audio TTS
- Use `livekit-plugins-fishaudio` if its API matches; otherwise wrap Fish's
  WebSocket streaming endpoint as a custom `TTS` subclass.
- Required fields: `api_key`, `voice_id` (preselected on Fish dashboard), `format=pcm`.
- Stream PCM frames into the LiveKit audio track as they arrive.

### 4.5 System Prompt (MVP)
```
You are "Alex", a licensed debt-collection specialist (badge #8829) at Acme Finance.
You are on a phone call with a debtor.

[Case]
Name: {name} | Total due: {amount} | Days overdue: {days}
Contract: {contract_id} | Card tail: {card_tail} | Min payment: {min_payment}

[Goal] Collect a clear repayment commitment = (amount + date). Confirm and close.

[Rules]
1. Keep replies ≤ 2 sentences, ≤ 25 words each. Speak naturally.
2. One question per turn.
3. If user denies the debt: cite contract id + card tail; do not argue.
4. If user is angry: empathize once, then return to the goal.
5. If user commits: restate amount + date verbatim before closing.
6. Never threaten, never disclose debt to anyone other than the debtor.
7. If asked "are you AI?", answer truthfully you are an AI assistant.
8. When goal is met OR call > 5 min → close politely.

Output spoken text only. No markdown. No parentheticals.
```

---

## 5. Build Order

Cloud-first: every phase produces a deployed, publicly-reachable artifact.
Each phase is a strict superset of the previous one — never skip ahead.

| Phase | Goal | Key acceptance |
|---|---|---|
| **P0 — Hello world on the web** | Deploy a static Next.js page to Vercel. No LiveKit, no token API, no agent. | Public URL returns the page; lighthouse passes; can be shared. |
| **P1 — Token API** | Add `/api/token` route on Vercel that signs a LiveKit JWT. Frontend can call it and display the token. | `curl <url>/api/token` returns valid JSON; secrets only in Vercel env vars. |
| **P2 — Browser joins LiveKit room** | Frontend uses the token to join a LiveKit room; mic capture works. Still no agent. | Browser shows "connected" state; LiveKit dashboard shows the participant. |
| **P3 — Agent worker on cloud** | Deploy a "hello" Python agent worker to **LiveKit Cloud** (`lk agent deploy`) that joins the room when dispatched. No STT/LLM/TTS yet. | Two participants visible in the room (browser + agent). Agent process is healthy in LiveKit dashboard. |
| **P4 — Fish Audio TTS** | Agent plays a fixed Fish-generated opening line into the room. | Browser audibly plays the Fish voice. |
| **P5 — Business state machine** | Collector prompt + function_tool commitment detection + data channel events + frontend commitment card. | Green commitment card appears in UI when debtor agrees to pay. |
| **P6 — Stability polish** | Error states, timeouts, transcript auto-scroll, case card UI. | One full demo run completes reliably. |

**Why split P0 into pure static deploy:** the very first thing to verify is that
the deploy pipeline works at all (account, project link, build, domain, env vars).
Failing fast here costs minutes; failing later mixed with LiveKit issues costs hours.

**Critical rule:** since P4 already validates Fish Audio against the public
network, any later TTS failure is a regression — not an environment issue.

---

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Fish streaming latency too high (>1.5s first byte) | Med | High | Stream by sentence; pre-generate opening line; reuse short greetings |
| LLM ignores "≤ 2 sentences" rule | Med | Med | Prompt + post-truncation; sentence splitter before TTS |
| ASR mishears amount/date | Med | Med | Agent reads back to confirm before closing |
| Agent worker dies mid-call | Low | High | Cloud platform health check + auto-restart |
| Cloud deployment misconfig (env vars, ports) | Med | High | Validate at P0 with a "hello" deploy before adding any logic |
| Compliance overshoot (threats) | Low | Med | Hard rules in prompt + keyword output filter |

---

## 7. MVP Non-Goals (stack-level)
- No database, no Redis, no message queue.
- No SIP / PSTN telephony bridge.
- No full-duplex barge-in (deferred to PRD P1).
- No multi-tenant agent dispatch — one room per call, ephemeral.
- No analytics pipeline beyond `console.log`.

---

*Next step: P0 — `pnpm create next-app` and deploy a single static page to Vercel. Nothing else.*