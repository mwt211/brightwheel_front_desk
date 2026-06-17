# Cottonwood Sprouts AI Front Desk: Full Documentation

This single document consolidates every project document for easy reading and sharing. Nothing has been removed: each source file still lives on its own, and this is an assembled copy of all of them in one place.

**Live demo:** parent https://brightwheel-front-desk.pages.dev / operator https://brightwheel-front-desk.pages.dev/operator

## Contents

1. Overview (README)
2. One-page summary
3. Feature list
4. Architecture
5. API reference
6. Decisions and rationale
7. Code provenance
8. Backend (Pages Functions)
9. Demo script
10. End-to-end test report



---

> Consolidated from `README.md`

# Cottonwood Sprouts AI Front Desk

An out-of-the-box **AI Front Desk** for early-education centers, built for the brightwheel take-home. A parent asks a question in plain language, by text or voice, in English or Spanish, and gets a fast, center-specific answer they can trust. An operator owns the source of truth, sees what families are asking and where the bot struggled, and improves the system in one tap, including by snapping a photo of their paper handbook.

**Live demo**
- Parent front desk: https://brightwheel-front-desk.pages.dev
- Operator control center: https://brightwheel-front-desk.pages.dev/operator

The center is fictional (Cottonwood Sprouts Early Learning, Albuquerque NM) and all data is invented.

## Who, what, why

**Who it serves.** The two people in brightwheel's world who feel the front-desk bottleneck most: the **operator** (a busy small-business owner who loses hours a day to repeat questions) and the **parent** (anxious and deeply caring, who just wants a fast, certain answer). Less admin for one, more peace of mind for the other.

**What it does.** Answers the high-volume questions a center hears every day, hours and closures, tuition, illness policy, lunch, tours, grounded in that center's own handbook with a visible source and a confidence signal. It hands off gracefully when it should not answer, and captures tour requests and messages for staff. The operator side turns the questions the bot could not answer into new handbook entries with one tap, and can stand up a brand-new center by photographing its paper handbook.

**Why it is built this way.** In childcare a confident wrong answer is worse than no answer, so trust is the spine: answers are grounded and cited, a deterministic safety net handles anything medical before the model runs, and uncertainty escalates to a human instead of bluffing. The product is designed to compound: every gap a parent hits becomes coverage the operator approves, so the front desk gets better every day.

## Documentation

| Doc | What it covers |
| --- | --- |
| [docs/FULL-DOCUMENTATION.md](docs/FULL-DOCUMENTATION.md) | Everything below, consolidated into one document. |
| [docs/explanation.md](docs/explanation.md) | The one-page summary to send with the live link. |
| [docs/FEATURES.md](docs/FEATURES.md) | Every feature, with the what and the why. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Full system walkthrough and request lifecycle. |
| [docs/API.md](docs/API.md) | Endpoint reference. |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Rationale, tradeoffs, brightwheel alignment, roadmap. |
| [docs/PROVENANCE.md](docs/PROVENANCE.md) | What we reused (open source, prior projects) vs. built, and why. |
| [functions/README.md](functions/README.md) | Backend layer (Pages Functions). |
| [docs/demo-script.md](docs/demo-script.md) | A roughly two-minute demo walkthrough. |
| [docs/TEST-REPORT.md](docs/TEST-REPORT.md) | End-to-end test results against the live site. |

## Features

**Parent chat**
- Mobile-first, text or voice input.
- Multilingual: detects and answers in the parent's language (Spanish supported today).
- Every answer shows its handbook source and a confidence signal.
- Sensitive or uncovered questions show an escalation card and a one-tap path to a human; tour and message requests are captured.
- **Works offline (installable PWA):** loads instantly, answers common questions from the cached handbook with no signal (the safety net still runs), and queues tour/message requests until reconnect.

**Operator control center**
- **Impact dashboard** ("Less admin. More impact."): estimated staff time saved, answer rate, and top topics.
- **Question log** with answered / escalated / gap counts and filters.
- **Gap Radar**: clusters the questions the bot could not answer, drafts a handbook entry for each, and lets the operator approve it in one tap. Health topics are flagged review-only and never auto-taught.
- **Snap a photo of your handbook**: upload photos of a paper handbook and a vision model drafts editable sections to review into the knowledge base.
- **Inbox** with urgent messages triaged to the top.
- **Handbook editor** (the single source of truth) with optimistic-locked saves, plus an activity trail.

## How it earns trust

1. **Grounded answers only.** The full handbook is injected into the prompt; the model answers only from it, cites the sections it used, and says plainly when something is not on file rather than guessing.
2. **A deterministic safety net runs before the model.** Medical, medication, emergency, and child-safety wording is caught by plain code (bilingual English and Spanish), not a prompt, and routed to a warm, hard-coded escalation that shares policy and points to a person or 911. The model never gets the chance to free-form medical advice.
3. **Confidence and escalation are first-class.** Low-confidence and sensitive answers surface an escalation card and are logged as gaps; they are never dressed up as certain.
4. **Fail safe, not silent.** If the model returns nothing usable, the system escalates to a human instead of inventing an answer.

## Architecture

```
Parent + Operator (React SPA on Cloudflare Pages)
        |
        v
Cloudflare Pages Functions (/functions/api/*)
        |                  |                    |
        v                  v                    v
Cloudflare D1        Groq (LLM answers,    Groq vision (handbook
(handbook, log,      Gap Radar)            photo OCR)
 requests)                |
                          v  fallback when no GROQ_API_KEY
                   Cloudflare Workers AI (Llama)
```

- **Frontend:** Vite + React 19 + TypeScript + Tailwind v4.
- **API:** Cloudflare Pages Functions (Workers runtime).
- **Data:** Cloudflare D1 (SQLite). One row holds the handbook JSON (optimistic-locked); tables log questions and capture requests.
- **LLM:** **Groq** (Llama 3.3 70B, OpenAI-compatible) is the primary provider when `GROQ_API_KEY` is set, with automatic **Cloudflare Workers AI** fallback so the demo always works. The provider is isolated in `functions/_shared/llm.ts`, so swapping is a single-file change.
- **Vision:** handbook photo OCR uses Groq's multimodal model.
- **Grounding:** the whole handbook fits in the prompt, so there is no vector database. Retrieval is the scale path, not a day-one need.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full walkthrough and [docs/API.md](docs/API.md) for endpoints.

## The Groq key on the live demo

The hosted demo is configured with a **free, disposable Groq API key**, stored as a Cloudflare Pages secret (`GROQ_API_KEY`) and **never committed to this repo**. The key the owner provided is set to **expire around mid-July 2026** (about 30 days from setup). When it expires, the live answers automatically fall back to Cloudflare Workers AI (so chat keeps working), and only the photo-import feature goes dark until a new key is set. To use your own key:

```bash
npx wrangler pages secret put GROQ_API_KEY --project-name brightwheel-front-desk
```

Secrets are kept out of git on purpose: this is a trust-focused product, and a committed key is exactly the anti-pattern it should avoid.

## Run locally

```bash
npm install
npm run build
npx wrangler d1 execute brightwheel-front-desk-db --local --file=./schema.sql
npx wrangler d1 execute brightwheel-front-desk-db --local --file=./seed-demo.sql
# optional: copy .dev.vars.example to .dev.vars and add your GROQ_API_KEY
npx wrangler pages dev --port 8788
```

Without a Groq key, chat falls back to Workers AI (which runs on your Cloudflare account, so run `npx wrangler login` once). Photo import needs the Groq key.

## Deploy

```bash
npm run build
npx wrangler pages deploy ./dist --project-name brightwheel-front-desk --branch main
npx wrangler d1 execute brightwheel-front-desk-db --remote --file=./schema.sql
npx wrangler d1 execute brightwheel-front-desk-db --remote --file=./seed-demo.sql
```

## Demo guardrails

- A daily question cap (`DAILY_QUESTION_CAP`, default 500) bounds model usage on a public endpoint.
- Input length is capped; history roles are clamped so the public endpoint cannot be used to inject a system prompt.
- Photo import caps image count and size; extracted sections are always operator-reviewed before they ground any answer.
- Operator writes can be gated with an optional `OPERATOR_PASSCODE` (left open in the demo for easy review).
- No real personal data is used or requested.

## Switching the LLM provider

Re-implement `runJson` / `runVisionJson` in `functions/_shared/llm.ts`. The current build ships Groq (primary) and Workers AI (fallback); adding OpenAI or Bedrock is the same shape.



---

> Consolidated from `docs/explanation.md`

# AI Front Desk for Early Education

**Live demo**
- Parent front desk: **https://brightwheel-front-desk.pages.dev**
- Operator control center: **https://brightwheel-front-desk.pages.dev/operator**

A working prototype of an out-of-the-box AI Front Desk: a parent asks a question by text or voice, in English or Spanish, and gets a fast, center-specific answer they can trust. The operator owns the source of truth, sees where the bot struggled, and improves it in one tap. Built for a fictional center (Cottonwood Sprouts, Albuquerque) with invented data.

## The problem

Administrators lose hours every day answering the same questions: hours and closures, tuition, illness policy, lunch, tours. The parent on the other end is anxious and busy, and a handbook PDF is the opposite of helpful at 7am with a feverish toddler. The job is not just to answer fast. It is to answer in a way a worried parent can trust, without adding work for an already stretched operator. That is brightwheel's mission in miniature: less admin, more time for what matters.

## Try it in about 90 seconds

1. On the parent page, tap the starters: "Are you open on Veterans Day?", "What's the tuition for infants?", "I forgot to pack lunch, what's for lunch today?" Note the **source chip** and **confidence dot** on each answer.
2. Ask in Spanish ("cuanto cuesta para bebes?"). It answers in Spanish.
3. Ask "My child has a fever, can they come in?" It never gives medical advice; a safety net shares the policy and routes to a person.
4. Ask something off-book ("Do you have a swimming pool?"). It says it doesn't have that on file and offers a human, instead of guessing.
5. Open `/operator`: see the **Impact** view (time saved, answer rate), the **urgent-first inbox**, **Gap Radar** (turn that swimming-pool gap into a handbook entry in one tap), and **Import from a photo** (upload the sample handbook page in `docs/sample-handbook.png` and watch new sections get drafted).

## How it earns trust

In childcare a confident wrong answer is worse than no answer, so this is the spine of the build:

- **Grounded and cited.** The model answers only from the center handbook and cites the section. It plainly says when something is not on file rather than guessing.
- **A safety net that is code, not a prompt.** Fever, medication, injury, emergency, and child-safety wording is caught by deterministic rules before the model runs, in both English and Spanish, and answered with a fixed escalation that shares policy and points to the director or 911.
- **Graceful uncertainty.** Low-confidence and sensitive replies escalate to a human and are logged as gaps.

## What makes it more than a chatbot

- **It teaches itself.** Gap Radar collects the questions the bot could not answer, drafts a handbook entry for each, and the operator approves in one tap. Coverage compounds. Health topics are held back for manual review.
- **It onboards a center in minutes.** Snap a photo of a paper handbook and a vision model drafts editable sections.
- **It shows its value.** The operator opens to estimated hours saved and answer rate, the metric a busy owner actually cares about.
- **It works on the go.** Installable to the home screen, and with no signal it still answers from the cached handbook (the safety net runs offline too) and queues messages until reconnect.

## Under the hood

Cloudflare end to end (Pages, Functions, D1) with **Groq** (Llama) as the language model and Cloudflare Workers AI as an automatic fallback, so it is fast, cheap, and never fully dark. The whole handbook fits in the prompt, so there is no vector database; retrieval is the scale path. The model provider lives behind one function, so swapping it is a single-file change. The build was peer-reviewed at each stage with a second AI (Codex), which caught and fixed real issues, including a Spanish-language bypass in the safety net.

## What I would build next

SMS and after-hours voice via Twilio, per-center theming and a shared policy library, a weekly operator digest, retrieval once a handbook outgrows one prompt, and a fail-closed operator login with human review on taught entries.

## Notes

Fictional data, no personal data used or requested. The live demo runs on a free, disposable Groq key set to expire about 30 days from setup; when it lapses, answers fall back to Workers AI automatically and only photo import pauses until a new key is set.



---

> Consolidated from `docs/FEATURES.md`

# Feature List

Every feature in the AI Front Desk, with what it does and why it exists. Grouped
by the parent experience, the operator experience, and the platform/trust layer
that underpins both. For how they fit together see
[ARCHITECTURE.md](ARCHITECTURE.md); for endpoints see [API.md](API.md).

---

## Parent experience

### Natural-language Q&A (text)
- **What:** A parent types a question in plain language ("Are you open on Veterans Day?") and gets a direct, specific answer, not a document to search.
- **Why:** Handbooks are unsearchable on a phone and operators can't always pick up. The whole point is a fast answer in the moment, the way the parent actually asks.

### Voice input
- **What:** A microphone button dictates the question using the browser's Web Speech API; it is feature-detected and silently hidden where unsupported. Dictation works in English and Spanish, following the page-language toggle next to it (which sets both the UI language and the recognition language, defaulting to the browser's).
- **Why:** Parents are often hands-full (holding a child, in the pickup line, driving up). Voice removes the friction of typing, and supporting Spanish dictation extends the multilingual promise to the voice path, not just typing.

### Starter questions
- **What:** The welcome screen offers the most common questions as one-tap chips (hours, infant tuition, fever, lunch, tours).
- **Why:** They solve the cold-start problem, show the assistant's scope at a glance, and let a parent get value in a single tap.

### Multilingual, whole-page (Spanish today)
- **What:** The assistant answers in the language of the question, and the entire parent UI follows. The language is auto-detected from each sent message (typed or dictated), so when a parent writes or speaks Spanish, every label, starter, button, and the request form switch to Spanish, and back to English just as easily. A manual EN/ES toggle is also available and sets the voice-recognition language to match.
- **Why:** A large share of childcare families speak Spanish. Equitable access is core to brightwheel's mission, and a parent should never have to translate their own question or read a half-translated page.

### Grounded, cited answers
- **What:** Every answer is drawn only from the center's handbook and shows the source section as a chip ("Source: Tuition & Fees").
- **Why:** Trust. The parent can see where the answer came from, and the system cannot invent tuition figures, dates, or policies it was never given.

### Confidence signal
- **What:** A small colored dot and label mark each answer as high, medium, or low confidence ("From our handbook" / "Partly covered; please confirm" / "Not in our handbook").
- **Why:** Honesty about certainty sets the right expectation and tells a parent when to double-check with a person.

### Graceful escalation
- **What:** When a question is sensitive or not covered, the answer shows an escalation card ("A team member should help with this") with one-tap actions to call or message the front desk.
- **Why:** A confident wrong answer is worse than no answer. Escalating, rather than bluffing, protects the family and the center and reassures an anxious parent that a human is available.

### Tour and message capture
- **What:** Suggested actions open a short sheet to request a tour or leave a message; the request is saved for staff, with a clear success or failure state.
- **Why:** It turns intent into a captured lead or message even when no one is at the desk, so the front desk works after hours and nothing falls through the cracks.

### Date and menu awareness
- **What:** The server injects today's date and day of week, so "what's for lunch today?" returns the right day's menu and "are you open on Juneteenth?" resolves against the calendar.
- **Why:** Time-relative questions are some of the most common, and they have to be exactly right or trust evaporates.

### "Start over" control
- **What:** Once a conversation begins, a back pill in the header clears the thread and returns to the welcome screen with the starter prompts.
- **Why:** A parent (or a reviewer) is never stuck on a single ask and response; they can run through different questions easily.

### Typing indicator and fail-safe response
- **What:** A typing animation shows the assistant is working; if the model returns nothing usable, the reply escalates to a human instead of erroring out.
- **Why:** Perceived responsiveness matters on mobile, and the experience should never dead-end on a blank or broken state.

### Mobile-first design
- **What:** The parent surface is laid out for a phone first (single column, large tap targets, sticky composer).
- **Why:** Parents live on their phones, and brightwheel's parent experience is mobile by default.

### Installable, works offline (PWA)
- **What:** A web manifest and a service worker make the front desk installable to the home screen and load it instantly. After the first visit it works with no connection: the app shell and the center handbook are cached on-device.
- **Why:** Parents are on the go with spotty signal. The front desk shouldn't be a blank screen in a parking lot or a basement classroom.

### On-device answers when offline
- **What:** With no network, the assistant answers common questions from the cached handbook by keyword match (hours, tuition, today's lunch computed locally, holidays), each clearly marked "Offline" with its source. The deterministic safety net still runs, so a fever, medication, or emergency question escalates locally rather than getting an offline guess. Tour and message requests left offline are saved and sent automatically on reconnect.
- **Why:** A parent without signal still gets a useful, honest answer, sensitive questions are still handled safely, and nothing they submit is lost.

---

## Operator experience

### Impact dashboard
- **What:** The operator console opens to a banner showing estimated staff time saved, the share of questions answered instantly, and how many of the total were handled, with the top topics shown as chips beneath.
- **Why:** It proves value in the operator's own language ("Less admin. More impact."). A busy owner needs to see hours reclaimed, which is the case for adopting and funding it.

### Question log with filters and counts
- **What:** Every question is logged with its answer, confidence, category, and status, with answered / escalated / gap counts and status filters.
- **Why:** It gives the operator visibility into what families actually ask and where the assistant struggled, which is the raw material for improving it.

### Gap Radar (self-teaching loop)
- **What:** On demand, it gathers the questions the assistant could not confidently answer, clusters them into themes, and drafts a handbook section for each.
- **Why:** A static FAQ bot decays. Gap Radar converts the gaps parents hit into proposed coverage, so the system gets better every day instead of going stale.

### One-tap teach
- **What:** The operator approves a drafted section and it is appended to the handbook immediately, so the parent assistant can answer that question from then on.
- **Why:** Improving the system has to cost the operator almost nothing, or it won't happen. One tap closes the loop and the coverage compounds.

### Review-only health flagging
- **What:** Gap Radar themes that touch health, illness, medication, allergy, injury, or safety are flagged review-only and cannot be taught with one tap; the operator must add them by hand after review.
- **Why:** Medical content must never be auto-published by a model. This keeps a human in the loop for exactly the content where a mistake is most costly.

### Snap a photo of your handbook
- **What:** The operator uploads photos of a paper handbook; a vision model transcribes and structures them into editable sections, lists the section titles it drafted for confirmation, and on approval merges them into the editor to review and save. The merge is non-destructive: a section whose title already exists is added separately (suffixed "(imported)") rather than overwriting existing content.
- **Why:** It takes real work off the operator's plate. A brand-new center goes from a paper binder to a working AI front desk in minutes, with no retyping, so staff spend their time with the children.

### Urgent-message triage
- **What:** The inbox of tour requests and messages flags time-sensitive ones (words like fever, sick, hurt, emergency, "today," "asap," and Spanish equivalents such as fiebre, enfermo, hoy) and floats them to the top.
- **Why:** A stretched operator should see what needs action now first, so a parent with an urgent need is not buried under routine requests.

### Handbook editor with optimistic concurrency
- **What:** The handbook is editable in place (center details and sections) and via a raw-JSON mode; saves are version-checked and reject a stale write with a clear conflict message.
- **Why:** The operator owns the single source of truth, and version checking prevents one edit from silently clobbering another.

### Activity trail
- **What:** A log records handbook edits and entries taught through Gap Radar, with timestamps.
- **Why:** Transparency. The operator (and anyone reviewing) can see how the knowledge base evolved and what the assistant was taught.

### Parent/operator view toggle and gate
- **What:** Each view links to the other: the operator console has a "Parent view" link and the parent header has an "Operator view" link, so a reviewer can bounce between the two perspectives in one click. Operator write routes pass through a soft passcode gate that is open in the demo and enforced when `OPERATOR_PASSCODE` is set.
- **Why:** Easy navigation between the two sides for a demo, with a clear path to hide the operator entry point and lock the console down for a real deployment.

---

## Platform, trust, and safety

### Deterministic safety net (bilingual)
- **What:** Before the model runs, plain code screens the question for medical, medication, emergency, and child-safety wording, in English and Spanish, and returns a fixed, localized escalation (call the director, or 911 for emergencies). It runs before the rate cap, so an emergency is never blocked by a cost guard.
- **Why:** This is the load-bearing trust feature. A model can be argued out of a rule; code cannot. Making it bilingual closes the gap where a Spanish health question could otherwise reach the model.

### Groq with automatic Workers AI fallback
- **What:** Groq (Llama 3.3 70B, OpenAI-compatible) is the language model when `GROQ_API_KEY` is set; on any Groq error or unparseable response the system falls back to Cloudflare Workers AI automatically.
- **Why:** Groq is fast, free, and follows instructions well; the fallback means the demo never goes fully dark even if the key lapses or Groq is unavailable.

### Full-handbook grounding (no vector database)
- **What:** The entire handbook is injected into the prompt rather than retrieved in fragments.
- **Why:** The handbook is small, so retrieval adds cost and failure modes for no benefit. brightwheel's own guidance is that answer quality matters more than document parsing; retrieval is the scale path, not a day-one need.

### Schema-guided JSON with tolerant parsing
- **What:** The model is asked for one structured JSON object (answer, citations, confidence, category, needs_human, escalation, actions), parsed defensively to repair code fences and stray control characters and to require the expected key for photo OCR.
- **Why:** Reliable citations, confidence, and escalation depend on structured output, and open models occasionally emit slightly malformed JSON that should not break the experience.

### Server-side persistence (Cloudflare D1)
- **What:** The handbook, the question log, and captured requests live in a SQLite database, not the browser.
- **Why:** It makes the loop real: an operator edits the handbook and the very next parent, on any device, sees the change. Local-only state would make that demo a fiction.

### Provider abstraction
- **What:** All model access lives in one file (`functions/_shared/llm.ts`).
- **Why:** Swapping to a different provider (OpenAI, Bedrock) is a single-file change, so the build is not locked to one vendor.

### Guardrails and limits
- **What:** The public chat endpoint caps input length, clamps history roles to user/assistant (so it cannot be used to inject a system prompt), and enforces a rolling daily question ceiling; photo import caps image count and total size; the model output fails safe to a human handoff.
- **Why:** A public, model-backed endpoint needs cost and abuse protection, and the safety claims only hold if the obvious bypasses are closed.

### Secret hygiene
- **What:** API keys are stored as Cloudflare Pages secrets and a gitignored local file, never committed to the repository.
- **Why:** A trust-focused product should model good security; a committed key is exactly the anti-pattern it should avoid.



---

> Consolidated from `docs/ARCHITECTURE.md`

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



---

> Consolidated from `docs/API.md`

# API Reference

All endpoints are Cloudflare Pages Functions under `/api`, same origin as the
SPA. Public endpoints are unauthenticated; operator endpoints pass through
`operatorGate` (open in the demo, gated by an `x-operator-passcode` header when
`OPERATOR_PASSCODE` is set). When that gate is set, operator endpoints return
HTTP 401 if the header is missing or wrong.

## POST /api/ask  (public)

Ask the front desk a question.

Request:
```json
{ "text": "Are you open on Veterans Day?",
  "history": [{ "role": "user", "content": "..." }] }
```
`history` is optional (last 6 turns used; roles other than user/assistant are dropped).

Response (the structured answer plus server fields):
```json
{
  "answer": "Yes, we are open on Veterans Day with normal hours.",
  "confidence": "high",
  "citations": [{ "section": "Hours & Closures", "quote": "..." }],
  "category": "hours_calendar",
  "needs_human": false,
  "escalation_reason": "",
  "suggested_actions": [{ "label": "Schedule a tour", "action": "schedule_tour" }],
  "status": "answered",
  "question_id": 42,
  "safety_intercept": true
}
```
`safety_intercept` is present only when the deterministic safety net handled the
question. `status` is `answered | escalated | unanswered`.

## GET /api/kb  (public) · PUT /api/kb  (operator)

`GET` returns `{ kb, version }`. `PUT` saves the handbook with optimistic
concurrency:
```json
{ "kb": { ...CenterKB }, "version": 3 }
```
Returns `{ ok: true, version }` or HTTP 409 `{ error: "conflict", current }` if
the handbook changed since `version` was read.

## GET /api/questions  (operator)

- `?view=log` (default): `{ questions: [...] }`, the full log.
- `?view=gaps`: `{ clusters: [...] }`, the Gap Radar themes, each with example
  questions, a `reviewOnly` flag, and a drafted `{ title, body }` section.
- `?view=history`: `{ history: [...] }`, the activity trail.

## POST /api/questions  (operator)

Teach the bot one section (Gap Radar approval):
```json
{ "title": "Facilities & Amenities", "body": "...", "theme": "..." }
```
Appends or replaces by title, bumps the handbook version, logs to history.

## POST /api/requests  (public) · GET /api/requests  (operator)

`POST` captures a tour request or message; urgency is flagged deterministically:
```json
{ "kind": "tour" | "message", "name": "...", "contact": "...",
  "message": "...", "related_question_id": 42 }
```
`GET` returns `{ requests: [...] }` with urgent items first.

## POST /api/ingest  (operator)

Turn handbook photos into editable sections (Groq vision; requires
`GROQ_API_KEY`).
```json
{ "images": ["data:image/jpeg;base64,..."] }
```
Up to 4 images, about 5MB each as uploaded (the limit is checked on the base64
data URL) and ~12MB total. Returns `{ sections: [{title, body}] }`
for operator review (it does not save). Error codes: 400 (missing key or no
images), 413 (too large), 422 (unreadable), 502 (upstream failure).



---

> Consolidated from `docs/DECISIONS.md`

# Decisions and Rationale

The "why" behind the build, the tradeoffs taken, and how it maps to brightwheel.

## Product decisions

**Trust before breadth.** The hardest part of this problem is not answering questions, it is answering them in a way an anxious parent can rely on and a busy operator can stand behind. So the spine is grounding, citations, a confidence signal, and graceful escalation, and only then breadth across intents.

**The self-teaching loop is the differentiator.** A static FAQ bot decays. Gap Radar turns every question the bot could not answer into a drafted handbook entry the operator approves in one tap, so coverage compounds instead of going stale. This is the feature most likely to make a team want to fund it.

**Operator impact is surfaced, not buried.** The console leads with estimated staff time saved, answer rate, and top topics. brightwheel sells "Less admin. More impact," and the operator should see that impact, not infer it.

**Multilingual is empathy, not a checkbox.** Many childcare families speak Spanish. The assistant detects and answers in the parent's language, and, critically, the safety net is bilingual too, so a Spanish health question cannot slip past the guardrail.

## Technical decisions

**Deterministic safety net, not an LLM guardrail.** Medical, medication, emergency, and child-safety wording is caught by plain bilingual regex before the model runs and answered with a fixed, warm escalation. A model can be argued out of a rule; code cannot. This is the single most important design choice.

**Full-handbook grounding, no vector database.** The handbook fits in the prompt, and brightwheel's own guidance is that response quality matters more than document parsing. Retrieval is named as the scale path, not built on day one.

**Schema-guided JSON over free text.** The model returns one structured object (answer, citations, confidence, escalation, actions) via Workers AI's guided JSON, with tolerant parsing and a fail-safe-to-human fallback. This is what makes citations and confidence reliable.

**Groq as the primary model, Workers AI as the floor.** Groq (Llama 3.3 70B, OpenAI-compatible) is fast and free and gives noticeably crisper instruction-following for citations and escalation. But a demo must never go dark, so when `GROQ_API_KEY` is absent or Groq errors, `runJson` falls back to Cloudflare Workers AI automatically. The whole provider lives in one file, so this is a swap, not a rewrite.

**Photo handbook import is onboarding, not magic.** The fastest way to make a real center valuable on day one is to ingest the handbook they already have on paper. A vision model OCRs the photos into structured sections, but the model never writes directly to the source of truth: the operator reviews every drafted section, the merge is non-destructive (append, never overwrite), and review is the explicit mitigation for any text injected into a photo.

**Offline is honest degradation, not a fake AI.** The model is remote, so there is no real offline LLM. Instead of pretending, offline mode caches the handbook and answers common questions on-device by keyword match, clearly marked offline, and queues any requests for reconnect. The one non-negotiable: the safety net runs offline too, so a health or emergency question never gets an on-device medical guess. We hand-rolled the service worker rather than add a PWA build plugin, to keep the runtime dependency footprint at zero (React only).

**The offline safety net mirrors the server, on purpose.** The client safety patterns are kept byte-for-byte identical to `functions/_shared/safety.ts`. A shared module across the Vite and Workers build contexts would risk the Pages Functions bundle, so the mirror is documented and verified by the review passes instead. If the patterns grow, a shared pure-pattern module is the next step.

**Cloudflare end to end.** Pages, Functions, D1, and Workers AI on one platform means the demo is free, persists across devices, and keeps the fallback path keyless, which is what makes the operator-edits-then-parent-sees-it loop feel real rather than staged.

**Open operator console for the demo.** Operator routes are open by default so a reviewer can explore both sides immediately. `OPERATOR_PASSCODE` gates them when set; a real deployment would fail closed. This is a deliberate demo tradeoff, not an oversight.

## How it maps to brightwheel

- **Deliver Value for Customers:** the impact dashboard quantifies hours saved; answers are specific and grounded.
- **Get Better Every Day:** Gap Radar is this principle as a product feature.
- **Take Ownership:** the front desk handles the question end to end, or hands it to a person, rather than dropping it.
- **Dive Deep / Think Critically:** the operator sees exactly where the bot struggled, with confidence and category, not just a transcript.
- **The mission ("more time teaching"):** every question answered without staff is time returned to the classroom.

## What I would build next

See the roadmap in [explanation.md](explanation.md): SMS and after-hours voice
via Twilio, per-center theming and a shared policy library, a weekly operator
digest, retrieval once a handbook outgrows one prompt, and a fail-closed
operator login with human review on taught entries.



---

> Consolidated from `docs/PROVENANCE.md`

# Code Provenance

An honest accounting of where the code in this prototype came from: open-source
dependencies, code adapted from prior projects, patterns we learned from
open-source work, and what is original. The short version: the runtime footprint
is tiny (React only), one small file was adapted from a prior personal project,
and essentially all of the product logic, the API, and the UI are original.

## Open-source dependencies (npm)

The only runtime dependencies are React and React DOM. Everything else is build
and type tooling. We deliberately kept this minimal: no chat framework, no RAG
library, no component kit.

| Package | Role | Why this one |
| --- | --- | --- |
| `react`, `react-dom` | UI runtime | Standard, and the parent surface is a small SPA. |
| `vite`, `@vitejs/plugin-react` | Build/dev server | Fast, zero-config for React + TS. |
| `tailwindcss`, `@tailwindcss/vite` | Styling | Utility CSS keeps the UI in one place without a component library. |
| `typescript`, `@types/react`, `@types/react-dom` | Types | Type safety across UI and shared types. |
| `wrangler`, `@cloudflare/workers-types` | Cloudflare CLI + types | Deploy and type the Pages Functions and D1. |

There is no vector database, no LLM SDK, and no HTTP client library: the API
handlers call Groq and Cloudflare Workers AI with plain `fetch` and the AI
binding. (An earlier draft used `aws4fetch` to sign AWS Bedrock calls; it was
removed when we moved off Bedrock.)

## Managed services and models (external, not code)

- **Cloudflare** Pages, Pages Functions, D1, and Workers AI (Llama fallback).
- **Groq** for the primary model: `llama-3.3-70b-versatile` (text) and
  `meta-llama/llama-4-scout-17b-16e-instruct` (handbook photo OCR).

These are services we call, not code we vendored.

## Adapted from prior projects (internal reuse, not public open source)

Two of the author's earlier projects on the same machine informed a small amount
of this code. These are personal projects, not public open-source repos, so this
is internal reuse rather than an open-source dependency.

- **`src/parent/voice.ts`**: adapted from the "Sally" personal-assistant app. It
  is a thin, feature-detected wrapper over the browser Web Speech API. We took
  the `SpeechRecognition` portion, dropped Sally's `MediaRecorder` + Whisper
  fallback, and then extended it in this project to accept a language so
  dictation works in English and Spanish. *Why reuse it:* a cross-browser,
  feature-detected voice wrapper is fiddly to get right, and this one was proven.
- **AWS Bedrock request shape (removed).** Early on, the structured-tool request
  body was ported from the author's "EMR" project (`buildBedrockBody`). When we
  switched the model provider to Groq and Workers AI, that file was deleted, so
  none of it ships today; it only informed the initial structured-output design.
- **Visual palette.** The warm, calm green/cream theme was inspired by the EMR
  project's design-token approach. The tokens here are our own, not copied.

## Patterns learned from open-source work (no code copied)

Before building, we surveyed open-source projects and write-ups on grounded
question answering: Haystack, LlamaIndex, ChatFAQ, and several best-practice
articles on citations, confidence, and escalation. We adopted the *ideas* (cite
the source section, treat low confidence as a reason to defer, route sensitive
questions to a human) but wrote original, much simpler code for them. We did not
use any of those frameworks. *Why not:* the handbook fits in a single prompt, so
a retrieval pipeline would add cost and failure modes for no benefit, and a
deterministic safety net is more trustworthy than an LLM-based guardrail.

## Built for this project (original)

Essentially all of the product is original to this prototype:

| File / feature | What it is |
| --- | --- |
| `functions/_shared/safety.ts` | The deterministic, bilingual safety net. Original. |
| `functions/_shared/prompt.ts` | The grounding system prompt (date, menu, rules). Original. |
| `functions/_shared/llm.ts` | Provider layer: Groq with Workers AI fallback, vision, tolerant JSON parsing. Original (the Groq call shape is the standard OpenAI-compatible one; the fallback and parser are ours). |
| `functions/_shared/db.ts` + `schema.sql` | D1 schema and access, optimistic-locked handbook, operator gate. Original. |
| `functions/api/ask.ts` | The parent-question orchestrator. Original. |
| `functions/api/questions.ts` | The Gap Radar self-teaching loop and one-tap teach. Original. |
| `functions/api/ingest.ts` | "Snap a photo of your handbook" OCR-to-sections. Original. |
| `functions/api/kb.ts`, `requests.ts` | Handbook read/write and the urgency-triaged inbox. Original. |
| `src/parent/Chat.tsx` | The parent chat UI (citations, confidence, escalation, start-over, voice toggle). Original; the message-thread shape was loosely informed by Sally's chat view but rewritten. |
| `src/operator/Console.tsx` | The operator console: impact dashboard, log, Gap Radar, inbox, handbook editor, photo import. Original. |
| `src/parent/offline.ts` | On-device offline answering, the bilingual safety mirror, KB cache, and the request queue. Original. |
| `public/sw.js` | The service worker, hand-rolled with no PWA build plugin (zero runtime deps). Original. |
| `seed/center.json` | The fictional Cottonwood Sprouts handbook content. Original. |
| Product concepts | Gap Radar, the impact dashboard, photo onboarding, urgent triage, and offline mode are original to this build. |

## In one sentence

We stood on React and the Cloudflare/Groq platforms, reused one small proven
voice helper from a prior personal project, learned the grounded-answer patterns
from open-source work without taking their code, and wrote the safety net, the
grounding, the self-teaching loop, the photo onboarding, and both UIs ourselves.



---

> Consolidated from `functions/README.md`

# Backend (Cloudflare Pages Functions)

**Who.** Serves both surfaces: the parent chat and the operator console. **What.** A handful of small HTTP handlers over Cloudflare D1 and Workers AI. **Why.** Each file has one job and one reason to change, so the trust-critical logic stays easy to read and verify.

## Request flow (a parent question)

`POST /api/ask` is the spine, and the order is deliberate:

1. **Validate** input (non-empty, length-capped).
2. **Safety screen first** (`_shared/safety.ts`). A deterministic, bilingual regex catches medical / emergency / child-safety wording and returns a hard-coded escalation. This runs before the rate cap and before the model, so an emergency is never swallowed by a cost guard or answered by the LLM.
3. **Rate cap.** A rolling 24h ceiling on model-backed questions bounds cost on a public endpoint. Safety questions never reach this gate.
4. **Ground and answer** (`_shared/prompt.ts` + `_shared/llm.ts`). The full handbook is injected; the model returns one JSON object (answer, citations, confidence, escalation, suggested actions). The model is Groq when `GROQ_API_KEY` is set and Cloudflare Workers AI otherwise. History roles are clamped to user/assistant so the endpoint cannot be used to inject a system prompt.
5. **Normalize and log.** The result is normalized defensively (bad model output fails safe to a human handoff) and written to the question log.

## Files

| File | Responsibility |
| --- | --- |
| `_shared/db.ts` | All D1 SQL: seed-on-read handbook, optimistic-locked writes, question log, requests, history, operator gate. |
| `_shared/safety.ts` | The deterministic trust layer. Bilingual triggers; localized, hard-coded escalations. Plain code on purpose. |
| `_shared/prompt.ts` | Builds the grounding system prompt from the handbook, today's date and menu, and the answer-only-from-this rules. |
| `_shared/llm.ts` | Model access: Groq (primary, when `GROQ_API_KEY` is set) with Workers AI fallback, plus Groq vision for photo OCR and tolerant JSON extraction. The only file to touch to swap providers. |
| `api/ask.ts` | The parent-question orchestrator described above. |
| `api/kb.ts` | Read the handbook (public) and write it (operator, version-checked). |
| `api/questions.ts` | Operator log, Gap Radar (cluster + draft), and one-tap teach. |
| `api/requests.ts` | Capture tour requests and messages (with an urgency flag) and serve the operator inbox. |
| `api/ingest.ts` | Operator photo import: Groq vision OCRs handbook photos into `{sections}` for review. |

## Conventions

- Every D1 query uses bound parameters.
- Operator routes pass through `operatorGate`; PHI-style reads and the inbox are gated when `OPERATOR_PASSCODE` is set.
- The KB is a single JSON row with a `version` for optimistic concurrency; writers send the version they read.



---

> Consolidated from `docs/demo-script.md`

# Demo Script

A tight walkthrough (about two minutes) for a screen recording or live demo. Two tabs open: parent at `/`, operator at `/operator`.

## The Hook (0:00 to 0:15)
"Admins lose hours a day answering the same questions, and parents just want a fast answer they can trust. This is an out-of-the-box AI Front Desk. Here is the parent side."

## Trustworthy, Grounded Answers (0:15 to 0:45)
On the parent tab, tap the starters in order:
- "Are you open on Veterans Day?" Point out the answer plus the "Source: Hours & Closures" chip and the confidence dot.
- "What's the tuition for infants?" Note the exact figure with its citation. "Grounded in the handbook, not guessed."
- "I forgot to pack lunch. What's for lunch today?" Note it knows today's menu.

## Multilingual and Safety (0:45 to 1:05)
- Type a question in Spanish, for example "cuanto cuesta para bebes?" The whole page switches to Spanish and the answer is cited. "It meets families in their language."
- Ask "My child has a fever, can they come in?" (or the Spanish equivalent). "This never gives medical advice. A deterministic safety net, in both languages, catches it before the model, shares the policy, and routes to a person."
- Ask "Do you have a swimming pool?" "Not in the handbook, so it does not bluff. It says so, offers a human, and logs this as a gap."
- (Optional, on the go) Switch on airplane mode or DevTools "Offline," then ask "what are your hours?" It answers from the saved handbook, marked Offline, and a fever question still escalates locally. Leave a message and it queues until reconnect.

## The Operator Side and the Loop (1:05 to 1:45)
Switch to the operator tab:
- Impact view: "Staff time saved, answer rate, top topics. Less admin, more impact."
- Inbox: "Urgent messages are triaged to the top." Point at the flagged fever pickup.
- Handbook tab, "Import from a photo": "A brand-new center can onboard in minutes. Snap the paper handbook and we draft the sections." Upload `docs/sample-handbook.png` and watch the new sections appear for review.
- Gap Radar: click "Scan for gaps." "It groups the questions the bot could not answer and drafts a handbook entry for each. Health topics are flagged review-only." Approve the swimming-pool draft.
- Back to the parent tab, ask "Do you have a swimming pool?" again. It now answers with a citation. "One tap, and the front desk taught itself."

## Close
"Grounded, honest, multilingual, and self-improving. Cloudflare end to end, free to run, and the model is one swappable function away from any provider you want."



---

> Consolidated from `docs/TEST-REPORT.md`

# End-to-End Test Report

A full end-to-end test was run against the live deployment on 2026-06-17. Every
testable feature passed. The live demo was reset to a clean, curated state after
the run.

**Environment:** https://brightwheel-front-desk.pages.dev (parent) and
`/operator` (operator), on Cloudflare Pages, Groq as the model with the Workers
AI fallback. Build is green (`tsc -b && vite build`, functions typecheck clean).

## Results

| Area | Test | Result |
| --- | --- | --- |
| Grounded answers | "Are you open on Veterans Day?" | High confidence, cited Hours & Closures, "open with normal hours" |
| | "What's the tuition for infants?" | High, cited Tuition & Fees, "$1,485 per month" |
| | "What's for lunch today?" | High, cited Meals & Snacks + Weekly Lunch Menu, today's menu |
| | "How do I schedule a tour?" | High, cited Tours & Enrollment |
| Multi-section | Spanish: tuition + open tomorrow | High, cited Tuition & Fees + Hours & Closures, answered in Spanish |
| Graceful gap | "Do you have a swimming pool?" | Low confidence, "not on file," logged as a gap |
| Multilingual | Spanish question | Answered in Spanish (the page also switches client-side) |
| Safety (illness) | "my child has a fever" (EN and ES) | Intercepted, escalated, policy cited, no medical advice |
| Safety (emergency) | "passed out and bleeding" | Intercepted, "call 911" escalation (new emergency terms) |
| Safety (medication) | "how much Tylenol should I give" | Intercepted, escalated, no dosing advice |
| Gap Radar | Scan the question log | Clustered into themes; the health theme flagged review-only |
| Self-teaching loop | Approve a drafted section, re-ask the pool question | Now high confidence, cited the newly taught section |
| Photo import | Upload `docs/sample-handbook.png` | OCR'd into "Naptime and Rest" and "Birthdays and Celebrations" |
| Inbox triage | Post a tour and an urgent message | Urgent fever-pickup message floated to the top of the inbox |
| Analytics | Question log and activity history endpoints | Return logged questions and edit/teach history |
| PWA | sw.js, manifest.webmanifest, icons | All serve 200 (service worker `cws-v2`) |

## Offline mode

The offline path is browser-only, so it is not exercised by the API test above.
Its logic was peer-reviewed twice with Codex (safety parity with the server net
confirmed) and the PWA assets serve. To verify by hand: open the parent page
once with a connection, then enable airplane mode or DevTools "Offline" and ask
"what are your hours?" The answer comes from the saved handbook, marked Offline;
a fever question still escalates locally; a message left offline queues and sends
on reconnect.

## How to reproduce

Follow [demo-script.md](demo-script.md) in a browser, or exercise the API
directly per [API.md](API.md). The curated demo data is seeded by
`seed-demo.sql`.

