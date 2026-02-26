import Link from "next/link";
import { prisma } from "@/lib/prisma";
import LeadTable from "@/components/admin/LeadTable";
import type { LeadSummary, ClienteType, MagnusLeadData, StatoLead } from "@/types/lead";
import type { Lead } from "@prisma/client";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    score?: string;
    status?: string;
    clienteType?: string;
    page?: string;
    q?: string;
  }>;
}

export default async function AdminLeadsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const limit = 20;
  const q = params.q?.trim() ?? "";

  const where: Record<string, unknown> = { deletedAt: null };
  if (params.score) where["score"] = params.score;
  if (params.status) where["status"] = params.status;
  if (params.clienteType) where["clienteType"] = params.clienteType;

  // Ricerca full-text: cerca su nome, cognome, email, telefono e campi Magnus estratti
  if (q) {
    where["OR"] = [
      { nome: { contains: q, mode: "insensitive" } },
      { cognome: { contains: q, mode: "insensitive" } },
      { emailContatto: { contains: q, mode: "insensitive" } },
      { telefono: { contains: q, mode: "insensitive" } },
      { ragioneSociale: { contains: q, mode: "insensitive" } },
      { partitaIVA: { contains: q, mode: "insensitive" } },
      { brandProdotto: { contains: q, mode: "insensitive" } },
      { codiceProdotto: { contains: q, mode: "insensitive" } },
      { vinCode: { contains: q, mode: "insensitive" } },
      { categoriaProdotto: { contains: q, mode: "insensitive" } },
      { commercialeAssegnato: { contains: q, mode: "insensitive" } },
    ];
  }

  const [leads, total, utenti] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.lead.count({ where }),
    // Recupera la lista dei commerciali dalla tabella User (Feature 3)
    // Se la tabella non esiste ancora restituisce array vuoto
    prisma.user.findMany({ select: { nome: true }, orderBy: { nome: "asc" } }).catch(() => []),
  ]);

  const commerciali = utenti.map((u: { nome: string }) => u.nome);

  const summaries: LeadSummary[] = (leads as Lead[]).map((l) => ({
    id: l.id,
    clienteType: l.clienteType as ClienteType,
    data: l.data as unknown as MagnusLeadData,
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
    emailContatto: l.emailContatto,
    telefono: l.telefono ?? null,
    commercialeAssegnato: l.commercialeAssegnato ?? null,
    statoLead: (l.statoLead ?? "NUOVO") as StatoLead,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }));

  const totalPages = Math.ceil(total / limit);

  // Costruisce querystring mantenendo i filtri attivi
  function buildQs(extra: Record<string, string | undefined>) {
    const merged: Record<string, string> = {};
    if (params.score) merged["score"] = params.score;
    if (params.status) merged["status"] = params.status;
    if (params.clienteType) merged["clienteType"] = params.clienteType;
    if (q) merged["q"] = q;
    Object.entries(extra).forEach(([k, v]) => {
      if (v === undefined || v === "") delete merged[k];
      else merged[k] = v;
    });
    const qs = new URLSearchParams(merged).toString();
    return `/admin${qs ? "?" + qs : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Richieste</h1>
          <p className="text-sm text-gray-500">
            {total} {q ? `risultati per "${q}"` : "richieste totali"}
          </p>
        </div>
        <a
          href="/api/admin/leads/export"
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          Esporta Excel
        </a>
      </div>

      {/* Barra di ricerca */}
      <form method="GET" action="/admin" className="flex gap-2">
        {/* Mantieni i filtri attivi */}
        {params.score && <input type="hidden" name="score" value={params.score} />}
        {params.status && <input type="hidden" name="status" value={params.status} />}
        {params.clienteType && <input type="hidden" name="clienteType" value={params.clienteType} />}
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Cerca per nome, email, azienda, VIN, brand…"
            className="w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-2 text-sm focus:border-blue-400 focus:outline-none shadow-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Cerca
        </button>
        {q && (
          <a
            href={buildQs({ q: "" })}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            ✕ Pulisci
          </a>
        )}
      </form>

      {/* Filtri */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Tutti", extra: { score: "", status: "", clienteType: "" } },
          { label: "🔥 Alta priorità", extra: { score: "ALTA" } },
          { label: "☀️ Media priorità", extra: { score: "MEDIA" } },
          { label: "❄️ Bassa priorità", extra: { score: "BASSA" } },
          { label: "Nuovi", extra: { status: "NEW" } },
          { label: "🏢 Aziende", extra: { clienteType: "AZIENDA" } },
          { label: "👤 Privati", extra: { clienteType: "PRIVATO" } },
        ].map((filter) => (
          <Link
            key={filter.label}
            href={buildQs({ ...filter.extra, page: "1" })}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <LeadTable leads={summaries} commerciali={commerciali} />

      {/* Paginazione */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={buildQs({ page: String(p) })}
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
