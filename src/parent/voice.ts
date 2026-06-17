/* Thin wrapper around the browser Web Speech API (ported from the Sally app).
   Feature-detected, so the chat degrades to plain typing when unsupported. */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

export type Recognizer = { start: () => void; stop: () => void };

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (
    (w.SpeechRecognition as new () => SpeechRecognitionLike) ??
    (w.webkitSpeechRecognition as new () => SpeechRecognitionLike) ??
    null
  );
}

export function isVoiceInputSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function createRecognizer(
  handlers: {
    onResult: (transcript: string, isFinal: boolean) => void;
    onError?: (message: string) => void;
    onEnd?: () => void;
  },
  lang = "en-US",
): Recognizer | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  // The Web Speech API recognizes one language per session, so the caller picks
  // it (English or Spanish here) rather than us hardcoding English.
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onresult = (event: any) => {
    let transcript = "";
    let isFinal = false;
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript;
      if (event.results[i].isFinal) isFinal = true;
    }
    handlers.onResult(transcript, isFinal);
  };
  recognition.onerror = (event: any) =>
    handlers.onError?.(String(event?.error ?? "voice error"));
  recognition.onend = () => handlers.onEnd?.();

  return {
    start: () => {
      try {
        recognition.start();
      } catch {
        /* start() throws if already running; safe to ignore */
      }
    },
    stop: () => recognition.stop(),
  };
}
