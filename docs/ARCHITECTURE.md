# Architecture

A complete walkthrough of how the AI Front Desk is built and why. For the short
pitch see [explanation.md](explanation.md); for decisions and tradeoffs see
[DECISIONS.md](DECISIONS.md); for endpoints see [API.md](API.md).

## System overview

```
                 Parent (mobile)          Operator
                       |                     |
                       v                     v
            +-------------------------------------------+
            |   React SPA (Vite) on Cloudflare Pages    |
            |   /  -> parent chat   /operator -> console |
            +-------------------------------------------+
                       |  fetch /api/*
                       v
            +-------------------------------------------+
            |   Cloudflare Pages Functions (Workers)    |
            |   ask · kb · questions · requests · ingest |
            +----------------+--------------------------+
                  |          |                |
                  v          v                v
          Cloudflare D1   Groq API       Groq vision
        (handbook, log,  (LLM answers,  (handbook photo
          requests)      Gap Radar)      OCR -> sections)
                              |
                              v  (fallback when no GROQ_API_KEY)
                       Cloudflare Workers AI (Llama)
```

Everything runs on Cloudflare: the static SPA and the API share one origin, so
the browser calls `/api/*` with no CORS and no separate backend to operate.

## The two surfaces

**Parent chat** (`src/parent/Chat.tsx`). A mobile-first chat. Input by text or
voice (Web Speech API, `voice.ts`), in English or Spanish. Each answer renders a
source chip, a confidence dot, and, when needed, an escalation card with a
one-tap path to a human. Tour and message requests open a small capture sheet.

**Operator console** (`src/operator/Console.tsx`). Five tabs: an Impact view
(time saved, answer rate, top topics), the Questions log with filters, Gap Radar
(the self-teaching loop), an Inbox with urgent items triaged to the top, and the
Handbook editor (the source of truth) with photo import. An Activity trail
records edits and taught entries.

## Request lifecycle: a parent question

`POST /api/ask` (`functions/api/ask.ts`) is the spine, and the order is the
design:

1. **Validate.** Non-empty, length-capped input.
2. **Read the handbook** from D1 (seeded from `seed/center.json` on first use).
3. **Safety screen first** (`_shared/safety.ts`). A deterministic, bilingual
   regex catches medical, medication, emergency, and child-safety wording and
   returns a hard-coded, localized escalation. This runs *before* the rate cap
   and *before* the model, so an emergency is never swallowed by a cost guard or
   answered by the LLM.
4. **Rate cap.** A rolling 24h ceiling on model-backed questions bounds cost on
   a public endpoint. Safety questions never reach this gate.
5. **Ground and answer** (`_shared/prompt.ts` + `_shared/llm.ts`). The full
   handbook, today's date, the weekly menu, and the answer-only-from-this rules
   go into the system prompt. History roles are clamped to user/assistant so the
   public endpoint cannot be used to inject a system prompt. The model returns
   one JSON object: answer, citations, confidence, category, needs_human,
   escalation_reason, suggested_actions.
6. **Normalize and log.** The result is normalized defensively; if the model
   returns nothing usable, the system fails safe to a human handoff. The
   question, answer, confidence, category, and status are written to the log.

`status` is derived as: low confidence -> `unanswered` (a gap for Gap Radar);
otherwise needs_human -> `escalated`; otherwise `answered`.

## The trust model

This is where the design budget went, because in childcare a confident wrong
answer is worse than no answer.

- **Grounded and cited.** The model may only use the handbook and must cite the
  section it used. If the handbook does not cover something it returns low
  confidence, an empty citation list, and a plain "I don't have that on file."
- **Deterministic safety net, not a prompt.** `safety.ts` is plain code. It runs
  before the model and cannot be argued out of a rule. It is bilingual so a
  Spanish health question cannot slip past it, and it localizes its reply.
- **Confidence and escalation are first-class.** Low-confidence and sensitive
  answers render an escalation card and are logged as gaps; they are never
  dressed up as certain.
- **Fail safe.** A parse failure or empty model response escalates to a human
  rather than inventing an answer.

## The self-teaching loop (Gap Radar)

`GET /api/questions?view=gaps` pulls the questions the bot flagged as gaps or
handed to a human (`status in (unanswered, escalated) or confidence = low`, which
also sweeps in safety escalations), sends them to the model, and gets back
clustered themes, each with a drafted handbook section.
Health and safety themes are flagged `reviewOnly` and never auto-published as
policy. The operator edits if they like and approves in one tap
(`POST /api/questions`), which appends the section to the handbook and bumps its
version. The next parent asking that question gets a grounded, cited answer. The
product compounds: every gap becomes coverage.

## Photo import: "snap a photo of your handbook"

`POST /api/ingest` (`functions/api/ingest.ts`) is an operator onboarding path. The
operator uploads up to four photos of a paper handbook; the client reads them to
data URLs and posts them. `runVisionJson` sends them to Groq's multimodal model
(`meta-llama/llama-4-scout-17b-16e-instruct`),
which transcribes and structures the pages into `{ sections: [{title, body}] }`
using only the visible text. The endpoint validates types and total size,
requires the `sections` key when parsing, and returns the sections for review.
The client merges them non-destructively into the handbook editor (always
appended; a colliding title is suffixed, never overwritten), and the operator
reviews and Saves. The output is always operator-reviewed before it grounds any
answer, which is the mitigation for text-injection inside a photo.

## LLM provider abstraction

All model access lives in `functions/_shared/llm.ts`, so the provider is one
file. `runJson` prefers **Groq** (fast, OpenAI-compatible, JSON mode) when
`GROQ_API_KEY` is set and **falls back to Cloudflare Workers AI (Llama)**
automatically on any Groq error or unparseable response, so the demo never
breaks. `runVisionJson` uses Groq's multimodal model and requires the key.
`extractJson` parses defensively: it strips code fences, scans for the right
balanced object (optionally requiring a key), and repairs unescaped control
characters that open models sometimes emit.

## Offline mode and the PWA

The parent surface is an installable PWA that degrades gracefully with no
network. A web manifest (`public/manifest.webmanifest`) plus a hand-rolled
service worker (`public/sw.js`, no build dependency) make it installable and
cache the app shell and the handbook: navigations are network-first with a
cached-shell fallback, the handbook (`/api/kb`) is network-first and kept for
offline use, static assets are stale-while-revalidate, and the model endpoint is
never cached. Every fetch path yields a real `Response` (503 fallbacks), so it
cannot break the online app.

Answering is centralized in `askWithFallback()` (`src/parent/offline.ts`): online
it calls `/api/ask`; offline (or if the request fails) it answers on-device via
`answerOffline()`, which runs the safety screen first, then computes today's
lunch from the cached menu, then keyword-matches the cached handbook sections and
FAQs, with a clear fallback. Answers are marked `offline`. The offline safety
screen is kept byte-for-byte in lockstep with the server's `safety.ts` so a
health or emergency question escalates locally rather than getting an offline
guess (a deliberate mirror; see [DECISIONS.md](DECISIONS.md)). Tour and message
requests made offline are queued in `localStorage` and flushed on the `online`
event.

## Data model (Cloudflare D1)

- `kb (id=1, json, version, updated_at)`: the whole handbook as one JSON row,
  written with optimistic concurrency (writers send the version they read).
- `questions (...)`: the log of text, answer, confidence, category, status,
  needs_human, escalation_reason, and citations.
- `requests (..., urgent)`: captured tour requests and messages; `urgent` is a
  deterministic flag that floats time-sensitive messages to the top of the inbox.
- `kb_history (...)`: an audit trail of edits and taught entries.

## Security and guardrails

- Every D1 query uses bound parameters.
- The public chat endpoint caps input length, clamps history roles, and enforces
  a daily question ceiling.
- Operator routes pass through `operatorGate`; they are open in the demo for easy
  review and gate on `x-operator-passcode` when `OPERATOR_PASSCODE` is set.
- Secrets (the Groq key) are Cloudflare Pages secrets, never committed.

## File map

```
seed/center.json          the fictional center handbook (seed knowledge base)
schema.sql                D1 tables
functions/_shared/
  db.ts                   D1 access, Env, operator gate
  safety.ts               deterministic bilingual safety net (the trust layer)
  prompt.ts               grounding system prompt
  llm.ts                  Groq + Workers AI + vision + JSON parsing
functions/api/
  ask.ts                  parent-question orchestrator
  kb.ts                   read/write the handbook (optimistic concurrency)
  questions.ts            log, Gap Radar, one-tap teach
  requests.ts             tour/message capture (+ urgency) and operator inbox
  ingest.ts               handbook photo OCR -> sections
src/
  parent/Chat.tsx         parent chat UI + voice
  operator/Console.tsx    operator console (impact, log, gaps, inbox, handbook)
  lib/{api,types}.ts      client API helpers and shared types
```

## Extending it

- **Swap the LLM:** re-implement `runJson`/`runVisionJson` in `llm.ts`. Nothing
  else changes.
- **Add an intent or category:** extend the handbook sections; the model
  grounds on them with no code change. New categories touch `types.ts`,
  the prompt's category list, and the console labels.
- **Add a channel (SMS, voice):** add a Function that reuses `screen` +
  `buildSystemPrompt` + `runJson` and posts to the same log.
