# AI Front Desk: a front desk that teaches itself

**Live:** parent [brightwheel-front-desk.pages.dev](https://brightwheel-front-desk.pages.dev) · operator [/operator](https://brightwheel-front-desk.pages.dev/operator)

## The problem I focused on

Administrators lose hours every day answering the same questions: hours and closures, tuition, illness policy, lunch, tours. Parents on the other end are anxious and busy, and a handbook PDF is the opposite of helpful at 7am with a feverish toddler. The job is not just to answer fast. It is to answer in a way a worried parent can trust, and to do it without adding work for an already stretched operator.

I chose **breadth with a deliberate spine of trust, plus one novel workflow** that makes the system get better on its own.

## What I built

**Parent chat.** Mobile-first, text or voice. Every answer is grounded in the center handbook, shows its source ("Source: Tuition & Fees"), and carries a quiet confidence signal. When a question is sensitive or not covered, it does not bluff. It hands off to a person.

**Operator console.** The handbook is the single source of truth and is editable in place. The operator sees every question with answered, escalated, and gap counts, plus a tour and message inbox.

**Gap Radar (the novel part).** It collects the questions the assistant could not confidently answer, groups them into themes, and drafts a handbook entry for each. The operator edits if they like and approves in one tap. That entry instantly grounds the parent assistant. I asked "Do you have a swimming pool?", the bot said it did not have that on file, the operator approved the drafted section, and the same question then answered with high confidence and a citation. The product compounds: every gap becomes coverage.

## How it earns trust

This is where I spent the most care, because in childcare a confident wrong answer is worse than no answer.

- **Grounded and cited.** The model answers only from the handbook and cites the section. It is told to say plainly when something is not on file rather than guess. Tuition, dates, and policies are never invented.
- **A safety net that is code, not a prompt.** Anything that reads as a fever, medication, allergy, injury, emergency, or child-safety question is caught by deterministic rules before the model runs, and answered with a warm, fixed escalation that shares the policy and points to the director or 911. A model cannot be talked out of plain code.
- **Graceful uncertainty.** Low-confidence and sensitive replies show an escalation card and a one-tap path to a human, and are logged as gaps.

## Why these choices

I grounded on the whole handbook rather than building retrieval, because the handbook is small and brightwheel cares more about answer quality than document parsing. I used Cloudflare end to end (Pages, Functions, D1, Workers AI) so the demo is free, has no external keys, and persists across devices, which is what makes the self-teaching loop feel real rather than staged. The LLM provider is isolated behind one function, so moving to a stronger model later is a single-file change.

## What I would build next

Twilio so the same brain answers SMS and the after-hours phone line. Per-center theming and a shared policy library across a chain. A weekly digest that shows the operator what changed and what parents kept asking. Retrieval once a handbook grows past a single prompt. Human-in-the-loop review on taught entries before they go live.

Built with fictional data. The whole thing runs on free tiers with a daily question cap and no personal data.
