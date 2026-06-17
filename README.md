# Cottonwood Sprouts AI Front Desk

A working prototype of an out-of-the-box **AI Front Desk** for early-education centers, built for the brightwheel take-home. A parent asks a question in plain language and gets a fast, center-specific answer they can trust. An operator owns the source of truth, sees what families are asking, and improves the system in one tap.

**Live demo**
- Parent front desk: https://brightwheel-front-desk.pages.dev
- Operator control center: https://brightwheel-front-desk.pages.dev/operator

The center is fictional (Cottonwood Sprouts Early Learning, Albuquerque NM) and all data is invented.

## What it does

**Parent chat.** Mobile-first. Ask by text or voice, or tap a common question. Every answer is grounded in the center handbook and shows its source ("Source: Tuition & Fees"), a confidence signal, and a one-tap path to a human when needed. Tour and message requests are captured for staff.

**Operator console.** Edit the handbook (the single source of truth), watch the question log with answered / escalated / gap counts, read the tour and message inbox, and run **Gap Radar**: it finds the questions the assistant could not confidently answer, groups them, drafts a handbook entry for each, and lets the operator approve it in one tap. Approving immediately improves the parent assistant. The front desk teaches itself.

## How it earns trust

1. **Grounded answers only.** The full handbook is injected into the prompt and the model is told to answer only from it, cite the sections it used, and say plainly when something is not on file rather than guess.
2. **A deterministic safety net runs before the model.** Anything that reads as a medical, medication, emergency, or child-safety question is caught by plain code (not a prompt) and routed to a warm, hard-coded escalation that shares policy and points to a human or 911. The model never gets the chance to free-form medical advice.
3. **Confidence and escalation are first-class.** Low-confidence and sensitive answers surface an escalation card instead of a false-confident reply, and are logged as gaps for the operator.
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
question log, requests)     (Llama 3.3 70B)
```

- **Frontend:** Vite + React 19 + TypeScript + Tailwind v4.
- **API:** Cloudflare Pages Functions (Workers runtime).
- **Data:** Cloudflare D1 (SQLite). One row holds the handbook JSON (optimistic-locked); tables log questions and capture requests.
- **LLM:** Cloudflare Workers AI (Llama 3.3 70B) with schema-guided JSON output. No external API key; it runs on the Cloudflare account. The provider is isolated in `functions/_shared/llm.ts`, so swapping to Groq, OpenAI, or Bedrock is a single-file change.
- **Grounding:** the whole handbook fits in the prompt, so there is no vector database. brightwheel's own guidance is that response quality matters more than document parsing; retrieval is the scale path, not a day-one need.

## Project layout

```
seed/center.json          fictional center handbook (the seed knowledge base)
schema.sql                D1 tables
functions/_shared/
  db.ts                   D1 access + operator gate
  safety.ts               deterministic pre-screen (the trust layer)
  prompt.ts               grounding system prompt (+ today's date and menu)
  llm.ts                  Workers AI client + robust JSON parsing
functions/api/
  ask.ts                  parent question -> safety -> ground -> answer -> log
  kb.ts                   read / write the handbook (optimistic concurrency)
  questions.ts            log, Gap Radar (cluster + draft), one-tap teach
  requests.ts             tour / message capture + operator inbox
src/parent/Chat.tsx       parent chat UI
src/operator/Console.tsx  operator console
```

## Run locally

```bash
npm install
npm run build
# applies the schema and curated demo data to the local D1
npx wrangler d1 execute brightwheel-front-desk-db --local --file=./schema.sql
npx wrangler d1 execute brightwheel-front-desk-db --local --file=./seed-demo.sql
npx wrangler pages dev --port 8788
```

Workers AI runs against your Cloudflare account even in local dev, so `npx wrangler login` once if needed. No other keys are required.

## Deploy

```bash
npm run build
npx wrangler pages deploy ./dist --project-name brightwheel-front-desk --branch main
# one time, to seed production data:
npx wrangler d1 execute brightwheel-front-desk-db --remote --file=./schema.sql
npx wrangler d1 execute brightwheel-front-desk-db --remote --file=./seed-demo.sql
```

## Demo guardrails

- A daily question cap (`DAILY_QUESTION_CAP`, default 500) bounds model usage on a public endpoint.
- Input length is capped and operator writes can be gated with an optional `OPERATOR_PASSCODE`.
- No real personal data is used or requested. The request form is clearly labelled as a demo.

## Switching the LLM provider

Re-implement `runJson` in `functions/_shared/llm.ts`. For Groq (OpenAI-compatible), point a `fetch` at `https://api.groq.com/openai/v1/chat/completions` with `response_format: { type: "json_object" }` and a `GROQ_API_KEY` secret. Nothing else changes.
