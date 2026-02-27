"use client";

import { useState } from "react";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";

interface Props {
  leadId: string;
  emailContatto: string;
  missingFields: string[];
}

export default function FollowUpEmailSection({ leadId, emailContatto, missingFields }: Props) {
  const [draft, setDraft] = useState<string>("");
  const [subject, setSubject] = useState("Magnus SRL — Completamento richiesta");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const generateDraft = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/followup-email`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore generazione");
      setDraft(data.draft);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
    } finally {
      setGenerating(false);
    }
  };

  const sendEmail = async () => {
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/followup-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft, subject }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore invio");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
    } finally {
      setSending(false);
    }
  };

  if (missingFields.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-amber-800">📧 Email di follow-up</span>
            <span className="text-xs text-amber-600 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
              {missingFields.length} {missingFields.length === 1 ? "campo mancante" : "campi mancanti"}
            </span>
          </div>
          {!sent && (
            <Button
              onClick={generateDraft}
              loading={generating}
              variant="secondary"
              size="sm"
            >
              {draft ? "Rigenera bozza" : "✉️ Genera bozza"}
            </Button>
          )}
        </div>
      </CardHeader>

      {open && !sent && (
        <CardBody className="space-y-3">
          {/* Destinatario */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400 shrink-0">A:</span>
            <span className="font-medium text-gray-700">{emailContatto}</span>
          </div>

          {/* Oggetto */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400 shrink-0">Oggetto:</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-blue-400 bg-white"
            />
          </div>

          {/* Corpo email — editabile */}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 leading-relaxed focus:outline-none focus:border-blue-400 resize-y bg-white font-sans"
            placeholder="La bozza dell'email apparirà qui…"
          />

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Puoi modificare il testo prima di inviarlo
            </p>
            <Button
              onClick={sendEmail}
              loading={sending}
              disabled={!draft.trim()}
              size="sm"
            >
              📤 Invia email
            </Button>
          </div>
        </CardBody>
      )}

      {sent && (
        <CardBody>
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">
            <span>✅</span>
            <span>Email inviata a <strong>{emailContatto}</strong></span>
          </div>
        </CardBody>
      )}
    </Card>
  );
}
