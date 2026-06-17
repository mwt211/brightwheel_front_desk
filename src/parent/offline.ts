// On-device answering for when there is no network. The model is remote, so
// this is honest, graceful degradation: it answers common questions from the
// cached handbook by keyword match, computes today's lunch from the saved menu,
// and crucially still runs the safety net (a fever or emergency question
// escalates locally, never an offline medical guess). Answers are clearly
// marked offline in the UI. This mirrors the server's safety screen; the two
// are kept deliberately close (see docs/PROVENANCE and DECISIONS).
import type { AnswerPayload, CenterKB, SuggestedAction } from "../lib/types";
import type { Lang } from "./i18n";
import { leaveRequest } from "../lib/api";

const KB_CACHE_KEY = "cws_kb_cache";
const QUEUE_KEY = "cws_request_queue";
type QueuedRequest = Parameters<typeof leaveRequest>[0];

export function cacheKb(kb: CenterKB): void {
  try {
    localStorage.setItem(KB_CACHE_KEY, JSON.stringify(kb));
  } catch {
    /* storage full or unavailable; offline answers degrade to the fallback */
  }
}

export function loadCachedKb(): CenterKB | null {
  try {
    const raw = localStorage.getItem(KB_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CenterKB) : null;
  } catch {
    return null;
  }
}

// --- Safety net (bilingual subset of the server's deterministic screen) ---
const EMERGENCY =
  /\b(not breathing|can'?t breathe|choking|unconscious|passed out|fainted|unresponsive|seizure|anaphyla|allergic reaction|epipen|severe bleeding|head injury|swallowed|overdose|911|no respira|inconsciente|convulsi|reacci[oó]n al[eé]rgica|emergencia|se desmay)\b/i;
const MEDICATION =
  /\b(dose|dosage|how much (medicine|tylenol|advil|ibuprofen|benadryl|motrin)|\d+\s?(mg|ml)\b|medicina|medicamento|dosis|jarabe)\b/i;
const ILLNESS =
  /\b(fever|temperature|vomit|throw(ing)? up|diarrh|rash|pink ?eye|conjunctivit|strep|covid|flu\b|contagious|sick|fiebre|v[oó]mit|diarrea|sarpullido|gripe|resfriado|enferm|contagios)\b/i;
const SPANISH = /[ñáéíóú¿¡]|\b(mi hijo|mi hija|tiene|cu[aá]nto|est[aá]|enfermo|enferma|fiebre|hola|gracias|abierto|cuesta)\b/i;

function screen(text: string, phone: string, director: string, lang: Lang): AnswerPayload | null {
  const es = lang === "es" || SPANISH.test(text);
  const call: SuggestedAction = {
    label: es ? "Llamar al centro" : "Call the center",
    action: "call",
    value: phone,
  };
  const mk = (answer: string, reason: string): AnswerPayload => ({
    answer,
    confidence: "high",
    citations: [],
    category: "illness_health",
    needs_human: true,
    escalation_reason: reason,
    suggested_actions: [call],
    safety_intercept: true,
    offline: true,
  });
  if (EMERGENCY.test(text)) {
    return mk(
      es
        ? `Si es una emergencia médica, llame al 911 ahora mismo. Está sin conexión, así que no puedo ayudar con esto; por favor llame al 911 o al centro al ${phone}.`
        : `If this is a medical emergency, call 911 right now. You're offline, so I can't help with this; please call 911 or the center at ${phone}.`,
      "Offline: possible emergency.",
    );
  }
  if (MEDICATION.test(text) || ILLNESS.test(text)) {
    return mk(
      es
        ? `No puedo dar consejos médicos, y ahora está sin conexión. Cuando tenga dudas sobre enfermedad o medicinas, llame al centro al ${phone} y pregunte por ${director}, o consulte a su pediatra.`
        : `I can't give medical advice, and you're currently offline. For illness or medication questions, please call the center at ${phone} and ask for ${director}, or check with your pediatrician.`,
      "Offline: health question routed to a human.",
    );
  }
  return null;
}

// --- Keyword matching over the handbook ---
const STOP = new Set([
  "the","a","an","is","are","do","does","you","your","what","whats","when","where","how","for","my","can","i","on","of","to","and","at","with","we","our",
  "el","la","los","las","de","que","es","son","mi","para","con","un","una","y","en","se","su","hay","me",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Answer a question on-device from the cached handbook. Always marked offline. */
export function answerOffline(kb: CenterKB, text: string, lang: Lang): AnswerPayload {
  const es = lang === "es";
  const phone = kb.center?.phone ?? "the front desk";
  const director = kb.center?.director ?? (es ? "la directora" : "the director");

  const safety = screen(text, phone, director, lang);
  if (safety) return safety;

  const msg: SuggestedAction = {
    label: es ? "Dejar un mensaje" : "Message the front desk",
    action: "message_front_desk",
  };
  const call: SuggestedAction = {
    label: es ? "Llamar al centro" : "Call the center",
    action: "call",
    value: phone,
  };
  const tokens = tokenize(text);

  // Lunch-today intent: compute from the saved weekly menu.
  if (/\b(lunch|almuerzo|comida|menu|eat|comer)\b/i.test(text)) {
    const day = DOW[new Date().getDay()];
    const meal = kb.lunchMenu?.[day];
    if (meal) {
      return offlineAnswer(
        es
          ? `El almuerzo de hoy (${day}) es: ${meal} El almuerzo está incluido y no necesita empacarlo.`
          : `Today's lunch (${day}) is: ${meal} Lunch is included, so you don't need to pack one.`,
        "Meals & Snacks",
        meal,
        "food_menu",
        "high",
        [msg],
      );
    }
  }

  // Best-matching handbook section.
  let best: { section: { title: string; body: string }; score: number } | null = null;
  for (const section of kb.sections ?? []) {
    const hay = tokenize(section.title + " " + section.title + " " + section.body);
    const set = new Set(hay);
    const score = tokens.reduce((n, t) => n + (set.has(t) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { section, score };
  }
  if (best && best.score >= 2) {
    return offlineAnswer(
      best.section.body,
      best.section.title,
      best.section.body,
      categorize(best.section.title),
      "medium",
      [msg, call],
    );
  }

  // FAQ match.
  for (const faq of kb.faqs ?? []) {
    const set = new Set(tokenize(faq.question + " " + faq.answer));
    const score = tokens.reduce((n, t) => n + (set.has(t) ? 1 : 0), 0);
    if (score >= 2) {
      return offlineAnswer(faq.answer, "FAQ", faq.answer, "other", "medium", [msg, call]);
    }
  }

  // Nothing matched offline.
  return {
    answer: es
      ? "Está sin conexión y no encontré esto en el manual guardado. Le responderé cuando se reconecte, o puede llamar al centro."
      : "You're offline and I couldn't find this in the saved handbook. I'll answer once you reconnect, or you can call the center.",
    confidence: "low",
    citations: [],
    category: "other",
    needs_human: true,
    escalation_reason: "Offline: not covered by the cached handbook.",
    suggested_actions: [call, msg],
    offline: true,
  };
}

function offlineAnswer(
  answer: string,
  section: string,
  quote: string,
  category: string,
  confidence: "high" | "medium" | "low",
  actions: SuggestedAction[],
): AnswerPayload {
  return {
    answer,
    confidence,
    citations: section === "FAQ" ? [] : [{ section, quote: quote.slice(0, 200) }],
    category: category as AnswerPayload["category"],
    needs_human: false,
    escalation_reason: "",
    suggested_actions: actions,
    offline: true,
  };
}

function categorize(title: string): string {
  const t = title.toLowerCase();
  if (/hour|closure|calendar/.test(t)) return "hours_calendar";
  if (/tuition|fee/.test(t)) return "tuition_fees";
  if (/illness|health|medication/.test(t)) return "illness_health";
  if (/meal|lunch|snack|food/.test(t)) return "food_menu";
  if (/tour|enroll/.test(t)) return "tours_enrollment";
  if (/pick|drop/.test(t)) return "pickup_dropoff";
  return "other";
}

// --- Offline request queue (tour/message left without a connection) ---

export function queueRequest(input: QueuedRequest): void {
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]") as QueuedRequest[];
    q.push(input);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {
    /* storage unavailable */
  }
}

/** Send any queued requests; keeps the ones that fail. Returns how many sent. */
export async function flushQueue(): Promise<number> {
  let q: QueuedRequest[];
  try {
    q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]") as QueuedRequest[];
  } catch {
    return 0;
  }
  if (!q.length) return 0;
  const remaining: QueuedRequest[] = [];
  let sent = 0;
  for (const item of q) {
    try {
      const res = await leaveRequest(item);
      if (res && res.ok) sent += 1;
      else remaining.push(item);
    } catch {
      remaining.push(item);
    }
  }
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  } catch {
    /* ignore */
  }
  return sent;
}
