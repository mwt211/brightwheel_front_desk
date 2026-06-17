// Deterministic safety net. Runs BEFORE the model. If a question trips a
// medical / emergency / child-safety trigger, we return a hard-coded, warm
// escalation instead of letting the LLM free-form anything that could read as
// medical advice. This is the load-bearing trust feature, so it is plain code,
// not a prompt the model could be talked out of.
//
// The triggers are bilingual (English + Spanish) because the assistant answers
// families in their own language; an English-only net would let a Spanish
// health question reach the model. Patterns use a leading word boundary only
// (no trailing one), so stems like "anaphyla" or "fiebre" still match inside a
// longer word, and over-triggering errs on the safe side.

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
  /\b(not breathing|can'?t breathe|trouble breathing|difficulty breathing|struggling to breathe|choking|unconscious|passed out|fainted|won'?t wake|unresponsive|not moving|lethargic|seizure|seizing|anaphyla|allergic reaction|epipen|turning blue|blue lips|lips are blue|bleed|severe bleeding|bleeding badly|won'?t stop bleeding|head injury|hit (his|her|their) head|broke (his|her|their)|broken bone|swallowed|ingested|poison|drowning|ambulance|call 911|911|overdose|no respira|no puede respirar|inconsciente|se desmay|desmay|atragant|convulsi|reacci[oó]n al[eé]rgica|sangr|envenen|emergencia|ambulancia|se trag[oó])/i;

const MEDICATION =
  /\b(dose|dosage|\d+\s?(mg|ml)\b|prescri|(how much|give|take|can i give|should i give|is it (ok|safe)|can (he|she|they) (take|have)|should (he|she|they) (take|have))[^.?!]{0,25}(medicine|medication|tylenol|advil|ibuprofen|acetaminophen|benadryl|motrin)|medicina|medicamento|dosis|jarabe|puedo darle|deberia darle|cu[aá]nto.{0,15}(medic|le doy))/i;

const ILLNESS =
  /\b(fever|temperature|10[0-9](\.\d)?\s?(°|deg|f\b)|vomit|v[oó]mit|throw(ing)? up|threw up|diarrh|rash|pink ?eye|conjunctivit|strep|covid|flu\b|rsv|hand[- ]?foot[- ]?mouth|lice|contagious|infection|ear ?infection|cough(ing)?|sore throat|runny nose|congest|sick|unwell|under the weather|fiebre|temperatura|diarrea|sarpullido|erupci|conjuntivitis|ojo rojo|gripe|resfriado|catarro|tos\b|enferm|malestar|contagios|infecci|garganta|mocos|piojos)/i;

const SAFETY =
  /\b(abuse|abused|neglect|molest|inappropriate touch|touched inappropriately|someone hit my|hit my child|bruise|bruising|hurt my child|hurting children|left alone|cps|mandated report|abuso|abus[oó]|negligencia|maltrato|lastim|golpe[oó] a mi|moret[oó]n|toc[oó] inapropiad)/i;

// Lightweight language hint: accented characters or common Spanish question
// words mean we should answer the safety message in Spanish.
const SPANISH =
  /[ñáéíóú¿¡]|\b(mi hijo|mi hija|tiene|puede|cu[aá]nto|debo|deber[ií]a|est[aá]|enfermo|enferma|fiebre|hola|gracias|por favor|necesito|ayuda)\b/i;

// Trim to a sentence (or word) boundary so the quote we SHOW a parent never
// cuts off mid-word.
function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  if (stop > max * 0.5) return cut.slice(0, stop + 1).trim();
  const space = cut.lastIndexOf(" ");
  return (space > 0 ? cut.slice(0, space) : cut).trim() + "…";
}

// Pulls a short, on-point quote from the illness policy so the parent actually
// SEES what the handbook says, not just a section name. `prefer` lets the
// medication branch surface the medication line instead of the fever criteria.
function illnessCitation(kb: Kb, prefer?: RegExp): Citation[] {
  const section = kb.sections?.find((s) => /illness/i.test(s.title));
  if (!section) return [];
  let quote = clip(section.body, 320);
  if (prefer) {
    const sentence = section.body
      .replace(/\s+/g, " ")
      .split(/(?<=[.?!])\s+/)
      .find((s) => prefer.test(s));
    if (sentence) quote = clip(sentence, 320);
  }
  return [{ section: section.title, quote }];
}

const L = (es: boolean, en: string, esText: string) => (es ? esText : en);

/** Returns a hard-coded escalation if the text trips a trigger, else null. */
export function screen(text: string, kb: Kb): SafetyResult | null {
  const phone = kb.center?.phone ?? "the front desk";
  const director = kb.center?.director ?? "our director";
  const es = SPANISH.test(text);
  const callLabel = L(es, "Call the center", "Llamar al centro");
  const msgLabel = L(es, "Message the front desk", "Dejar un mensaje");
  const callAction: Action = { label: callLabel, action: "call", value: phone };
  const msgAction: Action = { label: msgLabel, action: "message_front_desk" };

  if (EMERGENCY.test(text)) {
    return {
      answer: L(
        es,
        `If this is a medical emergency, please call 911 right now, before anything else. Once your child is safe, call us at ${phone} and our staff will help immediately. I'm a front desk assistant and can't help with an emergency directly, but a real person is here for you.`,
        `Si es una emergencia médica, llame al 911 ahora mismo, antes que nada. Cuando su hijo esté a salvo, llámenos al ${phone} y nuestro personal le ayudará de inmediato. Soy un asistente de recepción y no puedo atender una emergencia, pero hay una persona real aquí para ayudarle.`,
      ),
      confidence: "high",
      citations: [],
      category: "illness_health",
      needs_human: true,
      escalation_reason: "Possible medical emergency detected by safety screen.",
      suggested_actions: [
        { label: L(es, "Call 911", "Llamar al 911"), action: "call", value: "911" },
        callAction,
      ],
      safety_intercept: true,
      status: "escalated",
    };
  }

  if (MEDICATION.test(text)) {
    return {
      answer: L(
        es,
        `I hear you, and I want to get this right. I'm not able to give medical advice or guidance on medicine or doses. Your pediatrician is the best person for that. For anything we give at the center, we follow a signed medication form and the label instructions. Please call us at ${phone} and ask for ${director}, and we'll walk through it with you.`,
        `Le entiendo y quiero ayudarle bien. No puedo dar consejos médicos ni indicaciones sobre medicinas o dosis. Su pediatra es la mejor persona para eso. Para lo que administramos en el centro seguimos una autorización firmada y las instrucciones de la etiqueta. Llámenos al ${phone} y pregunte por ${director}, y lo revisamos con usted.`,
      ),
      confidence: "high",
      citations: illnessCitation(kb, /medicat|dose|advise/i),
      category: "illness_health",
      needs_human: true,
      escalation_reason: "Question asks for medication or dosing guidance.",
      suggested_actions: [msgAction, callAction],
      safety_intercept: true,
      status: "escalated",
    };
  }

  if (ILLNESS.test(text)) {
    return {
      answer: L(
        es,
        `Thank you for checking with us first; that really helps keep everyone healthy. I can share our policy, but I'm not able to decide whether your child should come in, and our teachers can't diagnose illness. Here is what our handbook says, and when you're unsure, please call us at ${phone} and ask for ${director}, or check with your pediatrician.`,
        `Gracias por consultarnos primero; eso ayuda a mantener a todos sanos. Puedo compartir nuestra política, pero no puedo decidir si su hijo debe venir, y nuestras maestras no pueden diagnosticar. Esto es lo que dice nuestro manual, y cuando tenga dudas, llámenos al ${phone} y pregunte por ${director}, o consulte a su pediatra.`,
      ),
      confidence: "high",
      citations: illnessCitation(kb),
      category: "illness_health",
      needs_human: true,
      escalation_reason:
        "Health / illness question; policy shared, decision left to staff and pediatrician.",
      suggested_actions: [callAction, msgAction],
      safety_intercept: true,
      status: "escalated",
    };
  }

  if (SAFETY.test(text)) {
    return {
      answer: L(
        es,
        `Thank you for telling us. This is important and we take it seriously. Please contact ${director} directly at ${phone} so a person can help you right away. If a child is in immediate danger, call 911. I'm only a front desk assistant, so I'm connecting you with someone who can act on this.`,
        `Gracias por avisarnos. Esto es importante y lo tomamos en serio. Comuníquese directamente con ${director} al ${phone} para que una persona le ayude de inmediato. Si un niño está en peligro inmediato, llame al 911. Soy solo un asistente de recepción, así que le estoy conectando con alguien que puede actuar.`,
      ),
      confidence: "high",
      citations: [],
      category: "illness_health",
      needs_human: true,
      escalation_reason: "Child-safety / welfare concern; route to director immediately.",
      suggested_actions: [callAction, msgAction],
      safety_intercept: true,
      status: "escalated",
    };
  }

  return null;
}
