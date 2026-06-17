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
  saveKb,
  teach,
} from "../lib/api";

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Handbook (source of truth)</h2>
        <button
          onClick={() => setRaw((r) => !r)}
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
        <div key={r.id} className="bg-white border border-brand-100 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium capitalize bg-brand-50 text-brand-700 rounded-full px-2 py-0.5">
              {r.kind}
            </span>
            <span className="text-[11px] text-ink/40">
              {new Date(r.created_at).toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-ink mt-1.5">{r.message}</p>
          <p className="text-xs text-ink/60 mt-1">
            {r.name || "Anonymous"} {r.contact ? `· ${r.contact}` : ""}
          </p>
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

// ---------- Shared bits ----------

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
