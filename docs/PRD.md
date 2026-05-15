# Debt Collection Voice Agent — Product Requirements (PRD)

> Demo web app where the **user plays a debtor** and an **AI agent plays the collector**.
> Fixed tech constraints: **Fish Audio TTS**, **LiveKit** for real-time audio, web-based.
> This document focuses on **product scope only**. Tech design lives in `TECH_DESIGN.md`.

---

## 1. Goal & Non-Goals

### 1.1 Goal
Ship, in the shortest time, a runnable demo where a single voice call drives one
clear business outcome: **the agent collects a repayment commitment from the user
(amount + date)** — and visibly shows that outcome at the end of the call.

### 1.2 Success Criteria (Demo-level)
- Visitor can complete a full call (start → talk → end) without instructions.
- The call ends with a **structured summary** (commitment reached y/n, amount, date, end reason).
- End-to-end voice latency feels conversational (target: first agent reply < 2s after user stops talking).
- Agent stays in character and handles at least the 4 core debtor response classes (see §6).
- Demo is shareable via a public URL (no install required).

### 1.3 Non-Goals
- Not a production collection system (no real PII, no real telephony, no CRM integration).
- No SIP / outbound phone calls. Web-only WebRTC.
- No multi-tenant accounts, no auth, no persistent database.
- No multi-case switching, no admin dashboard.
- No advanced barge-in policies in MVP — basic turn-taking only.
- Not optimized for mobile-first (desktop Chrome is the primary target).

---

## 2. Target Audience
- **Primary:** Technical reviewers / hiring managers / clients evaluating voice-AI capability.
- **Secondary:** Internal stakeholders deciding whether to productize.

Implication: prioritize **"wow in 60 seconds"** over deep configurability.

---

## 3. Core Scenario & User Story

### 3.1 Scenario
> A visitor lands on the page and sees a brief case card (debtor name, amount,
> days overdue, minimum payment). They click **Start Call**. The AI collector
> opens the call, states its purpose, and drives the conversation toward an
> explicit repayment commitment. The user improvises as the debtor. The call
> ends when a commitment is reached, the user hangs up, or a timeout fires.
> A summary card then shows the outcome.

**One call = one demo session.** No login, no history, no persistence beyond the session.

### 3.2 Single Core User Story
As a demo user playing the role of "debtor", I want to be guided by the agent
into giving an explicit repayment commitment within a single simulated call,
so that I can directly observe the agent's ability to drive a business outcome.

---

## 4. Phased Feature Plan

Three phases. Each phase is independently shippable and demo-able.

| Phase | Theme | Goal |
|---|---|---|
| **P0 — MVP** | "It works" | A real, end-to-end voice call with the agent. Ugly is OK. |
| **P1 — Polish** | "It feels real" | Looks and sounds like a believable phone call. Demo-ready. |
| **P2 — Advanced** | "It impresses" | Differentiating features that go beyond a generic voice demo. |

---

## 5. Phase 0 — MVP (must-have)

**Definition of done:** A user can load the page, start a call, hold a coherent
~2-minute conversation, and the call ends with a **structured commitment summary**.
This is the smallest closed loop that proves the product works.

### 5.1 Features

| ID | Feature | Description |
|---|---|---|
| F0.1 | Case card | Pre-call panel showing debtor name, total due, days overdue, minimum payment. |
| F0.2 | Start / End Call buttons | Single primary button toggles between "Start call" and "End call". |
| F0.3 | Mic permission flow | Standard browser prompt; clear error if denied. |
| F0.4 | Live audio in/out | LiveKit room connects user mic ↔ agent voice. |
| F0.5 | Agent speaks first | On connect, agent delivers an opening line stating purpose. |
| F0.6 | Turn-taking | Basic VAD-driven; agent listens, replies, listens. No barge-in. |
| F0.7 | Live transcript | Two-column rolling transcript (user vs. agent), visible during the call. |
| F0.8 | Call status + timer | Visible state: `Idle / Connecting / In call / Ending / Ended` + duration. |
| F0.9 | Commitment detection | LLM extracts `{amount, date}` when user makes a clear promise. |
| F0.10 | Structured summary card | After end: outcome (commitment y/n), amount, date, end reason, duration. |
| F0.11 | One persona, one profile | Hardcoded "Professional" collector + one fake debtor record. |

### 5.2 Conversation Strategy (MVP minimum)
Agent goal (single, explicit): **collect a repayment commitment = amount + date.**

Agent must handle these 4 core response classes:
- **A. Direct agreement** — confirm amount and date, restate, then close.
- **B. Asks for extension / partial** — offer minimum payment option, request a concrete date.
- **C. Denies or unclear about the debt** — briefly state billing facts, continue toward a plan.
- **D. Refuses to talk / silent** — one short retention attempt; if no response, end the call.

Conversation principles:
- Short, restrained, compliant. No threats, no shaming.
- One question per turn. Avoid long monologues.

### 5.3 End Reasons (P0)
The summary must report exactly one of:
- `commitment_reached` — agent extracted `{amount, date}` and confirmed it.
- `user_hangup` — user clicked End Call.
- `timeout` — call exceeded 5 minutes or 30s of silence.
- `error` — connection / service failure.

### 5.4 Explicit P0 cuts (NOT in MVP)
- No "incoming call" ringing UI (deferred to P1 — plain Start button is enough).
- No barge-in / interruption.
- No persona switcher, no scenario switcher, no editable profile.
- No sound effects, no avatar animations, no emotion indicator.
- No multilingual support.
- Mobile layout not required.

### 5.5 P0 acceptance test
Run a 90-second call in which the user tries response classes A, B, and C.
Conversation stays coherent and on-topic; agent reaches a commitment in class A;
on End Call, the summary card shows the correct end reason and (for class A) the
extracted amount + date.

---

## 6. Phase 1 — Polish (demo-ready)

**Definition of done:** The demo feels like a real phone call. Safe to share publicly.

### 6.1 Features

| ID | Feature | Description |
|---|---|---|
| F1.1 | Incoming-call UI | Replace plain Start button with full-screen "Unknown Caller" + ringtone + green Answer / red Decline. |
| F1.2 | In-call screen polish | Avatar, caller name, mute button, refined call-timer + status badge. |
| F1.3 | Voice activity indicator | Visible pulse when agent is speaking and when mic detects voice. |
| F1.4 | Barge-in | User can interrupt; agent stops speaking immediately. |
| F1.5 | Expanded response handling | Add: angry/abusive, sob story, attempts to hang up early, "are you AI?". |
| F1.6 | Richer summary card | Add: key talking points list, restate of what was committed. |
| F1.7 | Connection error states | Mic denied / network drop / agent unavailable — each has clear UI. |
| F1.8 | Loading/connecting feedback | Skeleton + ringtone bridge so dead-air never exceeds ~1s. |

### 6.2 Quality bars (P1)
- Time-to-first-agent-word after Answer click: **< 2.5s**.
- Agent reply latency after user stops speaking: **< 1.8s** (target), < 2.5s (acceptable).
- Captions appear within 500ms of speech.
- Zero audio glitches in a 3-minute test call.

### 6.3 P1 explicit cuts (deferred to P2)
- No persona switching, no scenario switching.
- No emotion visualization.
- No multilingual support.
- No analytics.

### 6.4 P1 acceptance test
A non-technical observer watches a 3-minute demo call without prior context and
says it "feels like a real call." Captions, summary, and hang-up flow all work.

---

## 7. Phase 2 — Advanced (impressive differentiators)

**Definition of done:** Demo has at least 3 P2 features that visibly distinguish
it from a generic voice-AI sample.

Pick from the menu below based on remaining time. Recommended priority order:

### 7.1 Feature menu (ordered by impact / effort ratio)

| ID | Feature | Why it impresses | Effort |
|---|---|---|---|
| F2.1 | **Persona switcher** (Professional / Empathetic / Firm) | Shows tonal range of TTS + prompt design. | Low |
| F2.2 | **Scenario presets** (1st-call / 2nd-reminder / Broken-promise) | Shows agent adapts to context. | Low |
| F2.3 | **Editable debtor profile** (name, amount, due date) | Lets reviewers test edge cases live. | Low |
| F2.4 | **Agent emotion indicator** (avatar mood: calm / serious / empathetic) | Visual signal of the agent's "state". | Medium |
| F2.5 | **Structured call outcome** (JSON view: intent classified, promise date extracted, risk score) | Demonstrates LLM tool-use / extraction. | Medium |
| F2.6 | **Audio waveform visualization** | Common but expected in modern voice UIs. | Low |
| F2.7 | **Multilingual** (English + Chinese, switch on landing) | Broadens audience; showcases TTS flexibility. | Medium |
| F2.8 | **Compliance guardrails demo** (try to make agent threaten → it refuses) | Shows safety thinking. | Low |
| F2.9 | **Replay last call** (download audio + transcript) | Useful for reviewers; share-friendly. | Medium |
| F2.10 | **"Behind the scenes" panel** (toggleable: shows STT text, LLM prompt, TTS chunks live) | Killer feature for technical reviewers. | Medium |

### 7.2 Recommended P2 minimum (3 features)
**F2.1 (Persona switcher) + F2.2 (Scenario presets) + F2.10 (Behind the scenes panel)**

Rationale: persona + scenarios show product range; the BTS panel is uniquely
compelling to the *technical* audience this demo is built for.

---

## 8. Debtor Response Taxonomy (full reference)

P0 collapses into 4 core classes (A–D). P1 / P2 add finer-grained variants.

| Class | Example user line | Agent strategy | Phase |
|---|---|---|---|
| **A. Direct agreement** | "I'll pay $500 next Friday." | Confirm & repeat amount + date; close. | P0 |
| **B. Asks extension / partial** | "Can I pay the minimum next month?" | Offer minimum-payment path; demand a concrete date. | P0 |
| **C. Denies / unclear** | "I never borrowed this." | Cite contract id + card tail; redirect to a plan. | P0 |
| **D. Refuses / silent** | (silence) or "Don't call me." | One short retention attempt; if no response, end. | P0 |
| Hardship / sob story | "I lost my job…" | Empathize; offer installment options. | P1 |
| Anger / verbal abuse | "Stop calling me!" | Stay calm; lower pace; redirect once; offer to end. | P1 |
| Try to hang up early | "I'm busy, bye." | One concise restate of consequence; leave callback. | P1 |
| Question if AI | "Are you a robot?" | Truthfully confirm AI assistant status. | P1 |
| Third party answers | "He's not here." | Do NOT disclose debt; ask for callback. | P2 |
| Demand to speak to human | "Get me a real person." | Acknowledge; offer callback number. | P2 |

---

## 9. Persona Catalog

| Persona | When | Voice traits | Prompt traits |
|---|---|---|---|
| **Professional (default, P0)** | Standard collection | Even pace, neutral warmth | Polite, precise, compliant, no pressure tactics |
| **Empathetic (P2)** | Hardship cases | Slower, softer | "I understand", offers options, lower urgency |
| **Firm (P2)** | Repeat broken promises | Slightly faster, lower pitch | Clear about consequences, still compliant |

> Note: "Firm" must NOT cross into threats. Compliance constraints apply equally.

---

## 10. Scenario Presets (P2)

| Preset | Debtor state | Agent goal |
|---|---|---|
| First contact | 12 days overdue, no prior contact | Confirm identity, inform, secure payment date |
| Second reminder | 30 days overdue, 1 prior call | Reference prior call, escalate urgency |
| Broken promise | Missed a previously promised date | Reference the promise, ask why, renegotiate |

---

## 11. Page Layout & UX Flow

### 11.1 Page Information Architecture (P0, single page)
```
┌────────────────────────────────────────────────────────────┐
│ Status: [In Call]   Duration: 00:42                        │  ← top bar
├──────────────────────────────────┬─────────────────────────┤
│ Live Transcript                  │ Case Card               │
│ ─────────────────────             │ Debtor: Jane Doe       │
│ Agent: Hi, this is...             │ Total due: $850        │
│ User:  What's this about?         │ Days overdue: 12       │
│ Agent: You have an overdue...     │ Min payment: $120      │
│ ...                              │ Contract: LN20240815    │
│                                  │                         │
├──────────────────────────────────┴─────────────────────────┤
│              [  End Call  ]   (or [ Start Call ])          │  ← primary action
└────────────────────────────────────────────────────────────┘

After call → replace center with Summary Card:
  Outcome: ✅ Commitment reached
  Amount:  $500
  Date:    2026-06-10
  End reason: commitment_reached
  Duration:   2:14
  [ Start new call ]
```

### 11.2 P1 UX Flow (incoming-call metaphor on top of P0)
```
Landing → [Incoming Call screen — ringing] → Answer / Decline
                                          ↓
                               [Connecting…] → In-Call screen (P0 layout)
                                          ↓
                                    [Summary card]
```

---

## 12. State Machine

Single source of truth shared between frontend and agent backend.

States:
- `IDLE` — page loaded, not started.
- `CONNECTING` — joining LiveKit room, agent warming up.
- `IN_CALL_AGENT_TURN` — agent is speaking.
- `IN_CALL_USER_TURN` — user is speaking / room idle awaiting user.
- `ENDING` — generating summary (extract amount/date, classify outcome).
- `ENDED` — summary shown.
- `ERROR` — connection / service failure.

Transitions:
- `IDLE → CONNECTING`: user clicks Start Call (P0) / Answer (P1).
- `CONNECTING → IN_CALL_AGENT_TURN`: room connected, agent opens.
- `IN_CALL_AGENT_TURN ↔ IN_CALL_USER_TURN`: VAD-driven turn detection.
- `* → ENDING`: user clicks End Call, OR commitment detected & confirmed, OR timeout fires.
- `ENDING → ENDED`: summary generation completes.
- `* → ERROR`: any unrecoverable failure.

---

## 13. Edge Cases & Failure Modes

| Case | Handling |
|---|---|
| Mic permission denied | Block call start; show one-line fix instructions. |
| Network drops mid-call | LiveKit auto-reconnect (≤5s); banner; if fail → graceful end + summary. |
| Agent backend unreachable | Disable Answer button; show "Agent offline" message. |
| User says nothing | After 15s of silence, agent prompts; after 30s, polite end. |
| ASR mishears amount/date | Agent reads back to confirm before committing. |
| Browser autoplay block | Audio only after user click (Answer button satisfies this). |
| User curses / tries to jailbreak agent | System prompt hard rules + output filter; agent stays in character. |
| Call exceeds 5 minutes | Agent wraps up gracefully. |

---

## 14. Compliance & Ethical Constraints (apply to all phases)

The agent MUST NOT:
- Threaten legal action falsely or imply violence.
- Disclose debt details to anyone other than the debtor.
- Use abusive language regardless of provocation.
- Claim to be human if directly asked.
- Call before 8am or after 9pm (not enforced in demo, but mention in prompt).

The agent MUST:
- Identify itself and the company at the start of the call.
- Allow the debtor to end the call at any time.
- Provide a callback contact when ending.

These rules live in the system prompt and in an output filter.

---

## 15. Open Questions

1. **Language for the demo:** English-first, Chinese-first, or both at launch?
2. **Real Fish Audio voice:** Use a stock voice, or clone a specific persona voice?
3. **Public demo URL:** Do we want it gated (passcode) or fully open?
4. **Default debtor profile:** Realistic-sounding fake, or obviously fictional ("John Doe, $1234.56")?
5. **Branding:** Real-looking fake brand ("Acme Finance") or unbranded?

---

## 16. Out of Scope (explicit)

- Real telephony / PSTN dialing.
- Real customer data, real CRM, real payment processing.
- Agent supervisor dashboard / live monitoring tools.
- A/B testing infrastructure.
- Mobile-native apps.
- Analytics beyond a basic console log.

---

## 17. Phase Exit Checklist

**Exit P0 when:**
- [ ] Full call works end-to-end on localhost.
- [ ] Agent handles all 4 P0 response classes (A/B/C/D).
- [ ] Commitment detection produces correct `{amount, date}` for class A.
- [ ] Summary card shows correct end reason in all 4 cases.
- [ ] No hardcoded secrets in client code.

**Exit P1 when:**
- [ ] Deployed to a public URL.
- [ ] Latency targets met (see §6.2).
- [ ] Incoming-call UI, barge-in, error states all work.
- [ ] One non-technical observer says it "feels real".

**Exit P2 when:**
- [ ] At least 3 P2 features shipped.
- [ ] Demo script (~3 min) prepared and rehearsed.

---

*Next document: `TECH_DESIGN.md` — covers architecture, stack choices, and build order.*