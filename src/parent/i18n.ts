// Parent-UI localization. The whole parent surface follows one `Lang`, which is
// auto-detected from each sent message (typed or dictated) and can be toggled
// manually. The assistant's answers are already returned in the parent's
// language by the model; this covers the static chrome around them.

export type Lang = "en" | "es";

const ES_PUNCT = /[ñáéíóú¿¡]/;
const ES_WORDS =
  /\b(hola|gracias|por favor|cuanto|cuesta|esta|estan|abierto|abierta|tiene|tienen|puede|pueden|mi hijo|mi hija|nino|nina|enfermo|enferma|fiebre|matricula|almuerzo|comida|cuando|donde|que hora|horario|necesito|quiero|como|inscribir|visita|dia|veteranos)\b/;

/** Best-effort language detection for a short message (typed or dictated). */
export function detectLang(text: string): Lang {
  const t = text.toLowerCase();
  return ES_PUNCT.test(t) || ES_WORDS.test(t) ? "es" : "en";
}

/** Initial UI language from the browser. */
export function initialLang(): Lang {
  const l =
    typeof navigator !== "undefined" ? navigator.language?.toLowerCase() : "";
  return l && l.startsWith("es") ? "es" : "en";
}

/** BCP-47 code for the Web Speech API. */
export function speechLang(lang: Lang): string {
  return lang === "es" ? "es-US" : "en-US";
}

export const STARTERS: Record<Lang, string[]> = {
  en: [
    "Are you open on Veterans Day?",
    "What's the tuition for infants?",
    "My child has a fever, can they come in?",
    "I forgot to pack lunch. What's for lunch today?",
    "How do I schedule a tour?",
  ],
  es: [
    "¿Están abiertos el Día de los Veteranos?",
    "¿Cuánto cuesta la matrícula para bebés?",
    "Mi hijo tiene fiebre, ¿puede asistir hoy?",
    "Olvidé el almuerzo. ¿Qué hay de almuerzo hoy?",
    "¿Cómo programo una visita?",
  ],
};

export type Strings = {
  subtitle: string;
  operatorView: string;
  callUs: string;
  startOver: string;
  taglineFallback: string;
  welcomeHint: string;
  source: string;
  trust: { high: string; medium: string; low: string };
  escalateTitle: string;
  placeholder: string;
  listening: string;
  langTitle: string;
  demoNote: string;
  sendError: string;
  tourTitle: string;
  msgTitle: string;
  sheetIntro: string;
  namePh: string;
  contactPh: string;
  tourMsgPh: string;
  msgMsgPh: string;
  cancel: string;
  send: string;
  sending: string;
  done: string;
  thankYou: string;
  reqDefaultTour: string;
  reqDefaultMsg: string;
  thankBody: (kind: "tour" | "message", phone?: string) => string;
  failed: (phone?: string) => string;
  offlineBanner: string;
  offlineTag: string;
  offlineNoData: string;
  queuedBody: (kind: "tour" | "message") => string;
};

export const STRINGS: Record<Lang, Strings> = {
  en: {
    subtitle: "Front Desk Assistant",
    operatorView: "Operator view",
    callUs: "Call us",
    startOver: "Start over",
    taglineFallback: "Ask us anything about the center.",
    welcomeHint: "Hours, tuition, illness policy, lunch, tours, and more.",
    source: "Source",
    trust: {
      high: "From our handbook",
      medium: "Partly covered; please confirm",
      low: "Not in our handbook",
    },
    escalateTitle: "A team member should help with this.",
    placeholder: "Ask the front desk...",
    listening: "Listening...",
    langTitle: "Language: English (tap for Spanish)",
    demoNote:
      "Demo assistant for a fictional center. Not real medical or personal advice.",
    sendError:
      "Sorry, something went wrong reaching the front desk. Please try again, or call us.",
    tourTitle: "Request a tour",
    msgTitle: "Message the front desk",
    sheetIntro: "Leave your details and the team will get back to you. (Demo, no real data.)",
    namePh: "Your name",
    contactPh: "Phone or email",
    tourMsgPh: "Anything we should know? (optional)",
    msgMsgPh: "Your message",
    cancel: "Cancel",
    send: "Send",
    sending: "Sending...",
    done: "Done",
    thankYou: "Thank you.",
    reqDefaultTour: "Requested a tour.",
    reqDefaultMsg: "Asked for a callback.",
    thankBody: (kind, phone) =>
      `The front desk has your ${kind === "tour" ? "tour request" : "message"} and will follow up.${
        phone ? ` For anything urgent, call ${phone}.` : ""
      }`,
    failed: (phone) =>
      `That didn't go through. Please try again${phone ? `, or call ${phone}` : ""}.`,
    offlineBanner: "Offline. Answering from the saved handbook.",
    offlineTag: "Offline",
    offlineNoData:
      "You're offline and this device hasn't saved the center's info yet. Open this page once with a connection and it will work offline after that.",
    queuedBody: (kind) =>
      `You're offline, so your ${kind === "tour" ? "tour request" : "message"} is saved and will send automatically when you're back online.`,
  },
  es: {
    subtitle: "Asistente de Recepción",
    operatorView: "Vista de operador",
    callUs: "Llámanos",
    startOver: "Empezar de nuevo",
    taglineFallback: "Pregúntenos lo que quiera sobre el centro.",
    welcomeHint: "Horarios, matrícula, política de enfermedad, almuerzo, visitas y más.",
    source: "Fuente",
    trust: {
      high: "De nuestro manual",
      medium: "Parcialmente cubierto; por favor confirme",
      low: "No está en nuestro manual",
    },
    escalateTitle: "Un miembro del equipo debería ayudar con esto.",
    placeholder: "Pregúntale a la recepción...",
    listening: "Escuchando...",
    langTitle: "Idioma: Español (toca para inglés)",
    demoNote:
      "Asistente de demostración para un centro ficticio. No es consejo médico ni personal real.",
    sendError:
      "Lo sentimos, hubo un problema al contactar la recepción. Inténtelo de nuevo o llámenos.",
    tourTitle: "Solicitar una visita",
    msgTitle: "Enviar un mensaje a la recepción",
    sheetIntro: "Deje sus datos y el equipo le responderá. (Demostración, sin datos reales.)",
    namePh: "Su nombre",
    contactPh: "Teléfono o correo",
    tourMsgPh: "¿Algo que debamos saber? (opcional)",
    msgMsgPh: "Su mensaje",
    cancel: "Cancelar",
    send: "Enviar",
    sending: "Enviando...",
    done: "Listo",
    thankYou: "Gracias.",
    reqDefaultTour: "Solicitó una visita.",
    reqDefaultMsg: "Pidió que le devuelvan la llamada.",
    thankBody: (kind, phone) =>
      `La recepción recibió su ${kind === "tour" ? "solicitud de visita" : "mensaje"} y le responderá.${
        phone ? ` Para algo urgente, llame al ${phone}.` : ""
      }`,
    failed: (phone) =>
      `No se pudo enviar. Inténtelo de nuevo${phone ? ` o llame al ${phone}` : ""}.`,
    offlineBanner: "Sin conexión. Respondiendo desde el manual guardado.",
    offlineTag: "Sin conexión",
    offlineNoData:
      "Está sin conexión y este dispositivo aún no ha guardado la información del centro. Abra esta página una vez con conexión y funcionará sin conexión después.",
    queuedBody: (kind) =>
      `Está sin conexión, así que su ${kind === "tour" ? "solicitud de visita" : "mensaje"} se guardó y se enviará automáticamente cuando vuelva a tener conexión.`,
  },
};
