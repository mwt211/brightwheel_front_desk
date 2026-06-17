// Shared shapes between the parent chat, the operator console, and the API.

export type Confidence = "high" | "medium" | "low";

export type Category =
  | "hours_calendar"
  | "tuition_fees"
  | "illness_health"
  | "food_menu"
  | "tours_enrollment"
  | "pickup_dropoff"
  | "other";

export type QuestionStatus = "answered" | "escalated" | "unanswered";

export type Citation = { section: string; quote: string };

export type ActionKind =
  | "schedule_tour"
  | "message_front_desk"
  | "call"
  | "none";

export type SuggestedAction = {
  label: string;
  action: ActionKind;
  value?: string;
};

/** The structured object the model is forced to return, plus server metadata. */
export type AnswerPayload = {
  answer: string;
  confidence: Confidence;
  citations: Citation[];
  category: Category;
  needs_human: boolean;
  escalation_reason: string | null;
  suggested_actions: SuggestedAction[];
  /** True when the deterministic pre-screen handled it before the model. */
  safety_intercept?: boolean;
  /** Server-assigned id of the logged question, for follow-up actions. */
  question_id?: number;
  /** True when answered on-device from the cached handbook (no network). */
  offline?: boolean;
};

export type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; payload?: AnswerPayload };

// ---- Knowledge base ----

export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
};

export type CenterKB = {
  center: {
    name: string;
    tagline: string;
    city: string;
    phone: string;
    email: string;
    director: string;
    ages: string;
    hours: string;
  };
  /** Free-form, operator-editable handbook sections keyed by stable title. */
  sections: { title: string; body: string }[];
  /** Day-of-week lunch menu so "what's lunch today?" resolves. */
  lunchMenu: Record<string, string>;
  /** Calendar of explicit open/closed dates the bot must respect. */
  calendar: { date: string; label: string; status: "open" | "closed" }[];
  faqs: FaqEntry[];
};

// ---- Operator data ----

export type QuestionLogEntry = {
  id: number;
  created_at: string;
  text: string;
  answer: string;
  confidence: Confidence;
  category: Category;
  status: QuestionStatus;
  needs_human: boolean;
  escalation_reason: string | null;
  citations: Citation[];
};

export type RequestEntry = {
  id: number;
  created_at: string;
  kind: "tour" | "message";
  name: string;
  contact: string;
  message: string;
  related_question_id: number | null;
  urgent: boolean;
};

export type GapCluster = {
  theme: string;
  category: Category;
  exampleQuestions: string[];
  count: number;
  reviewOnly: boolean;
  draftSection: { title: string; body: string };
};
