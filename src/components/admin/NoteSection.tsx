"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "@/lib/session-context";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";

interface Nota {
  id: string;
  autore: string;
  testo: string;
  createdAt: string;
}

interface NoteSectionProps {
  leadId: string;
  initialNote?: Nota[];
}

export default function NoteSection({ leadId, initialNote }: NoteSectionProps) {
  const session = useSession();
  const [note, setNote] = useState<Nota[]>(initialNote ?? []);
  const [loading, setLoading] = useState(initialNote === undefined);
  const [testo, setTesto] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialNote !== undefined) return; // dati già pre-caricati
    fetch(`/api/admin/leads/${leadId}/note`)
      .then((r) => r.json())
      .then((data) => setNote(data.note ?? []))
      .finally(() => setLoading(false));
  }, [leadId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll automatico all'ultima nota
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [note]);

  const aggiungiNota = async () => {
    if (!testo.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testo: testo.trim() }),
      });
      if (!res.ok) throw new Error("Errore salvataggio nota");
      const nuovaNota: Nota = await res.json();
      setNote((prev) => [...prev, nuovaNota]);
      setTesto("");
    } catch {
      setError("Errore nel salvataggio della nota.");
    } finally {
      setSaving(false);
    }
  };

  const eliminaNota = async (notaId: string) => {
    if (!confirm("Eliminare questa nota?")) return;
    try {
      const res = await fetch(`/api/admin/note/${notaId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore eliminazione");
      setNote((prev) => prev.filter((n) => n.id !== notaId));
    } catch {
      setError("Errore nell'eliminazione della nota.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      aggiungiNota();
    }
  };

  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-medium text-gray-700">
          💬 Note interne {note.length > 0 && <span className="text-gray-400 font-normal">({note.length})</span>}
        </span>
      </CardHeader>
      <CardBody className="space-y-3">
        {/* Lista note */}
        {loading ? (
          <p className="text-xs text-gray-400">Caricamento…</p>
        ) : note.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Nessuna nota. Sii il primo a commentare.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {note.map((n) => {
              const isMine = session?.nome === n.autore;
              const isAdmin = session?.ruolo === "ADMIN";
              return (
                <div key={n.id} className="rounded-lg bg-gray-50 px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-blue-700">{n.autore}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {new Date(n.createdAt).toLocaleString("it-IT", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                      {(isMine || isAdmin) && (
                        <button
                          onClick={() => eliminaNota(n.id)}
                          className="text-xs text-gray-300 hover:text-red-400 cursor-pointer transition-colors"
                          title="Elimina nota"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{n.testo}</p>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Form nuova nota */}
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
        <div className="space-y-2">
          <textarea
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi una nota interna… (Cmd+Invio per salvare)"
            rows={3}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 resize-none transition-colors"
          />
          <div className="flex justify-end">
            <button
              onClick={aggiungiNota}
              disabled={saving || !testo.trim()}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {saving ? "Salvataggio…" : "➕ Aggiungi nota"}
            </button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
