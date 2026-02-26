"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { ChatState, ChatMessage, ZoneExtractResult } from "@/types/chat";
import type { LeadType, LeadSummary, ContactInfo } from "@/types/lead";
import { BUYER_STEPS, SELLER_STEPS } from "@/constants/questions";
import ChatBubble from "./ChatBubble";
import QuestionStep from "./QuestionStep";
import ZoneConfirm from "./ZoneConfirm";
import LeadSummaryComponent from "./LeadSummary";
import ContactForm from "./ContactForm";
import Button from "@/components/ui/Button";

function makeId() {
  return Math.random().toString(36).slice(2);
}

function agentMsg(content: string): ChatMessage {
  return { id: makeId(), role: "agent", content, timestamp: Date.now() };
}

function userMsg(content: string): ChatMessage {
  return { id: makeId(), role: "user", content, timestamp: Date.now() };
}

const WELCOME =
  "Ciao! Sono l'assistente dell'agenzia. Ti aiuto a qualificare la tua richiesta in pochi passi.";

const CONTACT_INFO_MSG =
  "Ottimo! Quasi finito. Per inviarti il riepilogo via email ho bisogno di alcuni dati di contatto.";

const CONSENT_MSG =
  "Perfetto! Prima di inviare la tua richiesta, ho bisogno del tuo consenso al trattamento dei dati inseriti.";

interface Props {
  initialType?: LeadType;
}

export default function ChatContainer({ initialType }: Props) {
  const initialMessages = useMemo(() => {
    const msgs: ChatMessage[] = [agentMsg(WELCOME)];
    if (initialType) {
      const steps = initialType === "BUYER" ? BUYER_STEPS : SELLER_STEPS;
      if (steps[0]) msgs.push(agentMsg(steps[0].question));
    }
    return msgs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [state, setState] = useState<ChatState>({
    phase: initialType ? "QUESTIONS" : "TYPE_SELECTION",
    leadType: initialType ?? null,
    currentStepIndex: 0,
    answers: {},
    messages: initialMessages,
    pendingZoneExtract: null,
    contactInfo: null,
    consentGiven: false,
    summary: null,
    error: null,
  });

  // --- Typing animation ---
  const [displayed, setDisplayed] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const processedCount = useRef(0);
  const isTypingRef = useRef(false);

  useEffect(() => {
    const all = state.messages;
    if (processedCount.current >= all.length || isTypingRef.current) return;

    const next = all[processedCount.current]!;

    if (next.role === "user") {
      // User messages appear immediately
      processedCount.current++;
      setDisplayed((d) => [...d, next]);
      return;
    }

    // Agent messages: show typing indicator first
    // NOTE: usiamo isTypingRef (non state) così setIsTyping(true) non causa
    // un re-render che cancella il timer tramite la cleanup function
    isTypingRef.current = true;
    setIsTyping(true);
    const timer = setTimeout(() => {
      processedCount.current++;
      setDisplayed((d) => [...d, next]);
      isTypingRef.current = false;
      setIsTyping(false);
    }, 3000);

    return () => {
      clearTimeout(timer);
      isTypingRef.current = false;
    };
  // displayed.length (non isTyping) come dep: il re-render da setIsTyping
  // non cambia displayed.length quindi non scatta il cleanup che annullerebbe il timer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.messages.length, displayed.length]);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayed, isTyping, state.phase]);

  // --- Handlers ---

  const selectType = useCallback((type: LeadType) => {
    const label = type === "BUYER" ? "Voglio comprare" : "Voglio vendere";
    const steps = type === "BUYER" ? BUYER_STEPS : SELLER_STEPS;
    setState((s) => ({
      ...s,
      leadType: type,
      phase: "QUESTIONS",
      currentStepIndex: 0,
      messages: [
        ...s.messages,
        userMsg(label),
        agentMsg(steps[0]!.question),
      ],
    }));
  }, []);

  const advanceStep = useCallback(
    (value: string, msgs?: ChatMessage[], fieldId?: string) => {
      setState((s) => {
        if (!s.leadType) return s;
        const steps = s.leadType === "BUYER" ? BUYER_STEPS : SELLER_STEPS;
        const step = steps[s.currentStepIndex];
        const id = fieldId ?? step?.id ?? "";
        const newAnswers = { ...s.answers, [id]: value };
        const messages = msgs ?? s.messages;
        const nextIndex = s.currentStepIndex + 1;

        if (nextIndex < steps.length) {
          return {
            ...s,
            answers: newAnswers,
            currentStepIndex: nextIndex,
            messages: [...messages, agentMsg(steps[nextIndex]!.question)],
          };
        }

        // All questions done → ask for contact info
        return {
          ...s,
          answers: newAnswers,
          phase: "CONTACT_INFO",
          messages: [...messages, agentMsg(CONTACT_INFO_MSG)],
        };
      });
    },
    []
  );

  const handleAnswer = useCallback(
    async (value: string) => {
      if (!state.leadType) return;
      const steps = state.leadType === "BUYER" ? BUYER_STEPS : SELLER_STEPS;
      const step = steps[state.currentStepIndex];
      if (!step) return;

      const displayValue =
        (step.options?.find((o) => o.value === value)?.label ?? value) || "(saltato)";
      const newMessages: ChatMessage[] = [...state.messages, userMsg(displayValue)];

      if (step.type === "ai_zone" && value.trim()) {
        setState((s) => ({ ...s, messages: newMessages }));
        setAiLoading(true);
        try {
          const res = await fetch("/api/ai/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: value }),
          });
          const result: ZoneExtractResult = await res.json();
          setState((s) => ({
            ...s,
            pendingZoneExtract: result,
            phase: "AI_CONFIRM",
          }));
        } catch {
          advanceStep(value, newMessages, step.id);
        } finally {
          setAiLoading(false);
        }
        return;
      }

      advanceStep(value, newMessages, step.id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state]
  );

  const handleZoneConfirm = useCallback(
    (zona: string) => {
      setState((s) => {
        if (!s.leadType || !s.pendingZoneExtract) return s;
        const steps = s.leadType === "BUYER" ? BUYER_STEPS : SELLER_STEPS;
        const newAnswers = { ...s.answers, zona, zonaRaw: s.pendingZoneExtract.raw };
        const nextIndex = s.currentStepIndex + 1;
        const messages = [...s.messages, agentMsg(`Zona confermata: ${zona}`)];

        if (nextIndex < steps.length) {
          return {
            ...s,
            answers: newAnswers,
            pendingZoneExtract: null,
            phase: "QUESTIONS",
            currentStepIndex: nextIndex,
            messages: [...messages, agentMsg(steps[nextIndex]!.question)],
          };
        }

        return {
          ...s,
          answers: newAnswers,
          pendingZoneExtract: null,
          phase: "CONTACT_INFO",
          messages: [...messages, agentMsg(CONTACT_INFO_MSG)],
        };
      });
    },
    []
  );

  const handleZoneRetry = useCallback(() => {
    setState((s) => {
      if (!s.leadType) return s;
      const steps = s.leadType === "BUYER" ? BUYER_STEPS : SELLER_STEPS;
      const step = steps[s.currentStepIndex];
      return {
        ...s,
        phase: "QUESTIONS",
        pendingZoneExtract: null,
        messages: [
          ...s.messages,
          agentMsg("Nessun problema! " + (step?.question ?? "Riprova:")),
        ],
      };
    });
  }, []);

  const handleContactInfo = useCallback((info: ContactInfo) => {
    setState((s) => ({
      ...s,
      contactInfo: info,
      phase: "CONSENT",
      messages: [...s.messages, agentMsg(CONSENT_MSG)],
    }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!state.leadType || !state.consentGiven || !state.contactInfo) return;
    setState((s) => ({ ...s, phase: "SUBMITTING" }));

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: state.leadType,
          data: state.answers,
          contactInfo: state.contactInfo,
          consentGiven: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Errore server");
      }

      const summary: LeadSummary = await res.json();
      setState((s) => ({ ...s, phase: "SUMMARY", summary }));
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: "ERROR",
        error:
          err instanceof Error ? err.message : "Errore durante l'invio. Riprova.",
      }));
    }
  }, [state]);

  const steps = state.leadType
    ? state.leadType === "BUYER"
      ? BUYER_STEPS
      : SELLER_STEPS
    : [];
  const totalSteps = steps.length;
  const progress =
    totalSteps > 0 ? Math.round(((state.currentStepIndex + 1) / totalSteps) * 100) : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Progress bar */}
      {state.phase === "QUESTIONS" && totalSteps > 0 && (
        <div className="px-4 pt-3">
          <div className="mb-1 flex justify-between text-xs text-gray-400">
            <span>
              Domanda {state.currentStepIndex + 1} di {totalSteps}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {displayed.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}

        {/* Typing indicator */}
        {(isTyping || aiLoading) && (
          <div className="mb-3 flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-3">
              <span className="flex gap-1">
                <span className="animate-bounce text-gray-400" style={{ animationDelay: "0ms" }}>
                  •
                </span>
                <span className="animate-bounce text-gray-400" style={{ animationDelay: "150ms" }}>
                  •
                </span>
                <span className="animate-bounce text-gray-400" style={{ animationDelay: "300ms" }}>
                  •
                </span>
              </span>
            </div>
          </div>
        )}

        {/* Summary */}
        {state.phase === "SUMMARY" && state.summary && (
          <LeadSummaryComponent
            summary={state.summary}
            customerEmail={state.contactInfo?.email}
          />
        )}

        {/* Error */}
        {state.phase === "ERROR" && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="font-medium">Si è verificato un errore</p>
            <p>{state.error}</p>
            <Button
              className="mt-2"
              variant="danger"
              size="sm"
              onClick={() =>
                setState((s) => ({ ...s, phase: "CONSENT", error: null }))
              }
            >
              Riprova
            </Button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-100 bg-white">
        {state.phase === "TYPE_SELECTION" && (
          <div className="flex gap-3 px-4 py-4">
            <button
              onClick={() => selectType("BUYER")}
              className="flex-1 cursor-pointer rounded-xl border-2 border-blue-200 bg-blue-50 py-4 text-center text-sm font-medium text-blue-700 transition-colors hover:border-blue-400 hover:bg-blue-100"
            >
              🏠 Voglio Comprare
            </button>
            <button
              onClick={() => selectType("SELLER")}
              className="flex-1 cursor-pointer rounded-xl border-2 border-green-200 bg-green-50 py-4 text-center text-sm font-medium text-green-700 transition-colors hover:border-green-400 hover:bg-green-100"
            >
              💰 Voglio Vendere
            </button>
          </div>
        )}

        {state.phase === "QUESTIONS" && !isTyping && displayed.length >= state.messages.length && (
          <QuestionStep
            key={steps[state.currentStepIndex]?.id}
            step={steps[state.currentStepIndex]!}
            onAnswer={handleAnswer}
            disabled={aiLoading}
          />
        )}

        {state.phase === "AI_CONFIRM" && state.pendingZoneExtract && (
          <ZoneConfirm
            result={state.pendingZoneExtract}
            onConfirm={handleZoneConfirm}
            onRetry={handleZoneRetry}
          />
        )}

        {state.phase === "CONTACT_INFO" && (
          <ContactForm onSubmit={handleContactInfo} />
        )}

        {state.phase === "CONSENT" && (
          <div className="space-y-3 px-4 py-4">
            <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600"
                checked={state.consentGiven}
                onChange={(e) =>
                  setState((s) => ({ ...s, consentGiven: e.target.checked }))
                }
              />
              <span>
                Acconsento al trattamento dei dati forniti per ricevere informazioni
                dall&apos;agenzia, ai sensi del{" "}
                <abbr title="Regolamento Generale sulla Protezione dei Dati">GDPR</abbr>.
              </span>
            </label>
            <Button
              onClick={handleSubmit}
              disabled={!state.consentGiven}
              className="w-full"
              size="lg"
            >
              Invia la mia richiesta →
            </Button>
          </div>
        )}

        {state.phase === "SUBMITTING" && (
          <div className="px-4 py-4">
            <Button loading disabled className="w-full" size="lg">
              Invio in corso…
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
