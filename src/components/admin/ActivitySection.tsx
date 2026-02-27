"use client";

import { useEffect, useState } from "react";

interface ActivityEntry {
  id: string;
  leadId: string;
  autore: string;
  azione: string;
  dettagli: string | null;
  createdAt: string;
}

const azioneLabel: Record<string, string> = {
  COMMERCIALE_ASSEGNATO: "👤 Commerciale assegnato",
  PIPELINE_AGGIORNATO: "⚙️ Pipeline aggiornato",
  NOTA_AGGIUNTA: "📝 Nota aggiunta",
  NOTA_ELIMINATA: "🗑 Nota eliminata",
  LEAD_ELIMINATO: "❌ Lead eliminato",
  LEAD_RIPRISTINATO: "♻️ Lead ripristinato",
  WEBHOOK_REINVIATO: "🔗 Webhook reinviato",
  STATO_AGGIORNATO: "🔄 Stato aggiornato",
};

const statoLeadLabel: Record<string, string> = {
  NUOVO: "Nuovo",
  IN_LAVORAZIONE: "In lavorazione",
  OFFERTA_INVIATA: "Offerta inviata",
  CHIUSO_VINTO: "Chiuso vinto",
  CHIUSO_PERSO: "Chiuso perso",
};

function formatDettagli(azione: string, dettagli: string | null): string {
  if (!dettagli) return "";
  try {
    const d = JSON.parse(dettagli) as Record<string, unknown>;
    if (azione === "COMMERCIALE_ASSEGNATO") {
      const da = d.da ?? "—";
      const a = d.a ?? "—";
      return `Da: ${da} → A: ${a}`;
    }
    if (azione === "PIPELINE_AGGIORNATO") {
      const da = statoLeadLabel[String(d.da)] ?? d.da ?? "—";
      const a = statoLeadLabel[String(d.a)] ?? d.a ?? "—";
      return `${da} → ${a}`;
    }
    if (azione === "STATO_AGGIORNATO") {
      return `${d.da} → ${d.a}`;
    }
    return JSON.stringify(d);
  } catch {
    return dettagli;
  }
}

export default function ActivitySection({
  leadId,
  initialLogs,
}: {
  leadId: string;
  initialLogs?: ActivityEntry[];
}) {
  const [logs, setLogs] = useState<ActivityEntry[]>(initialLogs ?? []);
  const [loading, setLoading] = useState(initialLogs === undefined);

  useEffect(() => {
    if (initialLogs !== undefined) return; // dati già pre-caricati
    fetch(`/api/admin/leads/${leadId}/log`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setLogs(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [leadId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <p className="text-xs text-gray-400">Caricamento log…</p>;
  }

  if (logs.length === 0) {
    return <p className="text-xs text-gray-400">Nessuna attività registrata.</p>;
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const det = formatDettagli(log.azione, log.dettagli);
        return (
          <div key={log.id} className="flex gap-3 text-xs">
            <div className="flex flex-col items-center">
              <div className="h-2 w-2 mt-1 rounded-full bg-gray-300 shrink-0" />
              <div className="flex-1 w-px bg-gray-100" />
            </div>
            <div className="pb-3 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-medium text-gray-700">
                  {azioneLabel[log.azione] ?? log.azione}
                </span>
                <span className="text-gray-400">da</span>
                <span className="font-medium text-gray-600">{log.autore}</span>
                <span className="text-gray-300">·</span>
                <time className="text-gray-400">
                  {new Date(log.createdAt).toLocaleString("it-IT", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              {det && <p className="mt-0.5 text-gray-500">{det}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
