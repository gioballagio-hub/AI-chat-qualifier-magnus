import type { ClienteType, LeadSummary, ContactInfo } from "./lead";

export type QuestionType = "select" | "freetext" | "textarea";

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
  | "PRIVATE_WARNING"
  | "QUESTIONS"
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

export interface ChatState {
  phase: ChatPhase;
  clienteType: ClienteType | null;
  currentStepIndex: number;
  answers: Record<string, string>;
  messages: ChatMessage[];
  contactInfo: ContactInfo | null;
  consentGiven: boolean;
  summary: LeadSummary | null;
  error: string | null;
}
