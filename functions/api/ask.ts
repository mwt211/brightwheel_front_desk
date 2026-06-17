import {
  type Env,
  getKb,
  logQuestion,
  json,
  nowIso,
} from "../_shared/db";
import { screen } from "../_shared/safety";
import { runJson, type ChatMsg } from "../_shared/llm";
import { buildSystemPrompt } from "../_shared/prompt";

type HistoryMsg = { role: "user" | "assistant"; content: string };

const MAX_INPUT = 1000;
const DEFAULT_DAILY_CAP = 500;

const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    citations: {
      type: "array",
      items: {
        type: "object",
        properties: { section: { type: "string" }, quote: { type: "string" } },
        required: ["section", "quote"],
      },
    },
    category: { type: "string" },
    needs_human: { type: "boolean" },
    escalation_reason: { type: "string" },
    suggested_actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          action: { type: "string" },
          value: { type: "string" },
        },
        required: ["label", "action"],
      },
    },
  },
  required: [
    "answer",
    "confidence",
    "citations",
    "category",
    "needs_human",
    "suggested_actions",
  ],
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { env, request } = ctx;
  let payload: { text?: string; history?: HistoryMsg[] };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const text = String(payload.text ?? "").trim();
  if (!text) return json({ error: "Empty question." }, 400);
  if (text.length > MAX_INPUT)
    return json({ error: "Question is too long." }, 413);

  const { kb } = await getKb(env.DB);

  // Layer 1: the deterministic safety net runs FIRST, before the rate cap or
  // the model, so an emergency is never swallowed by a cost guard or a quota.
  const intercept = screen(text, kb as Parameters<typeof screen>[1]);
  if (intercept) {
    const id = await logQuestion(env.DB, {
      text,
      answer: intercept.answer,
      confidence: intercept.confidence,
      category: intercept.category,
      status: intercept.status,
      needs_human: intercept.needs_human,
      escalation_reason: intercept.escalation_reason,
      citations: intercept.citations,
    });
    return json({ ...intercept, question_id: id });
  }

  // Cost guard: cap model-backed questions per rolling 24h. Safety questions
  // above are already handled and never reach this gate.
  const cap = Number(env.DAILY_QUESTION_CAP ?? DEFAULT_DAILY_CAP);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM questions WHERE created_at >= ?",
  )
    .bind(since)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= cap) {
    return json({
      answer:
        "Thanks for trying the demo. It has reached today's question limit to keep costs in check. Please check back tomorrow, or reach the center directly.",
      confidence: "low",
      citations: [],
      category: "other",
      needs_human: true,
      escalation_reason: "Demo daily limit reached.",
      suggested_actions: [{ label: "Message the front desk", action: "message_front_desk" }],
      rate_limited: true,
    });
  }

  // Layer 2: grounded model answer, returned as a single JSON object.
  // History roles are clamped to user/assistant so a caller cannot inject a
  // "system" message through the public endpoint.
  const history = Array.isArray(payload.history) ? payload.history.slice(-6) : [];
  const system = buildSystemPrompt(
    kb as Parameters<typeof buildSystemPrompt>[0],
    new Date(nowIso()),
  );
  const messages: ChatMsg[] = [
    { role: "system", content: system },
    ...history
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim(),
      )
      .map((m) => ({ role: m.role, content: m.content }) as ChatMsg),
    { role: "user", content: text },
  ];

  let result: Record<string, unknown> | null = null;
  try {
    result = await runJson<Record<string, unknown>>(env, messages, {
      schema: ANSWER_SCHEMA,
      maxTokens: 1024,
    });
    // One retry with a stricter nudge if the first parse failed.
    if (!result || typeof result.answer !== "string") {
      result = await runJson<Record<string, unknown>>(
        env,
        [...messages, { role: "user", content: "Respond again with ONLY the JSON object." }],
        { schema: ANSWER_SCHEMA, maxTokens: 1024 },
      );
    }
  } catch (err) {
    console.error("ask: llm failure", err);
    result = null;
  }

  const answer = normalize(result, kb);
  const status = deriveStatus(answer);
  const id = await logQuestion(env.DB, {
    text,
    answer: answer.answer,
    confidence: answer.confidence,
    category: answer.category,
    status,
    needs_human: answer.needs_human,
    escalation_reason: answer.escalation_reason || null,
    citations: answer.citations,
  });

  return json({ ...answer, status, question_id: id });
};

type Normalized = {
  answer: string;
  confidence: "high" | "medium" | "low";
  citations: { section: string; quote: string }[];
  category: string;
  needs_human: boolean;
  escalation_reason: string;
  suggested_actions: { label: string; action: string; value?: string }[];
};

function normalize(raw: Record<string, unknown> | null, kb: unknown): Normalized {
  const phone =
    (kb as { center?: { phone?: string } }).center?.phone ?? "the front desk";
  // Fail safe: if the model produced nothing parseable, escalate to a human.
  if (!raw || typeof raw.answer !== "string") {
    return {
      answer:
        "I'm sorry, I had trouble answering that just now. Let me pass this to our team so a person can help you.",
      confidence: "low",
      citations: [],
      category: "other",
      needs_human: true,
      escalation_reason: "Model returned no usable answer.",
      suggested_actions: [
        { label: "Message the front desk", action: "message_front_desk" },
        { label: "Call the center", action: "call", value: phone },
      ],
    };
  }
  const conf = ["high", "medium", "low"].includes(raw.confidence as string)
    ? (raw.confidence as Normalized["confidence"])
    : "low";
  return {
    answer: raw.answer,
    confidence: conf,
    citations: Array.isArray(raw.citations)
      ? (raw.citations as Normalized["citations"]).filter(
          (c) => c && c.section,
        )
      : [],
    category: typeof raw.category === "string" ? raw.category : "other",
    needs_human: Boolean(raw.needs_human),
    escalation_reason:
      typeof raw.escalation_reason === "string" ? raw.escalation_reason : "",
    suggested_actions: Array.isArray(raw.suggested_actions)
      ? (raw.suggested_actions as Normalized["suggested_actions"]).filter(
          (a) => a && a.label && a.action,
        )
      : [],
  };
}

function deriveStatus(a: Normalized): "answered" | "escalated" | "unanswered" {
  if (a.confidence === "low") return "unanswered";
  if (a.needs_human) return "escalated";
  return "answered";
}
