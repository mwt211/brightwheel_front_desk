-- Resets the demo to a clean, believable state for a reviewer.
-- Clears the KB (re-seeds from center.json on next read) and the logs, then
-- inserts a realistic spread of parent questions, two inbox items, and one
-- activity entry. Includes genuine gaps so "Scan for gaps" has something real.

DELETE FROM kb;
DELETE FROM questions;
DELETE FROM kb_history;

-- Recreate requests so the urgent column exists regardless of prior schema.
DROP TABLE IF EXISTS requests;
CREATE TABLE requests (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at          TEXT    NOT NULL,
  kind                TEXT    NOT NULL,
  name                TEXT    NOT NULL DEFAULT '',
  contact             TEXT    NOT NULL DEFAULT '',
  message             TEXT    NOT NULL DEFAULT '',
  related_question_id INTEGER,
  urgent              INTEGER NOT NULL DEFAULT 0
);

INSERT INTO questions (created_at, text, answer, confidence, category, status, needs_human, escalation_reason, citations) VALUES
(datetime('now','-3 hours'), 'What are your hours?', 'We are open Monday through Friday, 7:00 AM to 6:00 PM.', 'high', 'hours_calendar', 'answered', 0, NULL, '[]'),
(datetime('now','-160 minutes'), 'What is the tuition for infants?', 'Infant tuition is $1,485 per month and includes all meals and snacks.', 'high', 'tuition_fees', 'answered', 0, NULL, '[]'),
(datetime('now','-140 minutes'), 'Are you open on Veterans Day?', 'Yes, we are open on Veterans Day with normal hours.', 'high', 'hours_calendar', 'answered', 0, NULL, '[]'),
(datetime('now','-110 minutes'), 'I forgot to pack lunch. What is for lunch today?', 'No need to pack lunch; we provide it. Today is a hot lunch from our weekly menu.', 'high', 'food_menu', 'answered', 0, NULL, '[]'),
(datetime('now','-95 minutes'), 'How do I schedule a tour?', 'Tours are by appointment on Tuesdays and Thursdays at 9:30 AM or 4:00 PM. Request one on our website or by phone.', 'high', 'tours_enrollment', 'answered', 0, NULL, '[]'),
(datetime('now','-70 minutes'), 'What happens if I am late for pick-up?', 'Pick-up is by 6:00 PM. A late fee of $1 per minute applies after closing.', 'high', 'pickup_dropoff', 'answered', 0, NULL, '[]'),
(datetime('now','-58 minutes'), 'My child has a fever of 101, can they still come in?', 'Thank you for checking with us first. I can share our policy, but our teachers cannot decide or diagnose. Please call us and ask for Maria Delgado, or check with your pediatrician.', 'high', 'illness_health', 'escalated', 1, 'Health / illness question; policy shared, decision left to staff and pediatrician.', '[{"section":"Illness & Exclusion Policy","quote":"A fever of 100.4 F or higher. Children may return once they are fever-free for 24 hours."}]'),
(datetime('now','-31 minutes'), 'How much Tylenol should I give my toddler before drop-off?', 'I am not able to give medical advice or guidance on medicine or doses. Your pediatrician is the best person for that. Please call us and ask for Maria Delgado.', 'high', 'illness_health', 'escalated', 1, 'Question asks for medication or dosing guidance.', '[]'),
(datetime('now','-47 minutes'), 'Do you have a swimming pool?', 'I do not have that on file. Let me pass this to our team so a person can help you.', 'low', 'other', 'unanswered', 1, NULL, '[]'),
(datetime('now','-26 minutes'), 'Do you offer Spanish immersion or bilingual classes?', 'I do not have that on file. Let me pass this to our team.', 'low', 'other', 'unanswered', 1, NULL, '[]'),
(datetime('now','-14 minutes'), 'Is there a summer camp program for older kids?', 'I do not have details about a summer camp on file. Let me pass this along.', 'low', 'tours_enrollment', 'unanswered', 1, NULL, '[]'),
(datetime('now','-6 minutes'), 'Can I watch my child on a live webcam during the day?', 'I do not have that on file and will pass it to the team.', 'low', 'other', 'unanswered', 1, NULL, '[]');

INSERT INTO requests (created_at, kind, name, contact, message, related_question_id, urgent) VALUES
(datetime('now','-80 minutes'), 'tour', 'Jordan Rivera', 'jordan.r@example.com', 'Interested in a tour for our 2 year old. Thursday afternoon if possible.', NULL, 0),
(datetime('now','-33 minutes'), 'message', 'Sam Lee', '(505) 555-0190', 'Could someone call me about the infant waitlist? Thank you.', NULL, 0),
(datetime('now','-12 minutes'), 'message', 'Priya Nadkarni', '(505) 555-0177', 'My daughter spiked a fever this morning and I need to pick her up as soon as possible.', NULL, 1);

INSERT INTO kb_history (created_at, summary) VALUES
(datetime('now','-1 day'), 'Operator reviewed and published the parent handbook.');
