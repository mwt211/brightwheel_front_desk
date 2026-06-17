import { useEffect, useRef, useState } from "react";
import type { AnswerPayload, ChatMessage, SuggestedAction } from "../lib/types";
import { askQuestion, fetchKb, leaveRequest } from "../lib/api";
import { createRecognizer, isVoiceInputSupported, type Recognizer } from "./voice";

const STARTERS = [
  "Are you open on Veterans Day?",
  "What's the tuition for infants?",
  "My child has a fever, can they come in?",
  "I forgot to pack lunch. What's for lunch today?",
  "How do I schedule a tour?",
];

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
  const [requestModal, setRequestModal] = useState<{
    kind: "tour" | "message";
    relatedId?: number;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognizerRef = useRef<Recognizer | null>(null);

  useEffect(() => {
    fetchKb()
      .then(({ kb }) =>
        setCenter({
          name: kb.center.name,
          tagline: kb.center.tagline,
          phone: kb.center.phone,
        }),
      )
      .catch(() => setCenter(null));
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
    const userMsg: ChatMessage = { id: uid(), role: "user", text: trimmed };
    const history = messages.map((m) => ({ role: m.role, content: m.text }));
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const payload = await askQuestion(trimmed, history);
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", text: payload.answer, payload },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          text: "Sorry, something went wrong reaching the front desk. Please try again, or call us.",
        },
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
    const rec = createRecognizer({
      onResult: (transcript, isFinal) => {
        setInput(transcript);
        if (isFinal) setListening(false);
      },
      onError: () => setListening(false),
      onEnd: () => setListening(false),
    });
    if (!rec) return;
    recognizerRef.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <div className="flex flex-col h-full max-w-md mx-auto bg-cream">
      <header className="sticky top-0 z-10 bg-brand-700 text-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-semibold leading-tight">
              {center?.name ?? "Cottonwood Sprouts"}
            </h1>
            <p className="text-[11px] text-brand-100 leading-tight">
              Front Desk Assistant
            </p>
          </div>
          {center?.phone && (
            <a
              href={telHref(center.phone)}
              className="text-xs bg-brand-600 hover:bg-brand-500 rounded-full px-3 py-1.5 transition"
            >
              Call us
            </a>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.length === 0 && (
          <Welcome tagline={center?.tagline} onPick={send} />
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <UserBubble key={m.id} text={m.text} />
          ) : (
            <AssistantBubble
              key={m.id}
              text={m.text}
              payload={m.payload}
              onAction={(a, relatedId) => handleAction(a, relatedId)}
            />
          ),
        )}
        {loading && <Typing />}
      </div>

      <Composer
        input={input}
        setInput={setInput}
        onSend={() => send(input)}
        listening={listening}
        onToggleVoice={toggleVoice}
        voiceSupported={isVoiceInputSupported()}
        disabled={loading}
      />

      {requestModal && (
        <RequestSheet
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
  tagline,
  onPick,
}: {
  tagline?: string;
  onPick: (q: string) => void;
}) {
  return (
    <div className="text-center pt-6">
      <div className="mx-auto w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-display text-xl">
        CS
      </div>
      <p className="mt-3 text-sm text-ink/70 px-6">
        {tagline ?? "Ask us anything about the center."}
      </p>
      <p className="mt-1 text-xs text-ink/50">
        Hours, tuition, illness policy, lunch, tours, and more.
      </p>
      <div className="mt-5 flex flex-col gap-2 px-2">
        {STARTERS.map((q) => (
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
  text,
  payload,
  onAction,
}: {
  text: string;
  payload?: AnswerPayload;
  onAction: (a: SuggestedAction, relatedId?: number) => void;
}) {
  const escalate = payload?.needs_human || payload?.safety_intercept;
  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] space-y-2">
        <div className="bg-white border border-brand-100 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm shadow-sm whitespace-pre-line">
          {text}
        </div>

        {payload && <TrustRow payload={payload} />}

        {payload?.citations && payload.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {payload.citations.map((c, i) => (
              <span
                key={i}
                title={c.quote}
                className="text-[11px] bg-brand-50 text-brand-700 border border-brand-100 rounded-full px-2 py-0.5"
              >
                Source: {c.section}
              </span>
            ))}
          </div>
        )}

        {escalate && payload && (
          <EscalationCard payload={payload} onAction={onAction} />
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

function TrustRow({ payload }: { payload: AnswerPayload }) {
  const map = {
    high: { dot: "bg-brand-500", label: "From our handbook" },
    medium: { dot: "bg-amber", label: "Partly covered; please confirm" },
    low: { dot: "bg-ink/30", label: "Not in our handbook" },
  } as const;
  const c = map[payload.confidence];
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-ink/55 pl-1">
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </div>
  );
}

function EscalationCard({
  payload,
  onAction,
}: {
  payload: AnswerPayload;
  onAction: (a: SuggestedAction, relatedId?: number) => void;
}) {
  return (
    <div className="bg-amber/5 border border-amber/30 rounded-2xl px-3.5 py-3 space-y-2">
      <p className="text-xs font-medium text-amber">
        A team member should help with this.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {actionable(payload.suggested_actions).map((a, i) => (
          <button
            key={i}
            onClick={() => onAction(a, payload.question_id)}
            className="text-xs bg-brand-600 text-white hover:bg-brand-500 rounded-full px-3 py-1.5 transition"
          >
            {a.label}
            </button>
          ),
        )}
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
  input,
  setInput,
  onSend,
  listening,
  onToggleVoice,
  voiceSupported,
  disabled,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  listening: boolean;
  onToggleVoice: () => void;
  voiceSupported: boolean;
  disabled: boolean;
}) {
  return (
    <div className="sticky bottom-0 bg-cream border-t border-brand-100 px-3 py-2.5">
      <div className="flex items-end gap-2">
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
          placeholder={listening ? "Listening..." : "Ask the front desk..."}
          className="flex-1 resize-none bg-white border border-brand-200 focus:border-brand-400 outline-none rounded-2xl px-3.5 py-2.5 text-sm max-h-28"
        />
        <button
          onClick={onSend}
          disabled={disabled || !input.trim()}
          className="shrink-0 w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center disabled:opacity-40 hover:bg-brand-500 transition"
          aria-label="Send"
        >
          <SendIcon />
        </button>
      </div>
      <p className="text-[10px] text-ink/40 text-center mt-1.5">
        Demo assistant for a fictional center. Not real medical or personal advice.
      </p>
    </div>
  );
}

function RequestSheet({
  kind,
  relatedId,
  phone,
  onClose,
}: {
  kind: "tour" | "message";
  relatedId?: number;
  phone?: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await leaveRequest({
        kind,
        name,
        contact,
        message:
          message ||
          (kind === "tour" ? "Requested a tour." : "Asked for a callback."),
        related_question_id: relatedId ?? null,
      });
      // Only confirm if the server actually accepted it.
      if (res && res.ok) setSent(true);
      else setFailed(true);
    } catch {
      setFailed(true);
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
            <p className="font-semibold text-brand-700">Thank you.</p>
            <p className="text-sm text-ink/70">
              The front desk has your {kind === "tour" ? "tour request" : "message"} and
              will follow up. {phone ? `For anything urgent, call ${phone}.` : ""}
            </p>
            <button
              onClick={onClose}
              className="mt-2 text-sm bg-brand-600 text-white rounded-full px-4 py-2"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-semibold text-ink">
              {kind === "tour" ? "Request a tour" : "Message the front desk"}
            </h2>
            <p className="text-xs text-ink/60">
              Leave your details and the team will get back to you. (Demo, no real
              data.)
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-white border border-brand-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Phone or email"
              className="w-full bg-white border border-brand-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                kind === "tour"
                  ? "Anything we should know? (optional)"
                  : "Your message"
              }
              rows={3}
              className="w-full bg-white border border-brand-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-400 resize-none"
            />
            {failed && (
              <p className="text-xs text-amber">
                That didn't go through. Please try again
                {phone ? `, or call ${phone}` : ""}.
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 text-sm border border-brand-200 rounded-full py-2"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className="flex-1 text-sm bg-brand-600 text-white rounded-full py-2 disabled:opacity-50"
              >
                {busy ? "Sending..." : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
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
