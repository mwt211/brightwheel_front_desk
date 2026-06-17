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
