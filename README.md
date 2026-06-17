# Cottonwood Sprouts AI Front Desk

An out-of-the-box **AI Front Desk** for early-education centers, built for the brightwheel take-home. A parent asks a question in plain language, by text or voice, in English or Spanish, and gets a fast, center-specific answer they can trust. An operator owns the source of truth, sees what families are asking and where the bot struggled, and improves the system in one tap.

**Live demo**
- Parent front desk: https://brightwheel-front-desk.pages.dev
- Operator control center: https://brightwheel-front-desk.pages.dev/operator

The center is fictional (Cottonwood Sprouts Early Learning, Albuquerque NM) and all data is invented.

## Who, what, why

**Who it serves.** The two people in brightwheel's world who feel the front-desk bottleneck most: the **operator** (a busy small-business owner who loses hours a day to repeat questions) and the **parent** (anxious and deeply caring, who just wants a fast, certain answer). Less admin for one, more peace of mind for the other.

**What it does.** Answers the high-volume questions a center hears every day, hours and closures, tuition, illness policy, lunch, tours, grounded in that center's own handbook with a visible source and a confidence signal. It hands off gracefully when it should not answer, and it captures tour requests and messages for staff. The operator side turns the questions the bot could not answer into new handbook entries with one tap.

**Why it is built this way.** In childcare a confident wrong answer is worse than no answer, so trust is the spine: answers are grounded and cited, a deterministic safety net handles anything medical before the model runs, and uncertainty escalates to a human instead of bluffing. The product is designed to compound: every gap a parent hits becomes coverage the operator approves, so the front desk gets better every day. See [docs/DECISIONS.md](docs/DECISIONS.md) for the full rationale and [docs/explanation.md](docs/explanation.md) for the one-page summary.

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
        |                         |
        v                         v
Cloudflare D1 (handbook,    Cloudflare Workers AI
question log, requests)     (Llama 3.3 70B, schema-guided JSON)
```

- **Frontend:** Vite + React 19 + TypeScript + Tailwind v4.
- **API:** Cloudflare Pages Functions (Workers runtime).
- **Data:** Cloudflare D1 (SQLite). One row holds the handbook JSON (optimistic-locked); tables log questions and capture requests.
- **LLM:** Cloudflare Workers AI (Llama 3.3 70B) with schema-guided JSON output. No external API key; it runs on the Cloudflare account. The provider is isolated in `functions/_shared/llm.ts`, so swapping to Groq, OpenAI, or Bedrock is a single-file change.
- **Grounding:** the whole handbook fits in the prompt, so there is no vector database. Retrieval is the scale path, not a day-one need.

## Project layout

```
seed/center.json          fictional center handbook (the seed knowledge base)
schema.sql                D1 tables
functions/_shared/
  db.ts                   D1 access + operator gate
  safety.ts               deterministic, bilingual pre-screen (the trust layer)
  prompt.ts               grounding system prompt (today's date, menu, language rule)
  llm.ts                  Workers AI client + robust JSON parsing
functions/api/
  ask.ts                  parent question -> safety -> rate cap -> ground -> answer -> log
  kb.ts                   read / write the handbook (optimistic concurrency)
  questions.ts            log, Gap Radar (cluster + draft), one-tap teach
  requests.ts             tour / message capture (with urgency flag) + operator inbox
src/parent/Chat.tsx       parent chat UI
src/operator/Console.tsx  operator console (impact, log, gaps, inbox, handbook, activity)
```
See [functions/README.md](functions/README.md) for the backend's who/what/why.

## Run locally

```bash
npm install
npm run build
npx wrangler d1 execute brightwheel-front-desk-db --local --file=./schema.sql
npx wrangler d1 execute brightwheel-front-desk-db --local --file=./seed-demo.sql
npx wrangler pages dev --port 8788
```

Workers AI runs against your Cloudflare account even in local dev, so run `npx wrangler login` once if needed. No other keys are required.

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
- Operator writes can be gated with an optional `OPERATOR_PASSCODE` (left open in the demo for easy review; documented in DECISIONS).
- No real personal data is used or requested.

## Switching the LLM provider

Re-implement `runJson` in `functions/_shared/llm.ts`. For Groq (OpenAI-compatible), point a `fetch` at `https://api.groq.com/openai/v1/chat/completions` with `response_format: { type: "json_object" }` and a `GROQ_API_KEY` secret. Nothing else changes.
