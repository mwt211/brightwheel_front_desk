import { useEffect, useRef, useState } from "react";
import type { AnswerPayload, CenterKB, ChatMessage, SuggestedAction } from "../lib/types";
import { fetchKb, leaveRequest } from "../lib/api";
import { createRecognizer, isVoiceInputSupported, type Recognizer } from "./voice";
import {
  askWithFallback,
  cacheKb,
  loadCachedKb,
  flushQueue,
  isOffline,
  queueRequest,
} from "./offline";
import {
  STRINGS,
  STARTERS,
  detectLang,
  initialLang,
  speechLang,
  type Lang,
} from "./i18n";

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Math.random());
}

const telHref = (value: string) => `tel:${value.replace(/[^0-9+]/g, "")}`;

const actionable = (actions?: SuggestedAction[]) =>
  actions?.filter((a) => a.action !== "none") ?? [];

export function Chat() {
  const [center, setCenter] = useState<{
    name: string;
    tagline: string;
    phone: string;
  } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  // One language for the whole parent surface: auto-detected from each message,
  // also manually toggleable. Drives the UI strings and voice recognition.
  const [lang, setLang] = useState<Lang>(initialLang);
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const [requestModal, setRequestModal] = useState<{
    kind: "tour" | "message";
    relatedId?: number;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognizerRef = useRef<Recognizer | null>(null);
  const kbRef = useRef<CenterKB | null>(null); // full handbook, kept for offline answers
  const t = STRINGS[lang];

  useEffect(() => {
    function applyKb(kb: CenterKB) {
      kbRef.current = kb;
      setCenter({
        name: kb.center.name,
        tagline: kb.center.tagline,
        phone: kb.center.phone,
      });
    }
    fetchKb()
      .then(({ kb }) => {
        applyKb(kb);
        cacheKb(kb); // save for offline use on future visits
      })
      .catch(() => {
        const cached = loadCachedKb(); // first load offline: use the saved copy
        if (cached) applyKb(cached);
        else setCenter(null);
      });
  }, []);

  // Track connectivity; flush any queued tour/message requests on reconnect.
  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      flushQueue();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    // Follow the language of the message (typed or dictated) for the whole page.
    const msgLang = detectLang(trimmed);
    setLang(msgLang);
    const userMsg: ChatMessage = { id: uid(), role: "user", text: trimmed };
    const history = messages.map((m) => ({ role: m.role, content: m.text }));
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      // Online, with an automatic on-device fallback when there's no network.
      const payload = await askWithFallback(trimmed, history, kbRef.current, msgLang);
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", text: payload.answer, payload },
      ]);
    } catch {
      const errText = isOffline()
        ? STRINGS[msgLang].offlineNoData
        : STRINGS[msgLang].sendError;
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", text: errText },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function toggleVoice() {
    if (listening) {
      recognizerRef.current?.stop();
      return;
    }
    const rec = createRecognizer(
      {
        onResult: (transcript, isFinal) => {
          setInput(transcript);
          if (isFinal) setListening(false);
        },
        onError: () => setListening(false),
        onEnd: () => setListening(false),
      },
      speechLang(lang),
    );
    if (!rec) return;
    recognizerRef.current = rec;
    setListening(true);
    rec.start();
  }

  // Clear the thread and return to the welcome screen with the starter prompts,
  // so a parent (or a reviewer) is never stuck on one question.
  function reset() {
    recognizerRef.current?.stop();
    setListening(false);
    setMessages([]);
    setInput("");
    setRequestModal(null);
  }

  return (
    <div className="flex flex-col h-full max-w-md mx-auto bg-cream">
      <header className="sticky top-0 z-10 bg-brand-700 text-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {messages.length > 0 && (
              <button
                onClick={reset}
                aria-label={t.startOver}
                className="shrink-0 -ml-1 flex items-center gap-1 text-xs bg-brand-600 hover:bg-brand-500 rounded-full pl-1.5 pr-2.5 py-1.5 transition"
              >
                <BackIcon />
                {t.startOver}
              </button>
            )}
            <div className="min-w-0">
              <h1 className="font-semibold leading-tight truncate">
                {center?.name ?? "Cottonwood Sprouts"}
              </h1>
              <p className="text-[11px] text-brand-100 leading-tight">
                {t.subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/operator"
              className="text-[11px] text-brand-100/90 hover:text-white underline underline-offset-2"
            >
              {t.operatorView}
            </a>
            {center?.phone && (
              <a
                href={telHref(center.phone)}
                className="text-xs bg-brand-600 hover:bg-brand-500 rounded-full px-3 py-1.5 transition"
              >
                {t.callUs}
              </a>
            )}
          </div>
        </div>
      </header>

      {!online && (
        <div className="bg-amber/15 text-amber text-[11px] text-center py-1 border-b border-amber/30">
          {t.offlineBanner}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.length === 0 && (
          <Welcome lang={lang} tagline={center?.tagline} onPick={send} />
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <UserBubble key={m.id} text={m.text} />
          ) : (
            <AssistantBubble
              key={m.id}
              lang={lang}
              text={m.text}
              payload={m.payload}
              onAction={(a, relatedId) => handleAction(a, relatedId)}
            />
          ),
        )}
        {loading && <Typing />}
      </div>

      <Composer
        lang={lang}
        input={input}
        setInput={setInput}
        onSend={() => send(input)}
        listening={listening}
        onToggleVoice={toggleVoice}
        voiceSupported={isVoiceInputSupported()}
        onToggleLang={() => setLang((l) => (l === "es" ? "en" : "es"))}
        disabled={loading}
      />

      {requestModal && (
        <RequestSheet
          lang={lang}
          kind={requestModal.kind}
          relatedId={requestModal.relatedId}
          phone={center?.phone}
          onClose={() => setRequestModal(null)}
        />
      )}
    </div>
  );

  function handleAction(a: SuggestedAction, relatedId?: number) {
    if (a.action === "call" && a.value) {
      window.location.href = telHref(a.value);
    } else if (a.action === "schedule_tour") {
      setRequestModal({ kind: "tour", relatedId });
    } else if (a.action === "message_front_desk") {
      setRequestModal({ kind: "message", relatedId });
    }
  }
}

function Welcome({
  lang,
  tagline,
  onPick,
}: {
  lang: Lang;
  tagline?: string;
  onPick: (q: string) => void;
}) {
  const s = STRINGS[lang];
  const greeting = lang === "en" ? (tagline ?? s.taglineFallback) : s.taglineFallback;
  return (
    <div className="text-center pt-6">
      <div className="mx-auto w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-display text-xl">
        CS
      </div>
      <p className="mt-3 text-sm text-ink/70 px-6">{greeting}</p>
      <p className="mt-1 text-xs text-ink/50">{s.welcomeHint}</p>
      <div className="mt-5 flex flex-col gap-2 px-2">
        {STARTERS[lang].map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="text-left text-sm bg-white border border-brand-100 hover:border-brand-300 rounded-2xl px-4 py-2.5 shadow-sm transition"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="bg-brand-600 text-white rounded-2xl rounded-br-md px-3.5 py-2 max-w-[82%] text-sm shadow-sm">
        {text}
      </div>
    </div>
  );
}

function AssistantBubble({
  lang,
  text,
  payload,
  onAction,
}: {
  lang: Lang;
  text: string;
  payload?: AnswerPayload;
  onAction: (a: SuggestedAction, relatedId?: number) => void;
}) {
  const s = STRINGS[lang];
  const escalate = payload?.needs_human || payload?.safety_intercept;
  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] space-y-2">
        <div className="bg-white border border-brand-100 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm shadow-sm whitespace-pre-line">
          {text}
        </div>

        {payload && <TrustRow lang={lang} payload={payload} />}

        {payload?.offline && (
          <span className="inline-block text-[10px] bg-ink/10 text-ink/60 rounded-full px-2 py-0.5">
            {s.offlineTag}
          </span>
        )}

        {payload?.citations && payload.citations.length > 0 && (
          <div className="space-y-1.5">
            {payload.citations.map((c, i) =>
              c.quote ? (
                // Show the actual handbook text, not just the section name, so a
                // grounded or escalated answer visibly delivers the source it cites.
                <div
                  key={i}
                  className="border-l-2 border-brand-300 bg-brand-50 rounded-r-lg px-3 py-2"
                >
                  <p className="text-[12px] italic leading-snug text-ink/75">{c.quote}</p>
                  <p className="mt-1 text-[11px] font-medium text-brand-700">
                    {s.source}: {c.section}
                  </p>
                </div>
              ) : (
                <span
                  key={i}
                  className="inline-block text-[11px] bg-brand-50 text-brand-700 border border-brand-100 rounded-full px-2 py-0.5"
                >
                  {s.source}: {c.section}
                </span>
              ),
            )}
          </div>
        )}

        {escalate && payload && (
          <EscalationCard lang={lang} payload={payload} onAction={onAction} />
        )}

        {!escalate &&
          actionable(payload?.suggested_actions).map((a, i) => (
            <button
              key={i}
              onClick={() => onAction(a, payload?.question_id)}
              className="text-xs bg-amber/10 text-amber border border-amber/30 hover:bg-amber/20 rounded-full px-3 py-1 transition mr-1.5"
            >
              {a.label}
            </button>
          ))}
      </div>
    </div>
  );
}

function TrustRow({ lang, payload }: { lang: Lang; payload: AnswerPayload }) {
  const dot = { high: "bg-brand-500", medium: "bg-amber", low: "bg-ink/30" } as const;
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-ink/55 pl-1">
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot[payload.confidence]}`} />
      {STRINGS[lang].trust[payload.confidence]}
    </div>
  );
}

function EscalationCard({
  lang,
  payload,
  onAction,
}: {
  lang: Lang;
  payload: AnswerPayload;
  onAction: (a: SuggestedAction, relatedId?: number) => void;
}) {
  return (
    <div className="bg-amber/5 border border-amber/30 rounded-2xl px-3.5 py-3 space-y-2">
      <p className="text-xs font-medium text-amber">{STRINGS[lang].escalateTitle}</p>
      <div className="flex flex-wrap gap-1.5">
        {actionable(payload.suggested_actions).map((a, i) => (
          <button
            key={i}
            onClick={() => onAction(a, payload.question_id)}
            className="text-xs bg-brand-600 text-white hover:bg-brand-500 rounded-full px-3 py-1.5 transition"
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex justify-start">
      <div className="bg-white border border-brand-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
        <span className="dot-pulse flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-ink/40" />
          <span className="w-1.5 h-1.5 rounded-full bg-ink/40" />
          <span className="w-1.5 h-1.5 rounded-full bg-ink/40" />
        </span>
      </div>
    </div>
  );
}

function Composer({
  lang,
  input,
  setInput,
  onSend,
  listening,
  onToggleVoice,
  voiceSupported,
  onToggleLang,
  disabled,
}: {
  lang: Lang;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  listening: boolean;
  onToggleVoice: () => void;
  voiceSupported: boolean;
  onToggleLang: () => void;
  disabled: boolean;
}) {
  const s = STRINGS[lang];
  return (
    <div className="sticky bottom-0 bg-cream border-t border-brand-100 px-3 py-2.5">
      <div className="flex items-end gap-2">
        <button
          onClick={onToggleLang}
          aria-label="Language"
          title={s.langTitle}
          className="shrink-0 w-9 h-10 rounded-full border border-brand-200 bg-white text-brand-700 text-[11px] font-semibold hover:border-brand-400 transition"
        >
          {lang.toUpperCase()}
        </button>
        {voiceSupported && (
          <button
            onClick={onToggleVoice}
            aria-label="Voice input"
            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center border transition ${
              listening
                ? "bg-amber text-white border-amber animate-pulse"
                : "bg-white text-brand-700 border-brand-200 hover:border-brand-400"
            }`}
          >
            <MicIcon />
          </button>
        )}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={1}
          placeholder={listening ? s.listening : s.placeholder}
          className="flex-1 resize-none bg-white border border-brand-200 focus:border-brand-400 outline-none rounded-2xl px-3.5 py-2.5 text-sm max-h-28"
        />
        <button
          onClick={onSend}
          disabled={disabled || !input.trim()}
          className="shrink-0 w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center disabled:opacity-40 hover:bg-brand-500 transition"
          aria-label={s.send}
        >
          <SendIcon />
        </button>
      </div>
      <p className="text-[10px] text-ink/40 text-center mt-1.5">{s.demoNote}</p>
    </div>
  );
}

function RequestSheet({
  lang,
  kind,
  relatedId,
  phone,
  onClose,
}: {
  lang: Lang;
  kind: "tour" | "message";
  relatedId?: number;
  phone?: string;
  onClose: () => void;
}) {
  const s = STRINGS[lang];
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [queued, setQueued] = useState(false);

  async function submit() {
    setBusy(true);
    setFailed(false);
    const payload = {
      kind,
      name,
      contact,
      message: message || (kind === "tour" ? s.reqDefaultTour : s.reqDefaultMsg),
      related_question_id: relatedId ?? null,
    };
    // Offline: save it now and send automatically on reconnect.
    if (isOffline()) {
      queueRequest(payload);
      setQueued(true);
      setSent(true);
      setBusy(false);
      return;
    }
    try {
      const res = await leaveRequest(payload);
      if (res && res.ok) setSent(true);
      else setFailed(true);
    } catch {
      // Network dropped mid-send: queue it rather than lose it.
      queueRequest(payload);
      setQueued(true);
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-20 bg-ink/40 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-cream w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="text-center py-4 space-y-2">
            <p className="font-semibold text-brand-700">{s.thankYou}</p>
            <p className="text-sm text-ink/70">
              {queued ? s.queuedBody(kind) : s.thankBody(kind, phone)}
            </p>
            <button
              onClick={onClose}
              className="mt-2 text-sm bg-brand-600 text-white rounded-full px-4 py-2"
            >
              {s.done}
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-semibold text-ink">
              {kind === "tour" ? s.tourTitle : s.msgTitle}
            </h2>
            <p className="text-xs text-ink/60">{s.sheetIntro}</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={s.namePh}
              className="w-full bg-white border border-brand-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={s.contactPh}
              className="w-full bg-white border border-brand-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={kind === "tour" ? s.tourMsgPh : s.msgMsgPh}
              rows={3}
              className="w-full bg-white border border-brand-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-400 resize-none"
            />
            {failed && <p className="text-xs text-amber">{s.failed(phone)}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 text-sm border border-brand-200 rounded-full py-2"
              >
                {s.cancel}
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className="flex-1 text-sm bg-brand-600 text-white rounded-full py-2 disabled:opacity-50"
              >
                {busy ? s.sending : s.send}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
