// LLM access. The primary provider is Groq (fast, OpenAI-compatible) when
// GROQ_API_KEY is set; otherwise we fall back to Cloudflare Workers AI so the
// demo always works with no key at all. Vision (handbook photo OCR) uses Groq's
// multimodal model and needs the key. We ask for JSON and parse defensively, so
// swapping providers means re-implementing only the functions in this file.
import type { Env } from "./db";

const WORKERS_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Matches unescaped control characters; built from a string so the source
// stays pure ASCII (no literal control bytes in the file).
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F]+", "g");

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

/** Parsed JSON object from the model, or null. Prefers Groq; falls back to Workers AI. */
export async function runJson<T = Record<string, unknown>>(
  env: Env,
  messages: ChatMsg[],
  opts: { schema?: object; maxTokens?: number } = {},
): Promise<T | null> {
  if (env.GROQ_API_KEY) {
    try {
      const text = await groqComplete(env, {
        model: env.GROQ_MODEL || GROQ_MODEL,
        messages,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: 0.1,
        response_format: { type: "json_object" },
      });
      const parsed = text ? extractJson<T>(text) : null;
      if (parsed) return parsed;
      console.warn("groq returned no usable JSON; falling back to Workers AI");
    } catch (err) {
      console.error("groq failed; falling back to Workers AI", err);
    }
  }
  return workersJson<T>(env, messages, opts);
}

async function workersJson<T>(
  env: Env,
  messages: ChatMsg[],
  opts: { schema?: object; maxTokens?: number },
): Promise<T | null> {
  const model = env.LLM_MODEL || WORKERS_MODEL;
  const base = { messages, max_tokens: opts.maxTokens ?? 1024, temperature: 0.1 };
  let res: unknown;
  try {
    res = await env.AI.run(
      model,
      opts.schema
        ? { ...base, response_format: { type: "json_schema", json_schema: opts.schema } }
        : base,
    );
  } catch {
    res = await env.AI.run(model, base);
  }
  const r = (res as { response?: unknown }).response;
  if (r && typeof r === "object") return r as T;
  if (typeof r === "string") return extractJson<T>(r);
  return null;
}

/** Low-level Groq chat call returning the assistant message text. */
async function groqComplete(
  env: Env,
  body: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Vision: read handbook photos and return parsed JSON. Groq multimodal only, so
 * it requires GROQ_API_KEY. dataUrls are "data:image/...;base64,..." strings.
 * Instructions are folded into the user turn to avoid system+image edge cases.
 */
export async function runVisionJson<T = Record<string, unknown>>(
  env: Env,
  dataUrls: string[],
  instructions: string,
  requireKey?: string,
): Promise<T | null> {
  if (!env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is required for photo import.");
  }
  const content: unknown[] = [{ type: "text", text: instructions }];
  for (const url of dataUrls) content.push({ type: "image_url", image_url: { url } });
  const text = await groqComplete(env, {
    model: env.GROQ_VISION_MODEL || GROQ_VISION_MODEL,
    messages: [{ role: "user", content }],
    max_tokens: 2500,
    temperature: 0.1,
  });
  // requireKey guards against returning a stray brace fragment from OCR text.
  return extractJson<T>(text, requireKey);
}

/**
 * Extract a JSON object from model text. Handles code fences, leading prose, and
 * the common open-model failure of raw newlines/tabs inside string values
 * (which makes JSON.parse throw) by stripping control characters and retrying.
 */
export function extractJson<T = Record<string, unknown>>(
  text: string,
  requireKey?: string,
): T | null {
  if (!text) return null;
  const cleaned = text.replace(/```json\s*|\s*```/gi, "").trim();
  const ok = (v: unknown): v is T =>
    !!v && typeof v === "object" && (!requireKey || requireKey in (v as object));

  const whole = tryParse<T>(cleaned);
  if (ok(whole)) return whole;

  // Try each "{" as a candidate object start and return the first that parses
  // (and contains requireKey, if given), so stray braces in prose or OCR text
  // do not abort the search or return the wrong object.
  for (
    let start = cleaned.indexOf("{");
    start !== -1;
    start = cleaned.indexOf("{", start + 1)
  ) {
    const slice = balancedSlice(cleaned, start);
    if (!slice) continue;
    const parsed = tryParse<T>(slice);
    if (ok(parsed)) return parsed;
  }
  return null;
}

function balancedSlice(s: string, start: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i += 1) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function tryParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    try {
      return JSON.parse(s.replace(CONTROL_CHARS, " ")) as T;
    } catch {
      return null;
    }
  }
}
