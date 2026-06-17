import { useEffect, useState } from "react";
import type {
  CenterKB,
  Confidence,
  GapCluster,
  QuestionLogEntry,
  QuestionStatus,
  RequestEntry,
} from "../lib/types";
import {
  fetchGaps,
  fetchHistory,
  fetchKb,
  fetchQuestions,
  fetchRequests,
  ingestHandbookPhotos,
  saveKb,
  setRequestHandled,
  teach,
} from "../lib/api";

const isEmail = (c: string) => c.includes("@");
const contactHref = (c: string) =>
  isEmail(c) ? `mailto:${c.trim()}` : `tel:${c.replace(/[^0-9+]/g, "")}`;

type Tab = "questions" | "gaps" | "kb" | "inbox" | "activity";

const TABS: { id: Tab; label: string }[] = [
  { id: "questions", label: "Questions" },
  { id: "gaps", label: "Gap Radar" },
  { id: "kb", label: "Handbook" },
  { id: "inbox", label: "Inbox" },
  { id: "activity", label: "Activity" },
];

export function Console() {
  const [tab, setTab] = useState<Tab>("questions");
  return (
    <div className="max-w-3xl mx-auto min-h-full">
      <header className="sticky top-0 z-10 bg-brand-800 text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-semibold leading-tight">Operator Control Center</h1>
            <p className="text-[11px] text-brand-100">
              Cottonwood Sprouts &middot; source of truth &amp; insights
            </p>
          </div>
          <a href="/" className="text-xs bg-brand-600 hover:bg-brand-500 rounded-full px-3 py-1.5 transition">
            Parent view
          </a>
        </div>
        <nav className="mt-3 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-xs whitespace-nowrap rounded-full px-3 py-1.5 transition ${
                tab === t.id
                  ? "bg-white text-brand-800 font-medium"
                  : "bg-brand-700 text-brand-100 hover:bg-brand-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="p-4">
        {tab === "questions" && <QuestionsTab />}
        {tab === "gaps" && <GapsTab />}
        {tab === "kb" && <KbTab />}
        {tab === "inbox" && <InboxTab />}
        {tab === "activity" && <ActivityTab />}
      </div>
    </div>
  );
}

// ---------- Questions ----------

function QuestionsTab() {
  const [items, setItems] = useState<QuestionLogEntry[] | null>(null);
  const [filter, setFilter] = useState<QuestionStatus | "all">("all");

  useEffect(() => {
    fetchQuestions().then(setItems).catch(() => setItems([]));
  }, []);

  if (!items) return <Loading label="Loading questions" />;
  if (items.length === 0)
    return (
      <Empty
        title="No questions yet"
        body="Ask a few questions in the parent view, then refresh here."
      />
    );

  const counts = {
    answered: items.filter((q) => q.status === "answered").length,
    escalated: items.filter((q) => q.status === "escalated").length,
    unanswered: items.filter((q) => q.status === "unanswered").length,
  };
  const shown = filter === "all" ? items : items.filter((q) => q.status === filter);

  return (
    <div className="space-y-3">
      <ImpactCard items={items} />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Answered" value={counts.answered} tone="brand" />
        <Stat label="Escalated" value={counts.escalated} tone="amber" />
        <Stat label="Gaps" value={counts.unanswered} tone="ink" />
      </div>
      <div className="flex gap-1.5 text-xs">
        {(["all", "answered", "escalated", "unanswered"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 capitalize transition ${
              filter === f
                ? "bg-brand-700 text-white"
                : "bg-white border border-brand-100 text-ink/70"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {shown.map((q) => (
          <div key={q.id} className="bg-white border border-brand-100 rounded-xl p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-ink">{q.text}</p>
              <StatusBadge status={q.status} />
            </div>
            <p className="text-xs text-ink/60 mt-1 line-clamp-2">{q.answer}</p>
            <div className="flex items-center gap-2 mt-2">
              <ConfidenceBadge confidence={q.confidence} />
              <span className="text-[11px] text-ink/40">{q.category}</span>
              {q.feedback === "unhelpful" && (
                <span className="text-[11px] bg-amber/15 text-amber border border-amber/30 rounded-full px-2 py-0.5">
                  Marked unhelpful
                </span>
              )}
              <span className="text-[11px] text-ink/40 ml-auto">
                {new Date(q.created_at).toLocaleString()}
              </span>
            </div>
            {q.escalation_reason && (
              <p className="text-[11px] text-amber mt-1">{q.escalation_reason}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Gap Radar ----------

function GapsTab() {
  const [clusters, setClusters] = useState<GapCluster[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function scan() {
    setScanning(true);
    setToast(null);
    try {
      setClusters(await fetchGaps());
    } catch {
      setClusters([]);
    } finally {
      setScanning(false);
    }
  }

  async function approve(c: GapCluster) {
    const res = await teach({
      title: c.draftSection.title,
      body: c.draftSection.body,
      theme: c.theme,
    });
    if (res.ok) {
      setToast(`Added "${c.draftSection.title}" to the handbook. The bot can answer it now.`);
      setClusters((prev) => prev?.filter((x) => x.theme !== c.theme) ?? null);
    } else {
      setToast(res.error ?? "Could not save.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-brand-800">Gap Radar</h2>
        <p className="text-xs text-ink/70 mt-1">
          Finds the questions the assistant could not confidently answer, groups them,
          and drafts a handbook entry for each. Approve one and the parent assistant can
          answer it immediately. The front desk teaches itself.
        </p>
        <button
          onClick={scan}
          disabled={scanning}
          className="mt-3 text-sm bg-brand-700 text-white rounded-full px-4 py-2 disabled:opacity-50"
        >
          {scanning ? "Scanning the question log..." : "Scan for gaps"}
        </button>
      </div>

      {toast && (
        <div className="bg-brand-600 text-white text-sm rounded-xl px-3 py-2">{toast}</div>
      )}

      {clusters && clusters.length === 0 && (
        <Empty
          title="No open gaps"
          body="Either nothing has stumped the bot, or you have already taught it. Try asking an off-handbook question in the parent view first."
        />
      )}

      {clusters?.map((c) => (
        <GapCard key={c.theme} cluster={c} onApprove={() => approve(c)} />
      ))}
    </div>
  );
}

function GapCard({
  cluster,
  onApprove,
}: {
  cluster: GapCluster;
  onApprove: () => void;
}) {
  const [title, setTitle] = useState(cluster.draftSection.title);
  const [body, setBody] = useState(cluster.draftSection.body);
  const [saving, setSaving] = useState(false);

  return (
    <div className="bg-white border border-brand-100 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{cluster.theme}</h3>
        {cluster.reviewOnly ? (
          <span className="text-[11px] bg-amber/15 text-amber border border-amber/30 rounded-full px-2 py-0.5">
            Review only
          </span>
        ) : (
          <span className="text-[11px] bg-brand-50 text-brand-700 border border-brand-100 rounded-full px-2 py-0.5">
            {cluster.count} question{cluster.count === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <ul className="text-xs text-ink/60 list-disc pl-4 space-y-0.5">
        {cluster.exampleQuestions.slice(0, 3).map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ul>
      {cluster.reviewOnly && (
        <p className="text-[11px] text-amber">
          Health or safety topic. This draft describes how staff should route it, not
          medical guidance. Please review before publishing.
        </p>
      )}
      <div className="space-y-1.5 pt-1">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-sm font-medium bg-cream border border-brand-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-400"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="w-full text-sm bg-cream border border-brand-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-400 resize-y"
        />
      </div>
      {cluster.reviewOnly ? (
        // Health and safety themes are never published with one tap. The
        // operator reviews and, if appropriate, adds a section by hand.
        <p className="text-xs text-amber">
          Health and safety topics are not taught with one tap. Review this with
          staff and, if appropriate, add a section manually in the Handbook tab.
        </p>
      ) : (
        <button
          onClick={async () => {
            setSaving(true);
            cluster.draftSection.title = title;
            cluster.draftSection.body = body;
            await onApprove();
            setSaving(false);
          }}
          disabled={saving}
          className="text-sm bg-brand-600 text-white rounded-full px-4 py-2 disabled:opacity-50"
        >
          {saving ? "Teaching..." : "Approve & teach the bot"}
        </button>
      )}
    </div>
  );
}

// ---------- Knowledge base editor ----------

function KbTab() {
  const [kb, setKb] = useState<CenterKB | null>(null);
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [raw, setRaw] = useState(false);
  const [rawText, setRawText] = useState("");

  useEffect(() => {
    fetchKb().then(({ kb, version }) => {
      setKb(kb);
      setVersion(version);
      setRawText(JSON.stringify(kb, null, 2));
    });
  }, []);

  if (!kb) return <Loading label="Loading handbook" />;

  async function save(next: CenterKB) {
    setStatus("Saving...");
    const res = await saveKb(next, version);
    if (res.ok && typeof res.version === "number") {
      setVersion(res.version);
      setStatus("Saved. The parent assistant now uses this.");
    } else if (res.error === "conflict") {
      setStatus(res.message ?? "Conflict. Reload and retry.");
    } else {
      setStatus(res.error ?? "Save failed.");
    }
  }

  function updateSection(i: number, field: "title" | "body", value: string) {
    setKb((prev) => {
      if (!prev) return prev;
      const sections = prev.sections.slice();
      sections[i] = { ...sections[i], [field]: value };
      return { ...prev, sections };
    });
  }

  // Merge photo-extracted sections into the handbook for the operator to review.
  // Non-destructive: imported sections are always appended, and a title that
  // already exists is suffixed rather than overwriting the operator's content.
  function mergeSections(incoming: { title: string; body: string }[]) {
    // If the raw editor is open with valid edits, merge into those so they are
    // not lost; otherwise merge into the current structured handbook.
    let base: CenterKB | null = kb;
    if (raw) {
      try {
        base = JSON.parse(rawText) as CenterKB;
      } catch {
        /* keep the structured kb if raw text is mid-edit and invalid */
      }
    }
    if (!base) return;
    const baseSections = Array.isArray(base.sections) ? base.sections : [];
    const existing = new Set(baseSections.map((s) => s.title.toLowerCase()));
    const additions = incoming.map((ns) =>
      existing.has(ns.title.toLowerCase())
        ? { title: `${ns.title} (imported)`, body: ns.body }
        : ns,
    );
    const next = { ...base, sections: [...baseSections, ...additions] };
    setKb(next);
    if (raw) setRawText(JSON.stringify(next, null, 2));
    setStatus(
      `Added ${additions.length} section${additions.length === 1 ? "" : "s"} from your photo. Nothing was overwritten; review below and Save handbook.`,
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Handbook (source of truth)</h2>
        <button
          onClick={() => {
            // Sync the raw editor to the latest structured edits before showing it.
            if (!raw && kb) setRawText(JSON.stringify(kb, null, 2));
            setRaw((r) => !r);
          }}
          className="text-xs text-brand-700 underline"
        >
          {raw ? "Structured editor" : "Advanced (raw JSON)"}
        </button>
      </div>

      {status && (
        <div className="bg-brand-50 border border-brand-100 text-sm text-brand-800 rounded-xl px-3 py-2">
          {status}
        </div>
      )}

      <PhotoImport onSections={mergeSections} />

      {raw ? (
        <div className="space-y-2">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={20}
            className="w-full text-xs font-mono bg-white border border-brand-200 rounded-xl p-3 outline-none"
          />
          <button
            onClick={() => {
              try {
                const parsed = JSON.parse(rawText) as CenterKB;
                setKb(parsed);
                save(parsed);
              } catch {
                setStatus("Invalid JSON. Fix and try again.");
              }
            }}
            className="text-sm bg-brand-600 text-white rounded-full px-4 py-2"
          >
            Apply &amp; save JSON
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white border border-brand-100 rounded-xl p-3 space-y-2">
            <Field label="Center name" value={kb.center.name} onChange={(v) => setKb({ ...kb, center: { ...kb.center, name: v } })} />
            <Field label="Phone" value={kb.center.phone} onChange={(v) => setKb({ ...kb, center: { ...kb.center, phone: v } })} />
            <Field label="Hours" value={kb.center.hours} onChange={(v) => setKb({ ...kb, center: { ...kb.center, hours: v } })} />
          </div>

          <div className="space-y-3">
            {kb.sections.map((s, i) => (
              <div key={i} className="bg-white border border-brand-100 rounded-xl p-3 space-y-1.5">
                <input
                  value={s.title}
                  onChange={(e) => updateSection(i, "title", e.target.value)}
                  className="w-full text-sm font-semibold bg-cream border border-brand-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-400"
                />
                <textarea
                  value={s.body}
                  onChange={(e) => updateSection(i, "body", e.target.value)}
                  rows={4}
                  className="w-full text-sm bg-cream border border-brand-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-400 resize-y"
                />
                <button
                  onClick={() =>
                    setKb({ ...kb, sections: kb.sections.filter((_, j) => j !== i) })
                  }
                  className="text-[11px] text-ink/40 hover:text-amber"
                >
                  Remove section
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setKb({
                  ...kb,
                  sections: [...kb.sections, { title: "New section", body: "" }],
                })
              }
              className="text-sm border border-brand-200 rounded-full px-4 py-2 text-brand-700"
            >
              + Add section
            </button>
          </div>

          <button
            onClick={() => save(kb)}
            className="text-sm bg-brand-600 text-white rounded-full px-5 py-2.5 sticky bottom-3 shadow-lg"
          >
            Save handbook
          </button>
        </>
      )}
    </div>
  );
}

// ---------- Inbox ----------

function InboxTab() {
  const [items, setItems] = useState<RequestEntry[] | null>(null);
  useEffect(() => {
    fetchRequests().then(setItems).catch(() => setItems([]));
  }, []);

  async function toggleHandled(r: RequestEntry) {
    const next = !r.handled;
    setItems((prev) => prev?.map((x) => (x.id === r.id ? { ...x, handled: next } : x)) ?? prev);
    const res = await setRequestHandled(r.id, next);
    if (!res.ok) {
      // Revert the optimistic update if the write failed.
      setItems((prev) => prev?.map((x) => (x.id === r.id ? { ...x, handled: !next } : x)) ?? prev);
    }
  }

  if (!items) return <Loading label="Loading inbox" />;
  if (items.length === 0)
    return (
      <Empty
        title="Inbox empty"
        body="Tour requests and messages from parents land here."
      />
    );
  return (
    <div className="space-y-2">
      {items.map((r) => (
        <div
          key={r.id}
          className={`bg-white border rounded-xl p-3 ${
            r.handled
              ? "border-brand-100 opacity-60"
              : r.urgent
                ? "border-amber/50 ring-1 ring-amber/30"
                : "border-brand-100"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="text-xs font-medium capitalize bg-brand-50 text-brand-700 rounded-full px-2 py-0.5">
                {r.kind}
              </span>
              {r.urgent && !r.handled && (
                <span className="text-[11px] font-medium bg-amber/15 text-amber border border-amber/30 rounded-full px-2 py-0.5">
                  Urgent
                </span>
              )}
              {r.handled && (
                <span className="text-[11px] font-medium bg-brand-50 text-brand-700 border border-brand-100 rounded-full px-2 py-0.5">
                  Handled
                </span>
              )}
            </span>
            <span className="text-[11px] text-ink/40">
              {new Date(r.created_at).toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-ink mt-1.5">{r.message}</p>
          <p className="text-xs text-ink/60 mt-1">
            {r.name || "Anonymous"} {r.contact ? `· ${r.contact}` : ""}
          </p>
          <div className="flex gap-2 mt-2">
            {r.contact && (
              <a
                href={contactHref(r.contact)}
                className="text-xs bg-brand-600 text-white rounded-full px-3 py-1 hover:bg-brand-500 transition"
              >
                {isEmail(r.contact) ? "Email back" : "Call back"}
              </a>
            )}
            <button
              onClick={() => toggleHandled(r)}
              className="text-xs border border-brand-200 rounded-full px-3 py-1 text-ink/70 hover:border-brand-400 transition"
            >
              {r.handled ? "Reopen" : "Mark handled"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Activity ----------

function ActivityTab() {
  const [items, setItems] = useState<
    { id: number; created_at: string; summary: string }[] | null
  >(null);
  useEffect(() => {
    fetchHistory().then(setItems).catch(() => setItems([]));
  }, []);
  if (!items) return <Loading label="Loading activity" />;
  if (items.length === 0)
    return <Empty title="No activity yet" body="Edits and taught entries appear here." />;
  return (
    <div className="space-y-2">
      {items.map((h) => (
        <div key={h.id} className="bg-white border border-brand-100 rounded-xl p-3">
          <p className="text-sm text-ink">{h.summary}</p>
          <p className="text-[11px] text-ink/40 mt-0.5">
            {new Date(h.created_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}

// ---------- Photo import ("snap a photo of your handbook") ----------

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read the file."));
    r.readAsDataURL(file);
  });
}

function PhotoImport({
  onSections,
}: {
  onSections: (sections: { title: string; body: string }[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafted, setDrafted] = useState<{ title: string; body: string }[] | null>(
    null,
  );

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    setDrafted(null);
    try {
      const urls = await Promise.all(
        Array.from(files).slice(0, 4).map(readAsDataUrl),
      );
      const res = await ingestHandbookPhotos(urls);
      // Show what we read before adding, so the operator sees the work done.
      if (res.sections && res.sections.length > 0) setDrafted(res.sections);
      else setError(res.error ?? "No sections were found in those photos.");
    } catch {
      setError("Could not read those photos. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-brand-50 border border-brand-100 rounded-xl p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-800">
            Onboard from your paper handbook
          </p>
          <p className="text-[11px] text-ink/60">
            Snap a photo of your handbook and we'll draft the sections for you to
            review. No retyping.
          </p>
        </div>
        <label
          className={`shrink-0 text-sm rounded-full px-4 py-2 cursor-pointer ${
            busy ? "bg-brand-300 text-white" : "bg-brand-700 text-white hover:bg-brand-600"
          }`}
        >
          {busy ? "Reading..." : "Choose photos"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            disabled={busy}
            onChange={(e) => {
              // Reset the input so the same photo can be re-imported.
              const input = e.currentTarget;
              void handleFiles(input.files).finally(() => {
                input.value = "";
              });
            }}
          />
        </label>
      </div>

      {busy && (
        <p className="text-xs text-ink/60 mt-2">Reading your handbook...</p>
      )}
      {error && <p className="text-xs text-amber mt-2">{error}</p>}

      {drafted && (
        <div className="mt-3 bg-white border border-brand-100 rounded-lg p-3">
          <p className="text-sm font-medium text-brand-800">
            We read your handbook and drafted {drafted.length} section
            {drafted.length === 1 ? "" : "s"}:
          </p>
          <ul className="text-xs text-ink/70 list-disc pl-4 mt-1.5 space-y-0.5">
            {drafted.map((s, i) => (
              <li key={i}>{s.title}</li>
            ))}
          </ul>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                onSections(drafted);
                setDrafted(null);
              }}
              className="text-sm bg-brand-600 text-white rounded-full px-4 py-2 hover:bg-brand-500"
            >
              Add to handbook
            </button>
            <button
              onClick={() => setDrafted(null)}
              className="text-sm border border-brand-200 rounded-full px-4 py-2"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Shared bits ----------

const CATEGORY_LABELS: Record<string, string> = {
  hours_calendar: "Hours & closures",
  tuition_fees: "Tuition & fees",
  illness_health: "Illness & health",
  food_menu: "Meals & lunch",
  tours_enrollment: "Tours & enrollment",
  pickup_dropoff: "Pickup & dropoff",
  other: "Other",
};

// Assume each question the bot answers without staff saves a short call/text.
const MINUTES_PER_DEFLECTION = 3;

function ImpactCard({ items }: { items: QuestionLogEntry[] }) {
  const total = items.length;
  const answered = items.filter((q) => q.status === "answered").length;
  const handled = items.filter((q) => q.status !== "unanswered").length;
  const rate = total ? Math.round((answered / total) * 100) : 0;
  const minutes = answered * MINUTES_PER_DEFLECTION;
  const saved =
    minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;

  const topics = Object.entries(
    items.reduce<Record<string, number>>((acc, q) => {
      acc[q.category] = (acc[q.category] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="bg-brand-700 text-white rounded-2xl p-4">
      <p className="text-[11px] uppercase tracking-wide text-brand-100">
        Less admin. More impact.
      </p>
      <div className="mt-2 grid grid-cols-3 gap-3">
        <div>
          <div className="text-2xl font-semibold">{saved}</div>
          <div className="text-[11px] text-brand-100">staff time saved</div>
        </div>
        <div>
          <div className="text-2xl font-semibold">{rate}%</div>
          <div className="text-[11px] text-brand-100">answered instantly</div>
        </div>
        <div>
          <div className="text-2xl font-semibold">{handled}</div>
          <div className="text-[11px] text-brand-100">of {total} handled</div>
        </div>
      </div>
      {topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {topics.map(([cat, n]) => (
            <span
              key={cat}
              className="text-[11px] bg-brand-600 rounded-full px-2 py-0.5"
            >
              {CATEGORY_LABELS[cat] ?? cat} &middot; {n}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-[10px] text-brand-100/80">
        Estimated from this center's log, about {MINUTES_PER_DEFLECTION} minutes saved
        per question answered without staff.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "brand" | "amber" | "ink";
}) {
  const toneClass =
    tone === "brand" ? "text-brand-700" : tone === "amber" ? "text-amber" : "text-ink/60";
  return (
    <div className="bg-white border border-brand-100 rounded-xl p-3 text-center">
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
      <div className="text-[11px] text-ink/50">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: QuestionStatus }) {
  const map = {
    answered: "bg-brand-50 text-brand-700 border-brand-100",
    escalated: "bg-amber/10 text-amber border-amber/30",
    unanswered: "bg-ink/5 text-ink/60 border-ink/10",
  };
  return (
    <span className={`text-[11px] border rounded-full px-2 py-0.5 capitalize ${map[status]}`}>
      {status}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const dot =
    confidence === "high"
      ? "bg-brand-500"
      : confidence === "medium"
        ? "bg-amber"
        : "bg-ink/30";
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-ink/50">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {confidence}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-ink/50">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm bg-cream border border-brand-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-400"
      />
    </label>
  );
}

function Loading({ label }: { label: string }) {
  return <p className="text-sm text-ink/50 py-8 text-center">{label}...</p>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="text-center py-10 px-6">
      <p className="font-medium text-ink">{title}</p>
      <p className="text-sm text-ink/60 mt-1">{body}</p>
    </div>
  );
}
