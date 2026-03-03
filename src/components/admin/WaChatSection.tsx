"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";

type Message = { role: "user" | "assistant"; content: string };

export default function WaChatSection({ leadId }: { leadId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasConversation, setHasConversation] = useState<boolean | null>(null);
  const [completato, setCompletato] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevCountRef = useRef(0);

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

  // Scrolla in fondo solo quando arrivano nuovi messaggi (non al caricamento iniziale)
  useEffect(() => {
    if (!isOpen) return;
    if (messages.length > prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevCountRef.current = messages.length;
  }, [messages, isOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const removeFile = () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setSelectedFile(null);
    setFilePreview(null);
  };

  const sendMessage = async () => {
    if ((!input.trim() && !selectedFile) || sending) return;
    setSending(true);
    setError(null);
    try {
      let res: Response;
      if (selectedFile) {
        const fd = new FormData();
        if (input.trim()) fd.append("message", input.trim());
        fd.append("file", selectedFile, selectedFile.name);
        res = await fetch(`/api/admin/leads/${leadId}/wa-chat`, { method: "POST", body: fd });
      } else {
        res = await fetch(`/api/admin/leads/${leadId}/wa-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: input.trim() }),
        });
      }
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Errore invio");
      } else {
        setInput("");
        removeFile();
        await fetchMessages();
      }
    } catch {
      setError("Errore di rete");
    } finally {
      setSending(false);
    }
  };

  const resetConversation = async () => {
    if (!confirm("Resettare la conversazione? Tutti i messaggi WA verranno cancellati e il bot potrà ripartire da zero.")) return;
    setResetting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/wa-chat`, { method: "DELETE" });
      if (res.ok) {
        setMessages([]);
        setHasConversation(false);
        setCompletato(false);
        prevCountRef.current = 0;
      } else {
        setError("Errore nel reset");
      }
    } catch {
      setError("Errore di rete");
    } finally {
      setResetting(false);
    }
  };

  if (hasConversation === null || !hasConversation) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">💬 Chat WhatsApp</span>
            {completato && (
              <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                Lead qualificato
              </span>
            )}
            {messages.length > 0 && (
              <span className="text-xs text-gray-400">
                {messages.length} messaggi
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={resetConversation}
              disabled={resetting}
              title="Resetta conversazione (equivalente a MAGNUS RESET)"
              className="text-xs text-red-400 hover:text-red-600 cursor-pointer transition-colors disabled:opacity-40"
            >
              {resetting ? "…" : "🔄 Reset"}
            </button>
            <button
              onClick={() => setIsOpen((v) => !v)}
              className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
            >
              {isOpen ? "▲ Chiudi" : "▼ Apri chat"}
            </button>
          </div>
        </div>
      </CardHeader>

      {isOpen && (
        <CardBody className="p-0">
          {/* Messaggi */}
          <div className="h-72 overflow-y-auto px-4 py-3 space-y-2 bg-gray-50">
            {messages.length > 3 && (
              <p className="text-center text-xs text-gray-400 pb-1">↑ scorri per vedere i messaggi precedenti</p>
            )}
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

          {/* Preview immagine selezionata */}
          {filePreview && (
            <div className="px-3 pt-2 flex items-center gap-2">
              <img src={filePreview} alt="preview" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
              <button onClick={removeFile} className="text-xs text-red-400 hover:text-red-600 cursor-pointer">
                ✕ Rimuovi
              </button>
            </div>
          )}

          {/* Input invio */}
          <div className="border-t border-gray-100 px-3 py-2 flex gap-2 bg-white">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Allega immagine"
              className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors text-lg leading-none px-1"
            >
              📎
            </button>
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
              disabled={sending || (!input.trim() && !selectedFile)}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-default"
            >
              {sending ? "…" : "Invia"}
            </button>
          </div>
          {error && <p className="px-3 pb-2 text-xs text-red-500">{error}</p>}
        </CardBody>
      )}
    </Card>
  );
}
