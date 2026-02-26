import Link from "next/link";
import { prisma } from "@/lib/prisma";
import LeadTable from "@/components/admin/LeadTable";
import type { LeadSummary, LeadType } from "@/types/lead";
import type { Lead } from "@prisma/client";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    score?: string;
    status?: string;
    type?: string;
    page?: string;
  }>;
}

export default async function AdminLeadsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const limit = 20;

  const where: Record<string, string> = {};
  if (params.score) where["score"] = params.score;
  if (params.status) where["status"] = params.status;
  if (params.type) where["type"] = params.type;

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.lead.count({ where }),
  ]);

  const summaries: LeadSummary[] = (leads as Lead[]).map((l) => ({
    id: l.id,
    type: l.type as LeadType,
    data: l.data as LeadSummary["data"],
    score: l.score as LeadSummary["score"],
    completeness: l.completeness,
    missingFields: l.missingFields as string[],
    nextStep: l.nextStep,
    status: l.status as LeadSummary["status"],
    sentToIntegration: l.sentToIntegration,
    emailInviata: l.emailInviata,
    consentGiven: l.consentGiven,
    nome: l.nome,
    cognome: l.cognome,
    eta: l.eta,
    emailContatto: l.emailContatto,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }));

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lead</h1>
          <p className="text-sm text-gray-500">{total} lead totali</p>
        </div>
        <a
          href="/api/admin/leads/export"
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          Esporta Excel
        </a>
      </div>

      {/* Filtri */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Tutti", params: {} },
          { label: "🔥 CALDO", params: { score: "CALDO" } },
          { label: "☀️ TIEPIDO", params: { score: "TIEPIDO" } },
          { label: "❄️ FREDDO", params: { score: "FREDDO" } },
          { label: "Nuovi", params: { status: "NEW" } },
          { label: "Acquisto", params: { type: "BUYER" } },
          { label: "Vendita", params: { type: "SELLER" } },
        ].map((filter) => {
          const sp = new URLSearchParams(filter.params as Record<string, string>).toString();
          return (
            <Link
              key={filter.label}
              href={`/admin${sp ? "?" + sp : ""}`}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      <LeadTable leads={summaries} />

      {/* Paginazione */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin?page=${p}${params.score ? "&score=" + params.score : ""}${params.status ? "&status=" + params.status : ""}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                p === page
                  ? "bg-blue-600 text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
