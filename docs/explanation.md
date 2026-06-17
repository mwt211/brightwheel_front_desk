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
