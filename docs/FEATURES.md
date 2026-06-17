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
