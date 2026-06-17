# 90-second demo script

A tight walkthrough for a screen recording or a live demo. Two tabs open: parent at `/`, operator at `/operator`.

## 0:00 to 0:15 — The hook
"Admins lose hours a day answering the same questions, and parents just want a fast answer they can trust. This is an out-of-the-box AI Front Desk. Here is the parent side."

## 0:15 to 0:45 — Trustworthy answers
On the parent tab, tap the starters in order:
- "Are you open on Veterans Day?" Point out the answer plus the "Source: Hours & Closures" chip and the confidence dot.
- "What's the tuition for infants?" Note the exact figure with its citation. "It is grounded in the handbook, not guessed."
- "I forgot to pack lunch. What's for lunch today?" Note it knows today's menu.

## 0:45 to 1:05 — Safety and graceful handoff
- Ask "My child has a fever, can they come in?" Say: "This never gives medical advice. A deterministic safety net catches it before the model, shares the policy, and routes to a person."
- Ask "Do you have a swimming pool?" Say: "Not in the handbook, so it does not bluff. It says so and offers a human, and it logs this as a gap."

## 1:05 to 1:30 — The operator side and the loop
Switch to the operator tab:
- Questions tab: "Here is every question, with answered, escalated, and gap counts, and an inbox of tour and message requests."
- Gap Radar: click "Scan for gaps." "It groups the questions the bot could not answer and drafts a handbook entry for each. Health topics are flagged review-only and never auto-taught." Approve the swimming-pool draft.
- Back to the parent tab, ask "Do you have a swimming pool?" again. It now answers with a citation. "One tap, and the front desk taught itself."

## Close
"Grounded, honest, and self-improving. Cloudflare end to end, free to run, and the LLM is one swappable function away from any model you want."
