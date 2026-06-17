# Decisions and rationale

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

**Cloudflare end to end.** Pages, Functions, D1, and Workers AI on one platform means the demo is free, needs no external API keys, and persists across devices, which is what makes the operator-edits-then-parent-sees-it loop feel real rather than staged. The LLM provider is isolated behind one function for easy swapping.

**Open operator console for the demo.** Operator routes are open by default so a reviewer can explore both sides immediately. `OPERATOR_PASSCODE` gates them when set; a real deployment would fail closed. This is a deliberate demo tradeoff, not an oversight.

## How it maps to brightwheel

- **Deliver Value for Customers:** the impact dashboard quantifies hours saved; answers are specific and grounded.
- **Get Better Every Day:** Gap Radar is this principle as a product feature.
- **Take Ownership:** the front desk handles the question end to end, or hands it to a person, rather than dropping it.
- **Dive Deep / Think Critically:** the operator sees exactly where the bot struggled, with confidence and category, not just a transcript.
- **The mission ("more time teaching"):** every question answered without staff is time returned to the classroom.

## What I would build next

- Twilio so the same brain answers SMS and the after-hours phone line.
- Per-center theming and a shared policy library across a chain of centers.
- A weekly digest of what changed and what parents kept asking.
- Retrieval once a handbook outgrows a single prompt.
- Human-in-the-loop review on taught entries before they go live, and a fail-closed operator login.
