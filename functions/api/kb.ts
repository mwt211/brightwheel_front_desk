import { type Env, getKb, putKb, json, operatorGate, addHistory } from "../_shared/db";

// GET is public: the parent bot and the operator both read the same source of
// truth. PUT is the operator saving an edit, guarded and version-checked.
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { kb, version } = await getKb(env.DB);
  return json({ kb, version });
};

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  const blocked = operatorGate(env, request);
  if (blocked) return blocked;

  let body: { kb?: unknown; version?: number };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  if (!body.kb || typeof body.version !== "number") {
    return json({ error: "Missing kb or version." }, 400);
  }

  const res = await putKb(env.DB, body.kb, body.version);
  if (!res.ok) {
    return json(
      {
        error: "conflict",
        message:
          "Someone else updated the handbook since you opened it. Reload to get the latest, then reapply your change.",
        current: res.current,
      },
      409,
    );
  }
  await addHistory(env.DB, "Operator edited the handbook.");
  return json({ ok: true, version: res.version });
};
