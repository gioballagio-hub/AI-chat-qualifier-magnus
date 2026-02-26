"use client";

import Link from "next/link";
import type { LeadSummary } from "@/types/lead";
import ScoreBadge from "./ScoreBadge";
import Badge from "@/components/ui/Badge";

interface LeadTableProps {
  leads: LeadSummary[];
}

const statusVariant = {
  NEW: "new" as const,
  CONTACTED: "contacted" as const,
  ARCHIVED: "archived" as const,
};
const statusLabel = { NEW: "Nuovo", CONTACTED: "Contattato", ARCHIVED: "Archiviato" };

export default function LeadTable({ leads }: LeadTableProps) {
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
            <th className="px-4 py-3 font-medium text-gray-500">Tipo</th>
            <th className="px-4 py-3 font-medium text-gray-500">Score</th>
            <th className="px-4 py-3 font-medium text-gray-500">Completezza</th>
            <th className="px-4 py-3 font-medium text-gray-500">Stato</th>
            <th className="px-4 py-3 font-medium text-gray-500">Zona</th>
            <th className="px-4 py-3 font-medium text-gray-500">Data</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {leads.map((lead) => {
            const d = lead.data as Record<string, string>;
            return (
              <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-800">
                    {lead.type === "BUYER" ? "🏠 Acquisto" : "💰 Vendita"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <ScoreBadge score={lead.score} />
                </td>
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
                <td className="px-4 py-3">
                  <Badge variant={statusVariant[lead.status]}>
                    {statusLabel[lead.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">
                  {d.zona ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(lead.createdAt).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
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
