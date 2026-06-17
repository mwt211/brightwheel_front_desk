import { type Env, setFeedback, json } from "../_shared/db";

// Public: a parent marks an answer helpful or not. Negative feedback is the one
// signal the confidence score can't give us, so it also feeds Gap Radar (a
// confidently-wrong answer becomes a teachable gap).
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: { question_id?: number; helpful?: boolean };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const id = Number(body.question_id);
  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: "Missing question_id." }, 400);
  }
  if (typeof body.helpful !== "boolean") {
    return json({ error: "Missing helpful flag." }, 400);
  }
  await setFeedback(env.DB, id, body.helpful);
  return json({ ok: true });
};
