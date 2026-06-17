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
  "history": [{ "role": "user", "content": "..." }],
  "childId": "mateo" }
```
`history` is optional (last 6 turns used; roles other than user/assistant are dropped).
`childId` is optional; when set to a known child it injects that family's private
daily record into the grounding, so personal questions ("did Mateo nap today?")
are answered from it and cited as `"<firstName>'s day"`. The safety net still runs
first regardless, so a medical question escalates and never reads the record.

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

## GET /api/children  (public)

The identities a parent can view as in the demo, for the "Viewing as" selector.
```json
{ "children": [ { "id": "mateo", "name": "Mateo Reyes", "firstName": "Mateo", "room": "Toddler Room (Sunflowers)" } ] }
```
Identity only. The private daily record and account are never listed here; they
are injected server-side into the answer for the selected `childId` (see
`/api/ask`). Fictional demo data; production access would be per-parent and
authenticated.

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
