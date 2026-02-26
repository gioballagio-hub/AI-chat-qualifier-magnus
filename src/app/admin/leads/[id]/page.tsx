"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { LeadSummary, LeadStatus, StatoLead } from "@/types/lead";
import { LABEL_MAP, FIELD_LABELS } from "@/constants/questions";
import ScoreBadge from "@/components/admin/ScoreBadge";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import { useIsAdmin } from "@/lib/session-context";
import NoteSection from "@/components/admin/NoteSection";

const statusLabel: Record<LeadStatus, string> = {
  NEW: "Nuovo",
  CONTACTED: "Contattato",
  ARCHIVED: "Archiviato",
};

const PIPELINE_STEPS: { value: StatoLead; label: string; color: string }[] = [
  { value: "NUOVO", label: "🆕 Nuovo", color: "gray" },
  { value: "IN_LAVORAZIONE", label: "⚙️ In lavorazione", color: "blue" },
  { value: "OFFERTA_INVIATA", label: "📤 Offerta inviata", color: "amber" },
  { value: "CHIUSO_VINTO", label: "✅ Chiuso vinto", color: "green" },
  { value: "CHIUSO_PERSO", label: "❌ Chiuso perso", color: "red" },
];

function resolveValue(field: string, value: unknown): string {
  if (!value) return "—";
  const map = LABEL_MAP[field];
  if (map && typeof value === "string" && map[value]) return map[value];
  return String(value);
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [lead, setLead] = useState<LeadSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [updatingPipeline, setUpdatingPipeline] = useState(false);
  const [resending, setResending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch(`/api/admin/leads/${id}`)
      .then((r) => r.json())
      .then(setLead)
      .finally(() => setLoading(false));
  }, [id]);

  const changeStatus = async (status: LeadStatus) => {
    setUpdating(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Errore aggiornamento");
      const updated: LeadSummary = await res.json();
      setLead(updated);
      setMsg({ type: "ok", text: "Stato aggiornato." });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Errore" });
    } finally {
      setUpdating(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resend: true }),
      });
      if (!res.ok) throw new Error("Re-invio fallito");
      const updated: LeadSummary = await res.json();
      setLead(updated);
      setMsg({ type: "ok", text: updated.sentToIntegration ? "Webhook inviato." : "Invio fallito, controlla URL." });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Errore" });
    } finally {
      setResending(false);
    }
  };

  const changePipeline = async (statoLead: StatoLead) => {
    setUpdatingPipeline(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statoLead }),
      });
      if (!res.ok) throw new Error("Errore aggiornamento pipeline");
      const updated: LeadSummary = await res.json();
      setLead(updated);
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Errore" });
    } finally {
      setUpdatingPipeline(false);
    }
  };

  const deleteLead = async () => {
    if (!confirm("Eliminare questo lead? L'operazione non è reversibile.")) return;
    setDeleting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore eliminazione");
      router.push("/admin");
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Errore" });
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-gray-400">Caricamento…</div>;
  }

  if (!lead) {
    return (
      <div className="py-12 text-center text-gray-400">
        Lead non trovato.{" "}
        <button onClick={() => router.push("/admin")} className="text-blue-600 hover:underline cursor-pointer">
          Torna alla lista
        </button>
      </div>
    );
  }

  const fields = Object.entries(lead.data).filter(([k]) => k !== "zonaRaw");

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => router.push("/admin")}
          className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          ← Lista lead
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          {lead.clienteType === "AZIENDA" ? "🏢 Azienda" : "👤 Privato"}
        </h1>
        <ScoreBadge score={lead.score} />
        {isAdmin && (
          <button
            onClick={deleteLead}
            disabled={deleting}
            className="ml-auto text-xs text-red-400 hover:text-red-600 cursor-pointer disabled:opacity-50"
          >
            {deleting ? "Eliminando…" : "🗑 Elimina lead"}
          </button>
        )}
      </div>

      {msg && (
        <div
          className={`rounded-lg px-4 py-2 text-sm ${
            msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Dati contatto */}
      {(lead.nome || lead.emailContatto) && (
        <Card>
          <CardHeader>
            <span className="text-sm font-medium text-gray-700">Dati di contatto</span>
          </CardHeader>
          <CardBody>
            <dl className="space-y-2 text-sm">
              {lead.nome && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Nome</dt>
                  <dd className="font-medium text-gray-800">
                    {lead.nome} {lead.cognome}
                  </dd>
                </div>
              )}
              {lead.emailContatto && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Email</dt>
                  <dd className="font-medium text-gray-800">
                    <a
                      href={`mailto:${lead.emailContatto}`}
                      className="text-blue-600 hover:underline"
                    >
                      {lead.emailContatto}
                    </a>
                  </dd>
                </div>
              )}
              {lead.telefono && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Telefono</dt>
                  <dd className="font-medium text-gray-800">
                    <a href={`tel:${lead.telefono}`} className="text-blue-600 hover:underline">
                      {lead.telefono}
                    </a>
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Email inviata</dt>
                <dd>
                  <Badge variant={lead.emailInviata ? "new" : "archived"}>
                    {lead.emailInviata ? "Sì" : "No"}
                  </Badge>
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      )}

      {/* Dati raccolti */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Dati raccolti</span>
            <span className="text-xs text-gray-400">
              {Math.round(lead.completeness)}% completo
            </span>
          </div>
        </CardHeader>
        <CardBody>
          <dl className="space-y-3">
            {fields.map(([key, val]) => (
              <div key={key} className="flex justify-between text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                <dt className="text-gray-500">{FIELD_LABELS[key] ?? key}</dt>
                <dd className="font-medium text-gray-800 text-right max-w-[60%]">
                  {resolveValue(key, val)}
                </dd>
              </div>
            ))}
          </dl>
          {lead.missingFields.length > 0 && (
            <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Campi mancanti:{" "}
              {lead.missingFields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Prossimo step */}
      <Card>
        <CardBody>
          <p className="text-xs text-gray-400 mb-1">Prossimo step suggerito</p>
          <p className="text-sm font-medium text-gray-800">{lead.nextStep}</p>
        </CardBody>
      </Card>

      {/* Pipeline */}
      <Card>
        <CardHeader>
          <span className="text-sm font-medium text-gray-700">Pipeline</span>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PIPELINE_STEPS.map((step) => {
              const isActive = lead.statoLead === step.value;
              return (
                <button
                  key={step.value}
                  onClick={() => changePipeline(step.value)}
                  disabled={updatingPipeline || isActive}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer disabled:cursor-default ${
                    isActive
                      ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {step.label}
                </button>
              );
            })}
          </div>

          {/* Stato tecnico (NEW/CONTACTED/ARCHIVED) */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Stato tecnico</p>
            <div className="flex gap-2 flex-wrap">
              {(["NEW", "CONTACTED", "ARCHIVED"] as LeadStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  disabled={updating || lead.status === s}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer disabled:cursor-default ${
                    lead.status === s
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {statusLabel[s]}
                </button>
              ))}
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Webhook</p>
                <Badge variant={lead.sentToIntegration ? "new" : "archived"}>
                  {lead.sentToIntegration ? "Inviato" : "Non inviato"}
                </Badge>
              </div>
              <Button onClick={resend} loading={resending} variant="secondary" size="sm">
                Re-invia webhook
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Note interne */}
      <NoteSection leadId={lead.id} />

      <p className="text-xs text-gray-400">
        ID: {lead.id} · Creato: {new Date(lead.createdAt).toLocaleString("it-IT")}
      </p>
    </div>
  );
}
