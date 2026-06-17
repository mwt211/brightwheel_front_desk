import { type Env, json, operatorGate } from "../_shared/db";
import { runVisionJson } from "../_shared/llm";

const MAX_IMAGES = 4;
const MAX_CHARS = 7_000_000; // ~5MB per image as a base64 data URL
const MAX_TOTAL_CHARS = 12_000_000; // keep the whole request under the upstream API limit

const INSTRUCTIONS = `You are reading one or more photos of a childcare center's parent handbook. Transcribe what you see and organize it into clean, faithful sections.

Rules:
- Use ONLY the text visible in the photos. Do not invent policies, prices, dates, or names.
- Give each section a short, clear title (for example "Hours & Closures", "Tuition & Fees", "Illness Policy").
- Keep the body faithful to the photo; fix obvious OCR noise but do not paraphrase away detail.
- If a photo is unreadable, skip it.

Respond with ONLY a JSON object, no prose and no code fences:
{ "sections": [ { "title": string, "body": string } ] }`;

// Operator-only: turn photos of a handbook into editable sections for review.
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const blocked = operatorGate(env, request);
  if (blocked) return blocked;

  let body: { images?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const images = Array.isArray(body.images)
    ? body.images
        .filter((u): u is string => typeof u === "string" && u.startsWith("data:image/"))
        .slice(0, MAX_IMAGES)
    : [];
  if (images.length === 0) {
    return json({ error: "Attach at least one handbook photo." }, 400);
  }
  if (images.some((u) => u.length > MAX_CHARS)) {
    return json({ error: "One of the photos is too large. Try a smaller image." }, 413);
  }
  if (images.reduce((sum, u) => sum + u.length, 0) > MAX_TOTAL_CHARS) {
    return json({ error: "Those photos are too large together. Try two or three smaller photos." }, 413);
  }

  try {
    const out = await runVisionJson<{ sections?: { title: string; body: string }[] }>(
      env,
      images,
      INSTRUCTIONS,
      "sections",
    );
    const sections = Array.isArray(out?.sections)
      ? out.sections.filter(
          (s) =>
            s &&
            typeof s.title === "string" &&
            typeof s.body === "string" &&
            s.title.trim() &&
            s.body.trim(),
        )
      : [];
    if (sections.length === 0) {
      return json(
        { error: "Could not read sections from those photos. Try clearer, well-lit images." },
        422,
      );
    }
    return json({ sections });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Photo import failed.";
    // Missing key is the common case; surface it plainly to the operator.
    const status = message.includes("GROQ_API_KEY") ? 400 : 502;
    return json({ error: message }, status);
  }
};
