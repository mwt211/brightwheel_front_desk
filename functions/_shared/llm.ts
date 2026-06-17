// LLM access via Cloudflare Workers AI (Llama). No external API key: the model
// runs on the Cloudflare account through the AI binding. We use schema-guided
// JSON output and parse defensively, so the provider is easy to swap (Groq,
// OpenAI, Bedrock) by re-implementing just runJson().
import type { Env } from "./db";

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Matches unescaped control characters; built from a string so the source
// stays pure ASCII (no literal control bytes in the file).
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F]+", "g");

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

/**
 * Run the model and return a parsed JSON object, or null if nothing usable
 * came back. When a schema is provided we ask Workers AI for guided JSON, which
 * keeps open models from emitting invalid JSON; we still parse defensively in
 * case the variant ignores it.
 */
export async function runJson<T = Record<string, unknown>>(
  env: Env,
  messages: ChatMsg[],
  opts: { schema?: object; maxTokens?: number } = {},
): Promise<T | null> {
  const model = env.LLM_MODEL || DEFAULT_MODEL;
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
    // Some model variants reject response_format; retry as a plain completion.
    res = await env.AI.run(model, base);
  }

  const r = (res as { response?: unknown }).response;
  if (r && typeof r === "object") return r as T;
  if (typeof r === "string") return extractJson<T>(r);
  return null;
}

/**
 * Extract a JSON object from model text. Handles code fences, leading prose, and
 * the common open-model failure of raw newlines/tabs inside string values
 * (which makes JSON.parse throw) by stripping control characters and retrying.
 */
export function extractJson<T = Record<string, unknown>>(text: string): T | null {
  if (!text) return null;
  const cleaned = text.replace(/```json\s*|\s*```/gi, "").trim();

  const whole = tryParse<T>(cleaned);
  if (whole && typeof whole === "object") return whole;

  // Try each "{" as a candidate object start and return the first that parses,
  // so leading prose containing stray braces does not abort the search.
  for (
    let start = cleaned.indexOf("{");
    start !== -1;
    start = cleaned.indexOf("{", start + 1)
  ) {
    const slice = balancedSlice(cleaned, start);
    if (!slice) continue;
    const parsed = tryParse<T>(slice);
    if (parsed && typeof parsed === "object") return parsed;
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
