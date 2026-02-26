import { prisma } from "@/lib/prisma";
import Link from "next/link";
import type { StatoLead } from "@/types/lead";

export const dynamic = "force-dynamic";

// Helper: calcola percentuale sicura
function pct(num: number, den: number) {
  if (den === 0) return 0;
  return Math.round((num / den) * 100);
}

export default async function DashboardPage() {
  const now = new Date();
  const inizioMese = new Date(now.getFullYear(), now.getMonth(), 1);
  const inizioSettimana = new Date(now);
  inizioSettimana.setDate(now.getDate() - now.getDay() + 1); // lunedì
  inizioSettimana.setHours(0, 0, 0, 0);
  const ieri = new Date(now);
  ieri.setDate(now.getDate() - 1);
  ieri.setHours(0, 0, 0, 0);

  const [
    totale,
    totaleAttivi,
    questoMese,
    questaSettimana,
    oggi,
    perScore,
    perStato,
    perPipeline,
    perCommerciale,
    nonAssegnati,
    tempoMedioRows,
  ] = await Promise.all([
    // Totale storico
    prisma.lead.count({ where: {} }),
    // Lead attivi (non eliminati)
    prisma.lead.count({ where: { deletedAt: null } }),
    // Questo mese
    prisma.lead.count({ where: { deletedAt: null, createdAt: { gte: inizioMese } } }),
    // Questa settimana
    prisma.lead.count({ where: { deletedAt: null, createdAt: { gte: inizioSettimana } } }),
    // Oggi
    prisma.lead.count({ where: { deletedAt: null, createdAt: { gte: ieri } } }),
    // Per score
    prisma.lead.groupBy({ by: ["score"], where: { deletedAt: null }, _count: true }),
    // Per status
    prisma.lead.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
    // Per pipeline statoLead
    prisma.lead.groupBy({ by: ["statoLead"], where: { deletedAt: null }, _count: true }),
    // Per commerciale assegnato (top 10)
    prisma.lead.groupBy({
      by: ["commercialeAssegnato"],
      where: { deletedAt: null, commercialeAssegnato: { not: null } },
      _count: true,
      orderBy: { _count: { commercialeAssegnato: "desc" } },
      take: 10,
    }),
    // Non ancora assegnati
    prisma.lead.count({ where: { deletedAt: null, commercialeAssegnato: null } }),
    // Completezza media
    prisma.lead.aggregate({ where: { deletedAt: null }, _avg: { completeness: true } }),
  ]);

  const scoreMap: Record<string, number> = {};
  perScore.forEach((r) => { scoreMap[r.score] = r._count; });

  const statoMap: Record<string, number> = {};
  perStato.forEach((r) => { statoMap[r.status] = r._count; });

  const pipelineMap: Record<string, number> = {};
  perPipeline.forEach((r) => { pipelineMap[r.statoLead ?? "NUOVO"] = r._count; });

  const completezzaMedia = Math.round(tempoMedioRows._avg.completeness ?? 0);

  // Tasso conversione: chiusi vinti su totale attivi
  const chiusiVinti = pipelineMap["CHIUSO_VINTO"] ?? 0;
  const tassoConversione = pct(chiusiVinti, totaleAttivi);

  // Pipeline steps in ordine
  const pipelineSteps: { key: StatoLead; label: string; color: string }[] = [
    { key: "NUOVO", label: "🆕 Nuovo", color: "bg-gray-400" },
    { key: "IN_LAVORAZIONE", label: "⚙️ In lavorazione", color: "bg-blue-500" },
    { key: "OFFERTA_INVIATA", label: "📤 Offerta inviata", color: "bg-amber-500" },
    { key: "CHIUSO_VINTO", label: "✅ Chiuso vinto", color: "bg-green-500" },
    { key: "CHIUSO_PERSO", label: "❌ Chiuso perso", color: "bg-red-400" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard KPI</h1>
        <p className="text-sm text-gray-500 mt-1">
          Aggiornato al {now.toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" })}
        </p>
      </div>

      {/* KPI cards principali */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Lead totali", value: totaleAttivi, sub: `${totale} inclusi eliminati`, color: "text-gray-800" },
          { label: "Questo mese", value: questoMese, sub: `di cui ${questaSettimana} questa settimana`, color: "text-blue-700" },
          { label: "Completezza media", value: `${completezzaMedia}%`, sub: "su tutti i lead attivi", color: "text-purple-700" },
          { label: "Tasso conversione", value: `${tassoConversione}%`, sub: `${chiusiVinti} chiusi vinti`, color: "text-green-700" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{kpi.label}</p>
            <p className={`mt-1 text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="mt-1 text-xs text-gray-400">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Score / Priorità */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Distribuzione priorità</h2>
          <div className="space-y-3">
            {[
              { key: "ALTA", label: "🔥 Alta", color: "bg-red-500" },
              { key: "MEDIA", label: "☀️ Media", color: "bg-amber-400" },
              { key: "BASSA", label: "❄️ Bassa", color: "bg-blue-300" },
            ].map(({ key, label, color }) => {
              const count = scoreMap[key] ?? 0;
              const p = pct(count, totaleAttivi);
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium text-gray-800">{count} <span className="text-gray-400">({p}%)</span></span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${p}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pipeline */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Funnel pipeline</h2>
          <div className="space-y-3">
            {pipelineSteps.map(({ key, label, color }) => {
              const count = pipelineMap[key] ?? 0;
              const p = pct(count, totaleAttivi);
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium text-gray-800">{count} <span className="text-gray-400">({p}%)</span></span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${p}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Commerciali */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Lead per commerciale
            {nonAssegnati > 0 && (
              <Link href="/admin?q=" className="ml-2 text-xs font-normal text-amber-600 hover:underline">
                ⚠️ {nonAssegnati} non assegnati
              </Link>
            )}
          </h2>
          {perCommerciale.length === 0 ? (
            <p className="text-xs text-gray-400">Nessun lead assegnato.</p>
          ) : (
            <div className="space-y-2">
              {perCommerciale.map((r) => {
                const nome = r.commercialeAssegnato ?? "—";
                const count = r._count;
                const p = pct(count, totaleAttivi);
                return (
                  <div key={nome} className="flex items-center gap-3">
                    <span className="w-24 truncate text-xs text-gray-600">{nome}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${p}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Attività recente */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Attività recente</h2>
          <div className="space-y-3">
            {[
              { label: "Lead oggi", value: oggi, link: "/admin" },
              { label: "Lead questa settimana", value: questaSettimana, link: "/admin" },
              { label: "Lead questo mese", value: questoMese, link: "/admin" },
              { label: "Non assegnati", value: nonAssegnati, link: "/admin", alert: nonAssegnati > 0 },
              { label: "Archiviati", value: statoMap["ARCHIVED"] ?? 0, link: "/admin?status=ARCHIVED" },
            ].map(({ label, value, link, alert }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{label}</span>
                <Link
                  href={link}
                  className={`text-sm font-semibold ${alert ? "text-amber-600" : "text-gray-800"} hover:underline`}
                >
                  {value}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
