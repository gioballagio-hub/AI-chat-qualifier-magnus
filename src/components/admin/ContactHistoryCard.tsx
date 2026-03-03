"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import ScoreBadge from "@/components/admin/ScoreBadge";

interface HistoryEntry {
  id: string;
  nome: string | null;
  cognome: string | null;
  score: string;
  statoLead: string;
  categoriaProdotto: string | null;
  brandProdotto: string | null;
  commercialeAssegnato: string | null;
  descrizioneProdotto: string | null;
  createdAt: string;
}

const STATO_LABEL: Record<string, string> = {
  NUOVO: "🆕 Nuovo",
  IN_LAVORAZIONE: "⚙️ In lavorazione",
  OFFERTA_INVIATA: "📤 Offerta inviata",
  CHIUSO_VINTO: "✅ Chiuso vinto",
  CHIUSO_PERSO: "❌ Chiuso perso",
};

const STATO_COLOR: Record<string, string> = {
  NUOVO: "bg-gray-100 text-gray-600",
  IN_LAVORAZIONE: "bg-blue-100 text-blue-700",
  OFFERTA_INVIATA: "bg-amber-100 text-amber-700",
  CHIUSO_VINTO: "bg-green-100 text-green-700",
  CHIUSO_PERSO: "bg-red-100 text-red-600",
};

const CATEGORIA_COLOR: Record<string, string> = {
  Accessori: "bg-blue-50 text-blue-700 border border-blue-200",
  Ricambi: "bg-amber-50 text-amber-700 border border-amber-200",
  Lubrificanti: "bg-green-50 text-green-700 border border-green-200",
  Vernici: "bg-purple-50 text-purple-700 border border-purple-200",
};

interface ContactHistoryCardProps {
  leadId: string;
}

export default function ContactHistoryCard({ leadId }: ContactHistoryCardProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/leads/${leadId}/contact-history`)
      .then((r) => r.json())
      .then((data) => setHistory(data.history ?? []))
      .finally(() => setLoading(false));
  }, [leadId]);

  // Non mostrare nulla se il caricamento è finito e non c'è storia
  if (!loading && history.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-medium text-gray-700">
          🔁 Storico Contatto
          {history.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({history.length} richiesta{history.length > 1 ? "e" : ""} precedente{history.length > 1 ? "i" : ""})
            </span>
          )}
        </span>
      </CardHeader>
      <CardBody>
        {loading ? (
          <p className="text-xs text-gray-400">Caricamento storico…</p>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 hover:border-blue-100 hover:bg-blue-50/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  {/* Sinistra: data, categoria, brand, descrizione */}
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-400 shrink-0">
                        {new Date(entry.createdAt).toLocaleDateString("it-IT", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      {entry.categoriaProdotto && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            CATEGORIA_COLOR[entry.categoriaProdotto] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {entry.categoriaProdotto}
                        </span>
                      )}
                      <ScoreBadge score={entry.score as "ALTA" | "MEDIA" | "BASSA"} />
                    </div>
                    <p className="text-xs text-gray-700 font-medium truncate max-w-[260px]">
                      {[entry.brandProdotto, entry.descrizioneProdotto]
                        .filter(Boolean)
                        .join(" — ") || "—"}
                    </p>
                    {entry.commercialeAssegnato && (
                      <p className="text-xs text-gray-400">👔 {entry.commercialeAssegnato}</p>
                    )}
                  </div>

                  {/* Destra: stato pipeline + link */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-lg font-medium ${
                        STATO_COLOR[entry.statoLead] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {STATO_LABEL[entry.statoLead] ?? entry.statoLead}
                    </span>
                    <Link
                      href={`/admin/leads/${entry.id}`}
                      className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
                    >
                      Apri →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
