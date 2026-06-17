import {
  type Env,
  addRequest,
  listRequests,
  setRequestHandled,
  json,
  operatorGate,
} from "../_shared/db";

// Deterministic urgency flag so time-sensitive messages float to the top of the
// operator inbox (bilingual, like the safety net).
const URGENT =
  /\b(urgent|asap|right away|right now|as soon as|today|tonight|emergency|sick|fever|hurt|injured|accident|allerg|reaction|can'?t reach|hoy|urgente|enfermo|enferma|fiebre|emergencia|ahora|lastim|accidente)\b/i;

// POST is public: a parent leaving a message or requesting a tour.
// GET is the operator inbox, guarded.
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: {
    kind?: string;
    name?: string;
    contact?: string;
    message?: string;
    related_question_id?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const kind = body.kind === "tour" ? "tour" : "message";
  const message = String(body.message ?? "").slice(0, 2000);
  const id = await addRequest(env.DB, {
    kind,
    name: String(body.name ?? "").slice(0, 120),
    contact: String(body.contact ?? "").slice(0, 200),
    message,
    related_question_id:
      typeof body.related_question_id === "number"
        ? body.related_question_id
        : null,
    urgent: URGENT.test(message),
  });
  return json({ ok: true, id });
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const blocked = operatorGate(env, request);
  if (blocked) return blocked;
  const requests = await listRequests(env.DB);
  return json({ requests });
};

// Operator marks an inbox item handled (or reopens it).
export const onRequestPatch: PagesFunction<Env> = async ({ env, request }) => {
  const blocked = operatorGate(env, request);
  if (blocked) return blocked;
  let body: { id?: number; handled?: boolean };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: "Missing request id." }, 400);
  }
  await setRequestHandled(env.DB, id, body.handled !== false);
  return json({ ok: true });
};
