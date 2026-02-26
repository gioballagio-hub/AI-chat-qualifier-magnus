import type { LeadType, LeadSummary, ContactInfo } from "./lead";

export type QuestionType = "select" | "freetext" | "textarea" | "ai_zone";

export interface SelectOption {
  label: string;
  value: string;
}

export interface ChatStep {
  id: string;
  question: string;
  type: QuestionType;
  options?: SelectOption[];
  required: boolean;
  placeholder?: string;
}

export type ChatPhase =
  | "IDLE"
  | "TYPE_SELECTION"
  | "QUESTIONS"
  | "AI_CONFIRM"
  | "CONTACT_INFO"
  | "CONSENT"
  | "SUBMITTING"
  | "SUMMARY"
  | "ERROR";

export interface ChatMessage {
  id: string;
  role: "agent" | "user";
  content: string;
  timestamp: number;
}

export interface ZoneExtractResult {
  zona: string;
  confidence: "high" | "low";
  raw: string;
}

export interface ChatState {
  phase: ChatPhase;
  leadType: LeadType | null;
  currentStepIndex: number;
  answers: Record<string, string>;
  messages: ChatMessage[];
  pendingZoneExtract: ZoneExtractResult | null;
  contactInfo: ContactInfo | null;
  consentGiven: boolean;
  summary: LeadSummary | null;
  error: string | null;
}
