// D1 access layer. All SQL lives here so the route handlers stay readable.
import seed from "../../seed/center.json";

// Minimal AI binding shape so we don't depend on a specific workers-types version.
export interface AiBinding {
  run(model: string, inputs: unknown): Promise<unknown>;
}

export interface Env {
  DB: D1Database;
  AI: AiBinding;
  LLM_MODEL?: string;
  DAILY_QUESTION_CAP?: string;
  OPERATOR_PASSCODE?: string;
}

export type KbRow = { json: string; version: number; updated_at: string };

export function nowIso(): string {
  return new Date().toISOString();
}

/** Read the knowledge base, seeding it from the bundled center.json on first use. */
export async function getKb(
  db: D1Database,
): Promise<{ kb: unknown; version: number }> {
  const row = await db
    .prepare("SELECT json, version FROM kb WHERE id = 1")
    .first<{ json: string; version: number }>();
  if (row) return { kb: JSON.parse(row.json), version: row.version };

  const json = JSON.stringify(seed);
  await db
    .prepare(
      "INSERT INTO kb (id, json, version, updated_at) VALUES (1, ?, 1, ?)",
    )
    .bind(json, nowIso())
    .run();
  return { kb: seed, version: 1 };
}

/**
 * Write the knowledge base with optimistic concurrency. The caller passes the
 * version it last read; if it no longer matches, the write is rejected so a
 * concurrent edit is never silently overwritten.
 */
export async function putKb(
  db: D1Database,
  kb: unknown,
  expectedVersion: number,
): Promise<{ ok: true; version: number } | { ok: false; current: number }> {
  await getKb(db); // ensure the row exists
  const res = await db
    .prepare(
      "UPDATE kb SET json = ?, version = version + 1, updated_at = ? WHERE id = 1 AND version = ?",
    )
    .bind(JSON.stringify(kb), nowIso(), expectedVersion)
    .run();
  if (res.meta.changes === 0) {
    const current = await db
      .prepare("SELECT version FROM kb WHERE id = 1")
      .first<{ version: number }>();
    return { ok: false, current: current?.version ?? 1 };
  }
  return { ok: true, version: expectedVersion + 1 };
}

export type LogInput = {
  text: string;
  answer: string;
  confidence: string;
  category: string;
  status: string;
  needs_human: boolean;
  escalation_reason: string | null;
  citations: unknown;
};

export async function logQuestion(
  db: D1Database,
  input: LogInput,
): Promise<number> {
  const res = await db
    .prepare(
      `INSERT INTO questions
        (created_at, text, answer, confidence, category, status, needs_human, escalation_reason, citations)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      nowIso(),
      input.text,
      input.answer,
      input.confidence,
      input.category,
      input.status,
      input.needs_human ? 1 : 0,
      input.escalation_reason,
      JSON.stringify(input.citations ?? []),
    )
    .run();
  return res.meta.last_row_id as number;
}

export async function listQuestions(db: D1Database, limit = 200) {
  const { results } = await db
    .prepare(
      `SELECT id, created_at, text, answer, confidence, category, status, needs_human, escalation_reason, citations
       FROM questions ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(limit)
    .all();
  return (results ?? []).map((r) => ({
    ...r,
    needs_human: Boolean(r.needs_human),
    citations: safeParse(r.citations as string, []),
  }));
}

export async function addRequest(
  db: D1Database,
  input: {
    kind: string;
    name: string;
    contact: string;
    message: string;
    related_question_id: number | null;
  },
): Promise<number> {
  const res = await db
    .prepare(
      `INSERT INTO requests (created_at, kind, name, contact, message, related_question_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      nowIso(),
      input.kind,
      input.name,
      input.contact,
      input.message,
      input.related_question_id,
    )
    .run();
  return res.meta.last_row_id as number;
}

export async function listRequests(db: D1Database, limit = 100) {
  const { results } = await db
    .prepare("SELECT * FROM requests ORDER BY created_at DESC LIMIT ?")
    .bind(limit)
    .all();
  return results ?? [];
}

export async function addHistory(db: D1Database, summary: string) {
  await db
    .prepare("INSERT INTO kb_history (created_at, summary) VALUES (?, ?)")
    .bind(nowIso(), summary)
    .run();
}

export async function listHistory(db: D1Database, limit = 50) {
  const { results } = await db
    .prepare("SELECT * FROM kb_history ORDER BY created_at DESC LIMIT ?")
    .bind(limit)
    .all();
  return results ?? [];
}

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

/**
 * Soft operator gate. If OPERATOR_PASSCODE is unset (default in this demo),
 * operator routes are open. If set, callers must send a matching
 * x-operator-passcode header. Returns an error Response when blocked, else null.
 */
export function operatorGate(env: Env, request: Request): Response | null {
  const need = env.OPERATOR_PASSCODE;
  if (!need) return null;
  if (request.headers.get("x-operator-passcode") === need) return null;
  return json({ error: "Operator passcode required." }, 401);
}
