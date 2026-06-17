# Code provenance: what we reused and what we built

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

- **`src/parent/voice.ts`** — adapted from the "Sally" personal-assistant app. It
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
| `seed/center.json` | The fictional Cottonwood Sprouts handbook content. Original. |
| Product concepts | Gap Radar, the impact dashboard, photo onboarding, and urgent triage are original to this build. |

## In one sentence

We stood on React and the Cloudflare/Groq platforms, reused one small proven
voice helper from a prior personal project, learned the grounded-answer patterns
from open-source work without taking their code, and wrote the safety net, the
grounding, the self-teaching loop, the photo onboarding, and both UIs ourselves.
