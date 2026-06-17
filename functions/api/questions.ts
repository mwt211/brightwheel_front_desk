import {
  type Env,
  listQuestions,
  listHistory,
  getKb,
  putKb,
  addHistory,
  json,
  operatorGate,
} from "../_shared/db";
import { runJson } from "../_shared/llm";

const GAP_SCHEMA = {
  type: "object",
  properties: {
    clusters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          theme: { type: "string" },
          category: { type: "string" },
          exampleQuestions: { type: "array", items: { type: "string" } },
          count: { type: "number" },
          reviewOnly: { type: "boolean" },
          draftSection: {
            type: "object",
            properties: { title: { type: "string" }, body: { type: "string" } },
            required: ["title", "body"],
          },
        },
        required: [
          "theme",
          "category",
          "exampleQuestions",
          "count",
          "reviewOnly",
          "draftSection",
        ],
      },
    },
  },
  required: ["clusters"],
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const blocked = operatorGate(env, request);
  if (blocked) return blocked;

  const view = new URL(request.url).searchParams.get("view") ?? "log";

  if (view === "history") {
    return json({ history: await listHistory(env.DB) });
  }

  if (view === "gaps") {
    return json({ clusters: await computeGaps(env) });
  }

  return json({ questions: await listQuestions(env.DB) });
};

async function computeGaps(env: Env) {
  // Pull recent questions the bot struggled with: low confidence, escalated, or
  // gaps, plus answers a parent explicitly marked unhelpful (the signal the
  // confidence score can't give us, so a confident miss still surfaces here).
  const { results } = await env.DB.prepare(
    `SELECT text, category, confidence, status FROM questions
     WHERE status IN ('unanswered','escalated') OR confidence = 'low'
        OR feedback = 'unhelpful'
     ORDER BY created_at DESC LIMIT 40`,
  ).all<{ text: string; category: string; confidence: string; status: string }>();

  const items = results ?? [];
  if (items.length === 0) return [];

  const { kb } = await getKb(env.DB);
  const centerName = (kb as { center?: { name?: string } }).center?.name ?? "the center";

  const list = items
    .map(
      (q, i) =>
        `${i + 1}. [${q.category}/${q.confidence}/${q.status}] ${q.text}`,
    )
    .join("\n");

  const system = `You help the operator of ${centerName} improve their front desk knowledge base. Below are recent parent questions the assistant could NOT confidently answer. Group them into a few clear themes. For each theme, draft a concise, editable handbook section (a title and a short body in plain policy language) that would let the assistant answer next time.

CRITICAL: For any theme touching a child's health, illness, medication, allergy, injury, or safety, set reviewOnly to true and do NOT write medical guidance. For those, draftSection should only describe the routing process (for example, that staff share the written policy and direct families to call the director or their pediatrician). Base non-health drafts on typical, reasonable childcare policy, but keep them clearly provisional for the operator to edit.

Respond with ONLY a single JSON object, no prose and no code fences:
{ "clusters": [ {
  "theme": string,
  "category": "hours_calendar" | "tuition_fees" | "illness_health" | "food_menu" | "tours_enrollment" | "pickup_dropoff" | "other",
  "exampleQuestions": [string],
  "count": number,
  "reviewOnly": boolean,
  "draftSection": { "title": string, "body": string }
} ] }`;

  try {
    const out = await runJson<{ clusters?: unknown[] }>(
      env,
      [
        { role: "system", content: system },
        {
          role: "user",
          content: `Here are the struggled questions:\n${list}\n\nPropose themes and draft handbook additions as JSON.`,
        },
      ],
      { schema: GAP_SCHEMA, maxTokens: 1800 },
    );
    const clusters = out?.clusters ?? [];
    return Array.isArray(clusters) ? clusters : [];
  } catch (err) {
    console.error("gaps: llm failure", err);
    return [];
  }
}

// Operator approves a drafted section -> append it to the handbook (one tap).
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const blocked = operatorGate(env, request);
  if (blocked) return blocked;

  let body: { title?: string; body?: string; theme?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const title = String(body.title ?? "").trim();
  const sectionBody = String(body.body ?? "").trim();
  if (!title || !sectionBody) {
    return json({ error: "Missing title or body." }, 400);
  }

  const { kb, version } = await getKb(env.DB);
  const typed = kb as { sections: { title: string; body: string }[] };
  // Guard against a handbook saved without a sections array (e.g. via the raw
  // JSON editor) so a teach never throws.
  if (!Array.isArray(typed.sections)) typed.sections = [];
  // Replace an existing section with the same title, else append.
  const idx = typed.sections.findIndex(
    (s) => s.title.toLowerCase() === title.toLowerCase(),
  );
  if (idx >= 0) typed.sections[idx] = { title, body: sectionBody };
  else typed.sections.push({ title, body: sectionBody });

  const res = await putKb(env.DB, typed, version);
  if (!res.ok) {
    return json(
      { error: "conflict", message: "Handbook changed; reload and retry.", current: res.current },
      409,
    );
  }
  await addHistory(
    env.DB,
    `Taught the bot a new section from Gap Radar: "${title}"${
      body.theme ? ` (theme: ${body.theme})` : ""
    }.`,
  );
  return json({ ok: true, version: res.version });
};
