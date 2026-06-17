# Demo Script

A tight walkthrough (about two minutes) for a screen recording or live demo. Two tabs open: parent at `/`, operator at `/operator`.

## The Hook (0:00 to 0:15)
"Admins lose hours a day answering the same questions, and parents just want a fast answer they can trust. This is an out-of-the-box AI Front Desk. Here is the parent side."

## Trustworthy, Grounded Answers (0:15 to 0:45)
On the parent tab, tap the starters in order:
- "Are you open on Veterans Day?" Point out the answer plus the "Source: Hours & Closures" chip and the confidence dot.
- "What's the tuition for infants?" Note the exact figure with its citation. "Grounded in the handbook, not guessed."
- "I forgot to pack lunch. What's for lunch today?" Note it knows today's menu.

## Multilingual and Safety (0:45 to 1:05)
- Type a question in Spanish, for example "cuanto cuesta para bebes?" The whole page switches to Spanish and the answer is cited. "It meets families in their language."
- Ask "My child has a fever, can they come in?" (or the Spanish equivalent). "This never gives medical advice. A deterministic safety net, in both languages, catches it before the model, shares the policy, and routes to a person."
- Ask "Do you have a swimming pool?" "Not in the handbook, so it does not bluff. It says so, offers a human, and logs this as a gap."
- (Optional, on the go) Switch on airplane mode or DevTools "Offline," then ask "what are your hours?" It answers from the saved handbook, marked Offline, and a fever question still escalates locally. Leave a message and it queues until reconnect.

## The Operator Side and the Loop (1:05 to 1:45)
Switch to the operator tab:
- Impact view: "Staff time saved, answer rate, top topics. Less admin, more impact."
- Inbox: "Urgent messages are triaged to the top." Point at the flagged fever pickup.
- Handbook tab, "Import from a photo": "A brand-new center can onboard in minutes. Snap the paper handbook and we draft the sections." Upload `docs/sample-handbook.png` and watch the new sections appear for review.
- Gap Radar: click "Scan for gaps." "It groups the questions the bot could not answer and drafts a handbook entry for each. Health topics are flagged review-only." Approve the swimming-pool draft.
- Back to the parent tab, ask "Do you have a swimming pool?" again. It now answers with a citation. "One tap, and the front desk taught itself."

## Close
"Grounded, honest, multilingual, and self-improving. Cloudflare end to end, free to run, and the model is one swappable function away from any provider you want."
