import type {
  AnswerPayload,
  CenterKB,
  Child,
  GapCluster,
  QuestionLogEntry,
  RequestEntry,
} from "./types";

// Optional operator passcode (only needed if the deployment sets one).
function opHeaders(): Record<string, string> {
  const pass =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("op_passcode")
      : null;
  return pass ? { "x-operator-passcode": pass } : {};
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Request failed (${res.status})`,
    );
  }
  return data as T;
}

// For calls that must inspect a non-2xx body (e.g. a 409 conflict from an
// optimistic-locked save), return the parsed body without throwing.
async function jsonBody<T>(res: Response): Promise<T> {
  return (await res.json().catch(() => ({ error: "Network error" }))) as T;
}

export async function askQuestion(
  text: string,
  history: { role: "user" | "assistant"; content: string }[],
  childId?: string | null,
): Promise<AnswerPayload> {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, history, childId: childId ?? undefined }),
  });
  return jsonOrThrow<AnswerPayload>(res);
}

export async function fetchChildren(): Promise<Child[]> {
  const data = await jsonOrThrow<{ children: Child[] }>(
    await fetch("/api/children"),
  );
  return data.children ?? [];
}

export async function sendFeedback(
  questionId: number,
  helpful: boolean,
): Promise<void> {
  await fetch("/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question_id: questionId, helpful }),
  }).catch(() => {
    /* feedback is best-effort; never block the parent on it */
  });
}

export async function fetchKb(): Promise<{ kb: CenterKB; version: number }> {
  return jsonOrThrow(await fetch("/api/kb"));
}

export async function saveKb(
  kb: CenterKB,
  version: number,
): Promise<{ ok?: boolean; version?: number; error?: string; current?: number; message?: string }> {
  const res = await fetch("/api/kb", {
    method: "PUT",
    headers: { "content-type": "application/json", ...opHeaders() },
    body: JSON.stringify({ kb, version }),
  });
  return jsonBody(res);
}

export async function leaveRequest(input: {
  kind: "tour" | "message";
  name: string;
  contact: string;
  message: string;
  related_question_id?: number | null;
}): Promise<{ ok: boolean; id: number }> {
  const res = await fetch("/api/requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(res);
}

export async function fetchRequests(): Promise<RequestEntry[]> {
  const data = await jsonOrThrow<{ requests: RequestEntry[] }>(
    await fetch("/api/requests", { headers: opHeaders() }),
  );
  return data.requests ?? [];
}

export async function setRequestHandled(
  id: number,
  handled: boolean,
): Promise<{ ok?: boolean; error?: string }> {
  const res = await fetch("/api/requests", {
    method: "PATCH",
    headers: { "content-type": "application/json", ...opHeaders() },
    body: JSON.stringify({ id, handled }),
  });
  return jsonBody(res);
}

export async function fetchQuestions(): Promise<QuestionLogEntry[]> {
  const data = await jsonOrThrow<{ questions: QuestionLogEntry[] }>(
    await fetch("/api/questions", { headers: opHeaders() }),
  );
  return data.questions ?? [];
}

export async function fetchGaps(): Promise<GapCluster[]> {
  const data = await jsonOrThrow<{ clusters: GapCluster[] }>(
    await fetch("/api/questions?view=gaps", { headers: opHeaders() }),
  );
  return data.clusters ?? [];
}

export async function fetchHistory(): Promise<
  { id: number; created_at: string; summary: string }[]
> {
  const data = await jsonOrThrow<{
    history: { id: number; created_at: string; summary: string }[];
  }>(await fetch("/api/questions?view=history", { headers: opHeaders() }));
  return data.history ?? [];
}

export async function ingestHandbookPhotos(
  images: string[],
): Promise<{ sections?: { title: string; body: string }[]; error?: string }> {
  const res = await fetch("/api/ingest", {
    method: "POST",
    headers: { "content-type": "application/json", ...opHeaders() },
    body: JSON.stringify({ images }),
  });
  return jsonBody(res);
}

export async function teach(input: {
  title: string;
  body: string;
  theme?: string;
}): Promise<{ ok?: boolean; version?: number; error?: string }> {
  const res = await fetch("/api/questions", {
    method: "POST",
    headers: { "content-type": "application/json", ...opHeaders() },
    body: JSON.stringify(input),
  });
  return jsonBody(res);
}
