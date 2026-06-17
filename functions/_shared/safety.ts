// Deterministic safety net. Runs BEFORE the model. If a question trips a
// medical / emergency / child-safety trigger, we return a hard-coded, warm
// escalation instead of letting the LLM free-form anything that could read as
// medical advice. This is the load-bearing trust feature, so it is plain code,
// not a prompt the model could be talked out of.

type Citation = { section: string; quote: string };
type Action = { label: string; action: string; value?: string };

export type SafetyResult = {
  answer: string;
  confidence: "high";
  citations: Citation[];
  category: "illness_health";
  needs_human: boolean;
  escalation_reason: string;
  suggested_actions: Action[];
  safety_intercept: true;
  status: "escalated";
};

type Kb = {
  center?: { phone?: string; director?: string };
  sections?: { title: string; body: string }[];
};

const EMERGENCY =
  /\b(not breathing|can'?t breathe|choking|unconscious|won'?t wake|unresponsive|seizure|seizing|anaphyla|epipen|turning blue|blue lips|severe bleeding|bleeding badly|head injury|hit (his|her|their) head|broke (his|her|their)|broken bone|ambulance|call 911|911|overdose)\b/i;

const MEDICATION =
  /\b(dose|dosage|how much (medicine|tylenol|advil|ibuprofen|acetaminophen|benadryl|motrin)|give (him|her|them|my child).{0,15}(medicine|tylenol|advil|ibuprofen|acetaminophen|benadryl|motrin)|\d+\s?mg\b|should i give .* (medicine|medication)|prescri)/i;

const ILLNESS =
  /\b(fever|temperature|10[0-9](\.\d)?\s?(°|deg|f\b)|vomit|throw(ing)? up|threw up|diarrh|rash|pink ?eye|conjunctivit|strep|covid|flu\b|rsv|hand[- ]?foot[- ]?mouth|lice|contagious|infection|ear ?infection|cough(ing)?|sore throat|runny nose|congest|sick|unwell|under the weather)\b/i;

const SAFETY =
  /\b(abuse|abused|neglect|molest|inappropriate touch|someone hit my|bruise|bruising|hurt my child|hurting children|cps|mandated report)\b/i;

function illnessCitation(kb: Kb): Citation[] {
  const section = kb.sections?.find((s) => /illness/i.test(s.title));
  if (!section) return [];
  const firstLines = section.body.split("\n").slice(0, 4).join(" ").trim();
  return [{ section: section.title, quote: firstLines.slice(0, 220) }];
}

/** Returns a hard-coded escalation if the text trips a trigger, else null. */
export function screen(text: string, kb: Kb): SafetyResult | null {
  const phone = kb.center?.phone ?? "the front desk";
  const director = kb.center?.director ?? "our director";

  if (EMERGENCY.test(text)) {
    return {
      answer:
        `If this is a medical emergency, please call 911 right now, before anything else. ` +
        `Once your child is safe, call us at ${phone} and our staff will help immediately. ` +
        `I'm a front desk assistant and can't help with an emergency directly, but a real person is here for you.`,
      confidence: "high",
      citations: [],
      category: "illness_health",
      needs_human: true,
      escalation_reason: "Possible medical emergency detected by safety screen.",
      suggested_actions: [
        { label: "Call 911", action: "call", value: "911" },
        { label: `Call the center`, action: "call", value: phone },
      ],
      safety_intercept: true,
      status: "escalated",
    };
  }

  if (MEDICATION.test(text)) {
    return {
      answer:
        `I hear you, and I want to get this right. I'm not able to give medical advice or guidance on medicine or doses. ` +
        `Your pediatrician is the best person for that. For anything we give at the center, we follow a signed medication form and the label instructions. ` +
        `Please call us at ${phone} and ask for ${director}, and we'll walk through it with you.`,
      confidence: "high",
      citations: illnessCitation(kb),
      category: "illness_health",
      needs_human: true,
      escalation_reason: "Question asks for medication or dosing guidance.",
      suggested_actions: [
        { label: "Message the front desk", action: "message_front_desk" },
        { label: "Call the center", action: "call", value: phone },
      ],
      safety_intercept: true,
      status: "escalated",
    };
  }

  if (ILLNESS.test(text)) {
    return {
      answer:
        `Thank you for checking with us first; that really helps keep everyone healthy. I can share our policy, but I'm not able to decide whether your child should come in, and our teachers can't diagnose illness. ` +
        `Here is what our handbook says, and when you're unsure, please call us at ${phone} and ask for ${director}, or check with your pediatrician.`,
      confidence: "high",
      citations: illnessCitation(kb),
      category: "illness_health",
      needs_human: true,
      escalation_reason: "Health / illness question; policy shared, decision left to staff and pediatrician.",
      suggested_actions: [
        { label: "Call the center", action: "call", value: phone },
        { label: "Message the front desk", action: "message_front_desk" },
      ],
      safety_intercept: true,
      status: "escalated",
    };
  }

  if (SAFETY.test(text)) {
    return {
      answer:
        `Thank you for telling us. This is important and we take it seriously. Please contact ${director} directly at ${phone} so a person can help you right away. ` +
        `If a child is in immediate danger, call 911. I'm only a front desk assistant, so I'm connecting you with someone who can act on this.`,
      confidence: "high",
      citations: [],
      category: "illness_health",
      needs_human: true,
      escalation_reason: "Child-safety / welfare concern; route to director immediately.",
      suggested_actions: [
        { label: "Call the center", action: "call", value: phone },
        { label: "Message the front desk", action: "message_front_desk" },
      ],
      safety_intercept: true,
      status: "escalated",
    };
  }

  return null;
}
