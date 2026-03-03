"use client";

import { useEffect, useState, useCallback } from "react";
import WaChatSection from "@/components/admin/WaChatSection";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";

// ─── Tipi ────────────────────────────────────────────────────────────────────

interface EmailLog {
  id: string;
  autore: string;
  azione: string;
  dettagli: string | null;
  createdAt: string;
}

interface EmailHistoryData {
  emails: EmailLog[];
  emailContatto: string | null;
  missingFields: string[];
  hasTelefono: boolean;
}

// ─── Sezione Email ────────────────────────────────────────────────────────────

function EmailSection({ leadId }: { leadId: string }) {
  const [data, setData] = useState<EmailHistoryData | null>(null);
  const [draft, setDraft] = useState("");
  const [subject, setSubject] = useState("Magnus SRL — Completamento richiesta");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/email-history`);
      if (!res.ok) return;
      setData(await res.json());
    } catch {}
  }, [leadId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const generateDraft = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/followup-email`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore generazione");
      setDraft(json.draft ?? "");
      if (json.subject) setSubject(json.subject);
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
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore invio");
      setSent(true);
      await fetchHistory(); // aggiorna lo storico
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
    } finally {
      setSending(false);
    }
  };

  if (!data) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-gray-400 text-center py-6">Caricamento…</p>
        </CardBody>
      </Card>
    );
  }

  const { emails, emailContatto, missingFields } = data;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">📧 Email</span>
          {emails.length > 0 && (
            <span className="text-xs text-gray-400">{emails.length} {emails.length === 1 ? "inviata" : "inviate"}</span>
          )}
        </div>
      </CardHeader>

      <CardBody className="p-0">
        {/* ── Storico email ─────────────────────────────────── */}
        <div className="h-40 overflow-y-auto px-4 py-3 bg-gray-50 space-y-2">
          {emails.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-gray-400 text-center">
                Nessuna email inviata ancora
              </p>
            </div>
          ) : (
            emails.map((email) => {
              let details: { to?: string; subject?: string } = {};
              try { details = email.dettagli ? JSON.parse(email.dettagli) : {}; } catch {}
              const date = new Date(email.createdAt).toLocaleDateString("it-IT", {
                day: "2-digit", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              });
              return (
                <div key={email.id} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-500 text-xs">{date}</span>
                    <span className="text-xs text-gray-400">{email.autore}</span>
                  </div>
                  {details.subject && (
                    <p className="text-gray-800 font-medium mt-0.5 truncate">{details.subject}</p>
                  )}
                  {details.to && (
                    <p className="text-gray-400 text-xs truncate">A: {details.to}</p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── Separatore ────────────────────────────────────── */}
        <div className="border-t border-gray-100" />

        {/* ── Compose area ──────────────────────────────────── */}
        {!emailContatto ? (
          <div className="px-4 py-4">
            <p className="text-sm text-gray-400 text-center">Nessuna email di contatto registrata</p>
          </div>
        ) : sent ? (
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">
              <span>✅</span>
              <span>Email inviata a <strong>{emailContatto}</strong></span>
            </div>
            <button
              onClick={() => { setSent(false); setDraft(""); }}
              className="mt-2 text-xs text-blue-500 hover:text-blue-700 cursor-pointer"
            >
              Scrivi un'altra email
            </button>
          </div>
        ) : (
          <div className="px-4 py-3 space-y-2 bg-white">
            {/* Destinatario */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400 shrink-0 w-14">A:</span>
              <span className="font-medium text-gray-700">{emailContatto}</span>
            </div>

            {/* Oggetto */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400 shrink-0 w-14">Oggetto:</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-blue-400 bg-white"
              />
            </div>

            {/* Corpo */}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              placeholder={draft ? undefined : "Scrivi il corpo dell'email oppure genera una bozza automatica…"}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 leading-relaxed focus:outline-none focus:border-blue-400 resize-y bg-white font-sans"
            />

            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex items-center justify-between gap-2">
              {missingFields.length > 0 && (
                <Button onClick={generateDraft} loading={generating} variant="secondary" size="sm">
                  {draft ? "Rigenera bozza" : "✉️ Genera bozza"}
                </Button>
              )}
              {missingFields.length === 0 && <div />}
              <Button onClick={sendEmail} loading={sending} disabled={!draft.trim()} size="sm">
                📤 Invia email
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ─── Pannello comunicazioni principale ───────────────────────────────────────

interface Props {
  leadId: string;
  emailContatto?: string | null;
  missingFields: string[];
  hasTelefono?: boolean;
}

export default function CommunicationsPanel({ leadId, hasTelefono = true }: Props) {
  const [tab, setTab] = useState<"wa" | "email">(hasTelefono ? "wa" : "email");

  return (
    <div className="space-y-0">
      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 mb-3">
        <button
          onClick={() => setTab("wa")}
          className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition-all cursor-pointer ${
            tab === "wa"
              ? "bg-white text-gray-800 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          💬 WhatsApp
        </button>
        <button
          onClick={() => setTab("email")}
          className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition-all cursor-pointer ${
            tab === "email"
              ? "bg-white text-gray-800 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          📧 Email
        </button>
      </div>

      {/* Contenuto tab */}
      {tab === "wa" && <WaChatSection leadId={leadId} />}
      {tab === "email" && <EmailSection leadId={leadId} />}
    </div>
  );
}
