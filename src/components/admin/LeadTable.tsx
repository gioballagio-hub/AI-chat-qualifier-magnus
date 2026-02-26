"use client";

import { useState } from "react";
import Link from "next/link";
import type { LeadSummary, MagnusLeadData, StatoLead } from "@/types/lead";
import ScoreBadge from "./ScoreBadge";
import Badge from "@/components/ui/Badge";

interface LeadTableProps {
  leads: LeadSummary[];
  commerciali?: string[];
}

const statusVariant = {
  NEW: "new" as const,
  CONTACTED: "contacted" as const,
  ARCHIVED: "archived" as const,
};
const statusLabel = { NEW: "Nuovo", CONTACTED: "Contattato", ARCHIVED: "Archiviato" };

const clienteTypeLabel: Record<string, string> = {
  AZIENDA: "🏢 Azienda",
  PRIVATO: "👤 Privato",
  INDEFINITO: "Indefinito",
};

// Pipeline statoLead
const statoLeadLabel: Record<StatoLead, string> = {
  NUOVO: "🆕 Nuovo",
  IN_LAVORAZIONE: "⚙️ In lavorazione",
  OFFERTA_INVIATA: "📤 Offerta inviata",
  CHIUSO_VINTO: "✅ Chiuso vinto",
  CHIUSO_PERSO: "❌ Chiuso perso",
};
const statoLeadColor: Record<StatoLead, string> = {
  NUOVO: "bg-gray-100 text-gray-600",
  IN_LAVORAZIONE: "bg-blue-100 text-blue-700",
  OFFERTA_INVIATA: "bg-amber-100 text-amber-700",
  CHIUSO_VINTO: "bg-green-100 text-green-700",
  CHIUSO_PERSO: "bg-red-100 text-red-600",
};

function StatoDropdown({ leadId, currentValue }: { leadId: string; currentValue: StatoLead }) {
  const [value, setValue] = useState<StatoLead>(currentValue);
  const [saving, setSaving] = useState(false);

  async function handleChange(newValue: StatoLead) {
    setValue(newValue);
    setSaving(true);
    try {
      await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statoLead: newValue }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value as StatoLead)}
        disabled={saving}
        className={`w-full rounded-lg border px-2 py-1 text-xs outline-none transition-colors cursor-pointer
          ${saving ? "opacity-50 cursor-wait" : ""}
          ${statoLeadColor[value]} border-transparent font-medium`}
      >
        {(Object.keys(statoLeadLabel) as StatoLead[]).map((s) => (
          <option key={s} value={s}>{statoLeadLabel[s]}</option>
        ))}
      </select>
    </div>
  );
}

function AssegnaDropdown({
  leadId,
  currentValue,
  commerciali,
}: {
  leadId: string;
  currentValue: string | null;
  commerciali: string[];
}) {
  const [value, setValue] = useState(currentValue ?? "");
  const [saving, setSaving] = useState(false);

  async function handleChange(newValue: string) {
    setValue(newValue);
    setSaving(true);
    try {
      await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commercialeAssegnato: newValue || null,
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className={`w-full rounded-lg border px-2 py-1 text-xs outline-none transition-colors
          ${saving ? "opacity-50 cursor-wait" : "cursor-pointer hover:border-blue-400"}
          ${value ? "border-blue-200 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 bg-white text-gray-400"}
        `}
      >
        <option value="">— Non assegnato</option>
        {commerciali.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      {saving && (
        <span className="absolute right-1 top-1 text-xs text-gray-400">💾</span>
      )}
    </div>
  );
}

export default function LeadTable({ leads, commerciali = [] }: LeadTableProps) {
  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white py-16 text-center text-gray-400">
        Nessun lead trovato.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left">
            <th className="px-4 py-3 font-medium text-gray-500">Cliente</th>
            <th className="px-4 py-3 font-medium text-gray-500">Priorità</th>
            <th className="px-4 py-3 font-medium text-gray-500">Pipeline</th>
            <th className="px-4 py-3 font-medium text-gray-500">Completezza</th>
            <th className="px-4 py-3 font-medium text-gray-500">Categoria</th>
            <th className="px-4 py-3 font-medium text-gray-500">Commerciale</th>
            <th className="px-4 py-3 font-medium text-gray-500">Data</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {leads.map((lead) => {
            const d = lead.data as MagnusLeadData;
            const nomeCompleto = [lead.nome, lead.cognome].filter(Boolean).join(" ") || "—";
            const ragioneSociale = d.ragioneSociale;

            return (
              <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                {/* Tipo cliente + nome */}
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800 text-xs">
                    {clienteTypeLabel[d.clienteType] ?? d.clienteType}
                  </div>
                  <div className="text-gray-500 text-xs truncate max-w-[130px]">
                    {ragioneSociale ?? nomeCompleto}
                  </div>
                </td>
                {/* Score / Priorità */}
                <td className="px-4 py-3">
                  <ScoreBadge score={lead.score} />
                </td>
                {/* Pipeline statoLead */}
                <td className="px-4 py-3 min-w-[160px]">
                  <StatoDropdown leadId={lead.id} currentValue={lead.statoLead ?? "NUOVO"} />
                </td>
                {/* Completezza */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${lead.completeness}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">
                      {Math.round(lead.completeness)}%
                    </span>
                  </div>
                </td>
                {/* Categoria */}
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {d.categoriaProdotto ?? "—"}
                </td>
                {/* Commerciale assegnato */}
                <td className="px-4 py-3 min-w-[140px]">
                  {commerciali.length > 0 ? (
                    <AssegnaDropdown
                      leadId={lead.id}
                      currentValue={lead.commercialeAssegnato}
                      commerciali={commerciali}
                    />
                  ) : (
                    <span className="text-xs text-gray-400">
                      {lead.commercialeAssegnato ?? "—"}
                    </span>
                  )}
                </td>
                {/* Data */}
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(lead.createdAt).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                {/* Azione */}
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/leads/${lead.id}`}
                    className="text-blue-600 hover:underline text-xs"
                  >
                    Dettaglio →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
