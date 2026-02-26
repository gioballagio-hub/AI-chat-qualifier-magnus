"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsAdmin } from "@/lib/session-context";
import type { LeadSummary, MagnusLeadData } from "@/types/lead";
import ScoreBadge from "@/components/admin/ScoreBadge";

export default function CestinoPage() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/leads/cestino")
      .then((r) => r.json())
      .then((data) => setLeads(data.leads ?? []))
      .finally(() => setLoading(false));
  }, []);

  // Redirect se non admin
  useEffect(() => {
    if (isAdmin === false) router.push("/admin");
  }, [isAdmin, router]);

  const ripristina = async (id: string) => {
    setRestoring(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/leads/${id}/ripristina`, { method: "POST" });
      if (!res.ok) throw new Error("Errore ripristino");
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setMsg({ type: "ok", text: "Lead ripristinato con successo." });
    } catch {
      setMsg({ type: "err", text: "Errore durante il ripristino." });
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/admin")}
          className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          ← Lista lead
        </button>
        <h1 className="text-xl font-bold text-gray-900">🗑 Cestino</h1>
      </div>

      <p className="text-sm text-gray-500">
        I lead eliminati sono conservati qui. Solo gli Admin possono vederli e ripristinarli.
      </p>

      {msg && (
        <div className={`rounded-lg px-4 py-2 text-sm ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-400">Caricamento…</div>
      ) : leads.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-16 text-center text-gray-400">
          Il cestino è vuoto.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-500">Cliente</th>
                <th className="px-4 py-3 font-medium text-gray-500">Priorità</th>
                <th className="px-4 py-3 font-medium text-gray-500">Categoria</th>
                <th className="px-4 py-3 font-medium text-gray-500">Eliminato il</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leads.map((lead) => {
                const d = lead.data as MagnusLeadData;
                const nomeCompleto = [lead.nome, lead.cognome].filter(Boolean).join(" ") || "—";
                return (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors opacity-75">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-700 text-xs">
                        {lead.clienteType === "AZIENDA" ? "🏢" : "👤"} {d.ragioneSociale ?? nomeCompleto}
                      </div>
                      <div className="text-gray-400 text-xs">{lead.emailContatto ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={lead.score} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {d.categoriaProdotto ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {lead.deletedAt ? new Date(lead.deletedAt).toLocaleString("it-IT") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => ripristina(lead.id)}
                        disabled={restoring === lead.id}
                        className="text-xs text-blue-600 hover:underline cursor-pointer disabled:opacity-50"
                      >
                        {restoring === lead.id ? "Ripristinando…" : "↩ Ripristina"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
