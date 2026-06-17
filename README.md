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
| [docs/explanation.md](docs/explanation.md) | The one-page summary to send with the live link. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Full system walkthrough and request lifecycle. |
| [docs/API.md](docs/API.md) | Endpoint reference. |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Rationale, tradeoffs, brightwheel alignment, roadmap. |
| [functions/README.md](functions/README.md) | Backend layer (Pages Functions). |
| [docs/demo-script.md](docs/demo-script.md) | A ~2 minute demo walkthrough. |

## Features

**Parent chat**
- Mobile-first, text or voice input.
- Multilingual: detects and answers in the parent's language (Spanish supported today).
- Every answer shows its handbook source and a confidence signal.
- Sensitive or uncovered questions show an escalation card and a one-tap path to a human; tour and message requests are captured.

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
