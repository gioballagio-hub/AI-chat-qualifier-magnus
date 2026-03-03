"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";

type Message = { role: "user" | "assistant"; content: string };

export default function WaChatSection({ leadId }: { leadId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasConversation, setHasConversation] = useState<boolean | null>(null);
  const [completato, setCompletato] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/wa-chat`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
      setHasConversation(data.hasConversation);
      setCompletato(data.completato ?? false);
    } catch {}
  }, [leadId]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 15000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/wa-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Errore invio");
      } else {
        setInput("");
        await fetchMessages();
      }
    } catch {
      setError("Errore di rete");
    } finally {
      setSending(false);
    }
  };

  if (hasConversation === null || !hasConversation) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">💬 Chat WhatsApp</span>
          {completato && (
            <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              Lead qualificato
            </span>
          )}
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {/* Messaggi */}
        <div className="h-72 overflow-y-auto px-4 py-3 space-y-2 bg-gray-50">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "assistant" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-snug whitespace-pre-wrap ${
                  msg.role === "assistant"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input invio */}
        <div className="border-t border-gray-100 px-3 py-2 flex gap-2 bg-white">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Scrivi un messaggio..."
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400 bg-white"
          />
          <button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-default"
          >
            {sending ? "…" : "Invia"}
          </button>
        </div>
        {error && <p className="px-3 pb-2 text-xs text-red-500">{error}</p>}
      </CardBody>
    </Card>
  );
}
