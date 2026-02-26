"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { ChatState, ChatMessage } from "@/types/chat";
import type { ClienteType, LeadSummary, ContactInfo } from "@/types/lead";
import { AZIENDA_STEPS, PRIVATO_STEPS } from "@/constants/questions";
import { extractFromText } from "@/lib/extractFromText";
import ChatBubble from "./ChatBubble";
import QuestionStep from "./QuestionStep";
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
  "Ciao! Sono l'assistente di Magnus SRL. Ti aiuto a inviare la tua richiesta di ricambi, accessori o lubrificanti in pochi passi.";

const TYPE_SELECTION_MSG =
  "Prima di iniziare: stai facendo questa richiesta come privato o come azienda?";

const PRIVATE_WARNING = `Gentile cliente, Magnus SRL serve esclusivamente aziende. In quanto privato, ti informiamo che la gestione della tua richiesta non è garantita.

Per aumentare le probabilità di essere seguito, ti invitiamo a compilare il form nel modo più dettagliato possibile: maggiore sarà la precisione della tua richiesta, maggiori saranno le possibilità di ricevere assistenza.

Ti ricordiamo inoltre che, per motivi di gestione operativa, non è possibile evadere ordini inferiori a €300. Se il tuo ordine attuale non raggiunge questa soglia, valuta l'acquisto di un tagliando o di accessori utili per raggiungere il valore minimo.

Puoi comunque procedere compilando la richiesta qui sotto.`;

const CONTACT_INFO_MSG =
  "Ottimo! Quasi finito. Per poter gestire la tua richiesta ho bisogno di alcuni dati di contatto.";

const CONSENT_MSG =
  "Perfetto! Prima di inviare la tua richiesta, ho bisogno del tuo consenso al trattamento dei dati inseriti ai sensi del GDPR.";

// Campi che possono essere estratti automaticamente dalla descrizione
const EXTRACTABLE_FIELDS = ["categoriaProdotto", "brandProdotto", "codiceProdotto", "vinCode"] as const;

// Etichette leggibili per i campi estratti
const EXTRACT_LABELS: Record<string, string> = {
  categoriaProdotto: "Categoria",
  brandProdotto: "Brand",
  codiceProdotto: "Codice prodotto",
  vinCode: "Numero di telaio (VIN)",
};

export default function ChatContainer() {
  const initialMessages = useMemo(() => {
    return [agentMsg(WELCOME), agentMsg(TYPE_SELECTION_MSG)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [state, setState] = useState<ChatState>({
    phase: "TYPE_SELECTION",
    clienteType: null,
    currentStepIndex: 0,
    answers: {},
    messages: initialMessages,
    contactInfo: null,
    consentGiven: false,
    summary: null,
    error: null,
  });

  // --- Typing animation ---
  const [displayed, setDisplayed] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const processedCount = useRef(0);
  const isTypingRef = useRef(false);

  useEffect(() => {
    const all = state.messages;
    if (processedCount.current >= all.length || isTypingRef.current) return;

    const next = all[processedCount.current]!;

    if (next.role === "user") {
      processedCount.current++;
      setDisplayed((d) => [...d, next]);
      return;
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.messages.length, displayed.length]);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayed, isTyping, state.phase]);

  // --- Helpers ---
  const getSteps = (clienteType: ClienteType | null) =>
    clienteType === "AZIENDA" ? AZIENDA_STEPS : PRIVATO_STEPS;

  /**
   * Dato un set di risposte pre-compilate e uno step index di partenza,
   * avanza automaticamente saltando tutti gli step già coperti
   * e accumula messaggi di conferma per ciascuno.
   */
  const skipExtractedSteps = useCallback(
    (
      startIndex: number,
      currentAnswers: Record<string, string>,
      currentMessages: ChatMessage[],
      clienteType: ClienteType | null
    ): { index: number; answers: Record<string, string>; messages: ChatMessage[] } => {
      const steps = getSteps(clienteType);
      let idx = startIndex;
      let answers = { ...currentAnswers };
      let messages = [...currentMessages];

      while (idx < steps.length) {
        const step = steps[idx]!;
        const extracted = answers[step.id];

        // Se il campo è stato estratto automaticamente, saltalo con messaggio di conferma
        if (extracted && EXTRACTABLE_FIELDS.includes(step.id as typeof EXTRACTABLE_FIELDS[number])) {
          const label = EXTRACT_LABELS[step.id] ?? step.id;
          messages = [
            ...messages,
            agentMsg(`✅ Ho rilevato dalla tua descrizione — ${label}: **${extracted}**. Passo alla prossima domanda.`),
          ];
          idx++;
        } else {
          break;
        }
      }

      return { index: idx, answers, messages };
    },
    []
  );

  // --- Handlers ---

  const selectType = useCallback((type: ClienteType) => {
    const label = type === "AZIENDA" ? "Sono un'azienda" : "Sono un privato";
    const steps = getSteps(type);

    if (type === "PRIVATO") {
      setState((s) => ({
        ...s,
        clienteType: type,
        phase: "PRIVATE_WARNING",
        currentStepIndex: 0,
        answers: { clienteType: "PRIVATO" },
        messages: [
          ...s.messages,
          userMsg(label),
          agentMsg(PRIVATE_WARNING),
        ],
      }));
    } else {
      setState((s) => ({
        ...s,
        clienteType: type,
        phase: "QUESTIONS",
        currentStepIndex: 0,
        answers: { clienteType: "AZIENDA" },
        messages: [
          ...s.messages,
          userMsg(label),
          agentMsg(steps[0]!.question),
        ],
      }));
    }
  }, []);

  const startQuestionsAfterWarning = useCallback(() => {
    const steps = getSteps("PRIVATO");
    setState((s) => ({
      ...s,
      phase: "QUESTIONS",
      messages: [...s.messages, agentMsg(steps[0]!.question)],
    }));
  }, []);

  const advanceStep = useCallback(
    (value: string, msgs?: ChatMessage[], fieldId?: string) => {
      setState((s) => {
        const steps = getSteps(s.clienteType);
        const step = steps[s.currentStepIndex];
        const id = fieldId ?? step?.id ?? "";
        const newAnswers = { ...s.answers, [id]: value };
        const messages = msgs ?? s.messages;

        // --- Logica di skip+pre-fill dopo descrizioneProdotto ---
        if (id === "descrizioneProdotto" && value.trim().length > 0) {
          const extracted = extractFromText(value);
          const preFilledAnswers = { ...newAnswers };

          // Pre-compila i campi estratti nelle risposte
          if (extracted.categoriaProdotto) preFilledAnswers.categoriaProdotto = extracted.categoriaProdotto;
          if (extracted.brandProdotto) preFilledAnswers.brandProdotto = extracted.brandProdotto;
          if (extracted.codiceProdotto) preFilledAnswers.codiceProdotto = extracted.codiceProdotto;
          if (extracted.vinCode) preFilledAnswers.vinCode = extracted.vinCode;

          const nextIndex = s.currentStepIndex + 1;

          // Salta gli step già coperti dall'estrazione
          const { index: finalIndex, answers: finalAnswers, messages: finalMessages } =
            skipExtractedSteps(nextIndex, preFilledAnswers, messages, s.clienteType);

          if (finalIndex < steps.length) {
            return {
              ...s,
              answers: finalAnswers,
              currentStepIndex: finalIndex,
              messages: [...finalMessages, agentMsg(steps[finalIndex]!.question)],
            };
          }

          return {
            ...s,
            answers: finalAnswers,
            phase: "CONTACT_INFO",
            messages: [...finalMessages, agentMsg(CONTACT_INFO_MSG)],
          };
        }

        // --- Avanzamento normale ---
        const nextIndex = s.currentStepIndex + 1;

        if (nextIndex < steps.length) {
          return {
            ...s,
            answers: newAnswers,
            currentStepIndex: nextIndex,
            messages: [...messages, agentMsg(steps[nextIndex]!.question)],
          };
        }

        return {
          ...s,
          answers: newAnswers,
          phase: "CONTACT_INFO",
          messages: [...messages, agentMsg(CONTACT_INFO_MSG)],
        };
      });
    },
    [skipExtractedSteps]
  );

  const handleAnswer = useCallback(
    (value: string) => {
      const steps = getSteps(state.clienteType);
      const step = steps[state.currentStepIndex];
      if (!step) return;

      const displayValue =
        (step.options?.find((o) => o.value === value)?.label ?? value) || "(saltato)";
      const newMessages: ChatMessage[] = [...state.messages, userMsg(displayValue)];

      advanceStep(value, newMessages, step.id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, advanceStep]
  );

  const handleContactInfo = useCallback((info: ContactInfo) => {
    setState((s) => ({
      ...s,
      contactInfo: info,
      phase: "CONSENT",
      messages: [...s.messages, agentMsg(CONSENT_MSG)],
    }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!state.clienteType || !state.consentGiven || !state.contactInfo) return;
    setState((s) => ({ ...s, phase: "SUBMITTING" }));

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteType: state.clienteType,
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

  const steps = getSteps(state.clienteType);
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
        {isTyping && (
          <div className="mb-3 flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-3">
              <span className="flex gap-1">
                <span className="animate-bounce text-gray-400" style={{ animationDelay: "0ms" }}>•</span>
                <span className="animate-bounce text-gray-400" style={{ animationDelay: "150ms" }}>•</span>
                <span className="animate-bounce text-gray-400" style={{ animationDelay: "300ms" }}>•</span>
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
              onClick={() => setState((s) => ({ ...s, phase: "CONSENT", error: null }))}
            >
              Riprova
            </Button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-100 bg-white">
        {/* Step 1: scelta tipo cliente */}
        {state.phase === "TYPE_SELECTION" && !isTyping && displayed.length >= state.messages.length && (
          <div className="flex gap-3 px-4 py-4">
            <button
              onClick={() => selectType("AZIENDA")}
              className="flex-1 cursor-pointer rounded-xl border-2 border-blue-200 bg-blue-50 py-4 text-center text-sm font-medium text-blue-700 transition-colors hover:border-blue-400 hover:bg-blue-100"
            >
              🏢 Sono un&apos;azienda
            </button>
            <button
              onClick={() => selectType("PRIVATO")}
              className="flex-1 cursor-pointer rounded-xl border-2 border-gray-200 bg-gray-50 py-4 text-center text-sm font-medium text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-100"
            >
              👤 Sono un privato
            </button>
          </div>
        )}

        {/* Step 2b: messaggio avviso privati */}
        {state.phase === "PRIVATE_WARNING" && !isTyping && displayed.length >= state.messages.length && (
          <div className="px-4 py-4">
            <Button onClick={startQuestionsAfterWarning} className="w-full" size="lg">
              Ho capito, voglio procedere →
            </Button>
          </div>
        )}

        {/* Domande */}
        {state.phase === "QUESTIONS" && !isTyping && displayed.length >= state.messages.length && (
          <QuestionStep
            key={steps[state.currentStepIndex]?.id}
            step={steps[state.currentStepIndex]!}
            onAnswer={handleAnswer}
          />
        )}

        {/* Dati di contatto */}
        {state.phase === "CONTACT_INFO" && (
          <ContactForm onSubmit={handleContactInfo} />
        )}

        {/* Consenso GDPR */}
        {state.phase === "CONSENT" && (
          <div className="space-y-3 px-4 py-4">
            <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600"
                checked={state.consentGiven}
                onChange={(e) => setState((s) => ({ ...s, consentGiven: e.target.checked }))}
              />
              <span>
                Acconsento al trattamento dei dati forniti da Magnus SRL per la gestione
                della mia richiesta, ai sensi del{" "}
                <abbr title="Regolamento Generale sulla Protezione dei Dati">GDPR</abbr>{" "}
                (Reg. UE 2016/679).
              </span>
            </label>
            <Button onClick={handleSubmit} disabled={!state.consentGiven} className="w-full" size="lg">
              Invia la mia richiesta →
            </Button>
          </div>
        )}

        {/* Invio in corso */}
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
