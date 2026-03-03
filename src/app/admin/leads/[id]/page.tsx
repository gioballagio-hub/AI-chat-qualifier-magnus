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
import ActivitySection from "@/components/admin/ActivitySection";
import FollowUpEmailSection from "@/components/admin/FollowUpEmailSection";
import WaChatSection from "@/components/admin/WaChatSection";

const statusLabel: Record<LeadStatus, string> = {
  NEW: "Nuovo",
  CONTACTED: "Contattato",
  ARCHIVED: "Archiviato",
};

const PIPELINE_STEPS: { value: StatoLead; label: string }[] = [
  { value: "NUOVO", label: "🆕 Nuovo" },
  { value: "IN_LAVORAZIONE", label: "⚙️ In lavorazione" },
  { value: "OFFERTA_INVIATA", label: "📤 Offerta inviata" },
  { value: "CHIUSO_VINTO", label: "✅ Chiuso vinto" },
  { value: "CHIUSO_PERSO", label: "❌ Chiuso perso" },
];

const CATEGORIA_COLORS: Record<string, string> = {
  Accessori: "bg-blue-50 text-blue-700 border border-blue-200",
  Ricambi: "bg-amber-50 text-amber-700 border border-amber-200",
  Lubrificanti: "bg-green-50 text-green-700 border border-green-200",
  Vernici: "bg-purple-50 text-purple-700 border border-purple-200",
};

function resolveValue(field: string, value: unknown): string {
  if (!value) return "—";
  const str = String(value);
  if (["no", "non ho niente", "n/a", "nessuno", "niente"].includes(str.toLowerCase())) return "—";
  const map = LABEL_MAP[field];
  if (map && map[str]) return map[str];
  return str;
}

interface Utente {
  id: string;
  nome: string;
  ruolo: string;
  attivo: boolean;
}

interface Nota {
  id: string;
  autore: string;
  testo: string;
  createdAt: string;
}

interface ActivityEntry {
  id: string;
  leadId: string;
  autore: string;
  azione: string;
  dettagli: string | null;
  createdAt: string;
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [lead, setLead] = useState<LeadSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [updatingPipeline, setUpdatingPipeline] = useState(false);
  const [updatingCommerciale, setUpdatingCommerciale] = useState(false);
  const [resending, setResending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [initialNote, setInitialNote] = useState<Nota[] | undefined>(undefined);
  const [initialLogs, setInitialLogs] = useState<ActivityEntry[] | undefined>(undefined);

  // Edit mode — Dati di contatto
  const [editingContatto, setEditingContatto] = useState(false);
  const [savingContatto, setSavingContatto] = useState(false);
  const [formContatto, setFormContatto] = useState({ nome: "", cognome: "", emailContatto: "", telefono: "" });

  // Edit mode — Dati raccolti
  const [editingDati, setEditingDati] = useState(false);
  const [savingDati, setSavingDati] = useState(false);
  const [formDati, setFormDati] = useState<Record<string, string>>({});

  // Una sola chiamata che porta lead + note + log + utenti
  useEffect(() => {
    fetch(`/api/admin/leads/${id}/full`)
      .then((r) => r.json())
      .then((data) => {
        if (data.lead) setLead(data.lead);
        if (Array.isArray(data.note)) setInitialNote(data.note);
        if (Array.isArray(data.log)) setInitialLogs(data.log);
        if (Array.isArray(data.utenti)) setUtenti(data.utenti);
      })
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

  const changeCommerciale = async (nuovoNome: string) => {
    setUpdatingCommerciale(true);
    setMsg(null);
    try {
      const value = nuovoNome === "" ? null : nuovoNome;
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commercialeAssegnato: value }),
      });
      if (!res.ok) throw new Error("Errore assegnazione commerciale");
      const updated: LeadSummary = await res.json();
      setLead(updated);
      setMsg({ type: "ok", text: "Commerciale aggiornato." });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Errore" });
    } finally {
      setUpdatingCommerciale(false);
    }
  };

  const startEditContatto = () => {
    if (!lead) return;
    setFormContatto({
      nome: lead.nome ?? "",
      cognome: lead.cognome ?? "",
      emailContatto: lead.emailContatto ?? "",
      telefono: lead.telefono ?? "",
    });
    setEditingContatto(true);
  };

  const saveContatto = async () => {
    setSavingContatto(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: formContatto.nome,
          cognome: formContatto.cognome,
          emailContatto: formContatto.emailContatto,
          telefono: formContatto.telefono || null,
        }),
      });
      if (!res.ok) throw new Error("Errore salvataggio");
      const updated: LeadSummary = await res.json();
      setLead(updated);
      setEditingContatto(false);
      setMsg({ type: "ok", text: "Dati di contatto aggiornati." });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Errore" });
    } finally {
      setSavingContatto(false);
    }
  };

  const startEditDati = () => {
    if (!lead) return;
    const data = lead.data as unknown as Record<string, unknown>;
    setFormDati({
      clienteType: lead.clienteType ?? "INDEFINITO",
      descrizioneProdotto: (data.descrizioneProdotto as string) ?? "",
      categoriaProdotto: (data.categoriaProdotto as string) ?? "",
      brandProdotto: (data.brandProdotto as string) ?? "",
      codiceProdotto: (data.codiceProdotto as string) ?? "",
      vinCode: (data.vinCode as string) ?? "",
      noteAggiuntive: (data.noteAggiuntive as string) ?? "",
      ragioneSociale: (data.ragioneSociale as string) ?? "",
      partitaIVA: (data.partitaIVA as string) ?? "",
    });
    setEditingDati(true);
  };

  const saveDati = async () => {
    setSavingDati(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadData: formDati }),
      });
      if (!res.ok) throw new Error("Errore salvataggio");
      const updated: LeadSummary = await res.json();
      setLead(updated);
      setEditingDati(false);
      setMsg({ type: "ok", text: "Dati aggiornati." });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Errore" });
    } finally {
      setSavingDati(false);
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
    <div className="max-w-6xl space-y-4">
      {/* Header */}
      <div className="space-y-1.5">
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
        <div className="flex items-center gap-2 pl-1">
          <p className="text-sm text-gray-500">{lead.nextStep}</p>
          <span className="text-gray-300">·</span>
          <p className="text-xs text-gray-400 shrink-0">
            {new Date(lead.createdAt).toLocaleDateString("it-IT", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
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

      {/* Layout a 2 colonne */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Colonna sinistra */}
        <div className="lg:col-span-2 space-y-4">

          {/* Dati di contatto */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Dati di contatto</span>
                {!editingContatto ? (
                  <button onClick={startEditContatto} className="text-xs text-blue-500 hover:text-blue-700 cursor-pointer">✏️ Modifica</button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setEditingContatto(false)} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Annulla</button>
                    <Button onClick={saveContatto} loading={savingContatto} size="sm">Salva</Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardBody>
              {editingContatto ? (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Nome</label>
                      <input type="text" value={formContatto.nome} onChange={(e) => setFormContatto(p => ({ ...p, nome: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Cognome</label>
                      <input type="text" value={formContatto.cognome} onChange={(e) => setFormContatto(p => ({ ...p, cognome: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Email</label>
                    <input type="email" value={formContatto.emailContatto} onChange={(e) => setFormContatto(p => ({ ...p, emailContatto: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Telefono</label>
                    <input type="tel" value={formContatto.telefono} onChange={(e) => setFormContatto(p => ({ ...p, telefono: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                  </div>
                </div>
              ) : (
                <dl className="space-y-2 text-sm">
                  {lead.nome && (
                    <div className="flex justify-between items-center">
                      <dt className="text-gray-500">Nome</dt>
                      <dd className="font-medium text-gray-800">{lead.nome} {lead.cognome}</dd>
                    </div>
                  )}
                  {lead.emailContatto && (
                    <div className="flex justify-between items-center">
                      <dt className="text-gray-500">Email</dt>
                      <dd className="font-medium">
                        <a href={`mailto:${lead.emailContatto}`} className="text-blue-600 hover:underline">{lead.emailContatto}</a>
                      </dd>
                    </div>
                  )}
                  {lead.telefono && (
                    <div className="flex justify-between items-center">
                      <dt className="text-gray-500">Telefono</dt>
                      <dd className="font-medium">
                        <a href={`tel:${lead.telefono}`} className="text-blue-600 hover:underline">{lead.telefono}</a>
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <dt className="text-gray-500">Email inviata</dt>
                    <dd><Badge variant={lead.emailInviata ? "new" : "archived"}>{lead.emailInviata ? "Sì" : "No"}</Badge></dd>
                  </div>
                  <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-50">
                    <dt className="text-gray-500">Commerciale</dt>
                    <dd>
                      {isAdmin ? (
                        <select value={lead.commercialeAssegnato ?? ""} onChange={(e) => changeCommerciale(e.target.value)}
                          disabled={updatingCommerciale}
                          className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-800 focus:outline-none focus:border-blue-400 disabled:opacity-50 cursor-pointer bg-white">
                          <option value="">— Non assegnato —</option>
                          {utenti.map((u) => (<option key={u.id} value={u.nome}>{u.nome}</option>))}
                        </select>
                      ) : (
                        <span className={`font-medium text-sm ${lead.commercialeAssegnato ? "text-gray-800" : "text-gray-400 italic"}`}>
                          {lead.commercialeAssegnato ?? "Non assegnato"}
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              )}
            </CardBody>
          </Card>

          {/* Pipeline & Stato — unica card */}
          <Card>
            <CardHeader>
              <span className="text-sm font-medium text-gray-700">Pipeline & Stato</span>
            </CardHeader>
            <CardBody className="space-y-0">
              {/* Pipeline */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Pipeline</p>
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
              </div>

              {/* Stato tecnico */}
              <div className="border-t border-gray-100 pt-3 mt-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Stato tecnico</p>
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

              {/* Webhook — solo admin */}
              {isAdmin && (
                <div className="border-t border-gray-100 pt-3 mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Webhook</p>
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

          {/* Dati raccolti */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Dati raccolti</span>
                {!editingDati ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{Math.round(lead.completeness)}% completo</span>
                    <button onClick={startEditDati} className="text-xs text-blue-500 hover:text-blue-700 cursor-pointer">✏️ Modifica</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setEditingDati(false)} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Annulla</button>
                    <Button onClick={saveDati} loading={savingDati} size="sm">Salva</Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardBody>
              {editingDati ? (
                <div className="space-y-3 text-sm">
                  {/* Tipo cliente */}
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Tipo cliente</label>
                    <select value={formDati.clienteType ?? ""} onChange={(e) => setFormDati(p => ({ ...p, clienteType: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white">
                      <option value="AZIENDA">Azienda</option>
                      <option value="PRIVATO">Privato</option>
                      <option value="INDEFINITO">Indefinito</option>
                    </select>
                  </div>
                  {/* Campi azienda */}
                  {formDati.clienteType === "AZIENDA" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Ragione Sociale</label>
                        <input type="text" value={formDati.ragioneSociale ?? ""} onChange={(e) => setFormDati(p => ({ ...p, ragioneSociale: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Partita IVA</label>
                        <input type="text" value={formDati.partitaIVA ?? ""} onChange={(e) => setFormDati(p => ({ ...p, partitaIVA: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                      </div>
                    </div>
                  )}
                  {/* Descrizione */}
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Cosa cerca</label>
                    <textarea rows={3} value={formDati.descrizioneProdotto ?? ""} onChange={(e) => setFormDati(p => ({ ...p, descrizioneProdotto: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white resize-none" />
                  </div>
                  {/* Categoria (multi) + Brand */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Categoria</label>
                      <div className="flex flex-col gap-1.5">
                        {(["Accessori", "Ricambi", "Lubrificanti", "Vernici"] as const).map((cat) => {
                          const selected = (formDati.categoriaProdotto ?? "").split(",").map(s => s.trim()).filter(Boolean);
                          const checked = selected.includes(cat);
                          return (
                            <label key={cat} className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={checked}
                                onChange={() => {
                                  const next = checked ? selected.filter(c => c !== cat) : [...selected, cat];
                                  setFormDati(p => ({ ...p, categoriaProdotto: next.join(",") }));
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-400" />
                              <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORIA_COLORS[cat] ?? ""}`}>{cat}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Brand</label>
                      <input type="text" value={formDati.brandProdotto ?? ""} onChange={(e) => setFormDati(p => ({ ...p, brandProdotto: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                    </div>
                  </div>
                  {/* Codice + VIN */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Codice prodotto</label>
                      <input type="text" value={formDati.codiceProdotto ?? ""} onChange={(e) => setFormDati(p => ({ ...p, codiceProdotto: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">VIN</label>
                      <input type="text" value={formDati.vinCode ?? ""} onChange={(e) => setFormDati(p => ({ ...p, vinCode: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 font-mono text-sm focus:outline-none focus:border-blue-400 bg-white" />
                    </div>
                  </div>
                  {/* Note aggiuntive */}
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Note aggiuntive</label>
                    <textarea rows={2} value={formDati.noteAggiuntive ?? ""} onChange={(e) => setFormDati(p => ({ ...p, noteAggiuntive: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white resize-none" />
                  </div>
                </div>
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {fields.map(([key, val]) => {
                      const resolved = resolveValue(key, val);
                      const isVin = key === "vinCode";
                      const isCategoria = key === "categoriaProdotto";
                      const isLibretto = key === "librettoUrl";
                      return (
                        <div key={key} className="min-w-0">
                          <dt className="text-xs text-gray-400 mb-0.5">{FIELD_LABELS[key] ?? key}</dt>
                          <dd className="text-sm font-medium text-gray-800 break-words">
                            {isCategoria && resolved !== "—" ? (
                              <div className="flex flex-wrap gap-1">
                                {resolved.split(",").map((cat) => cat.trim()).filter(Boolean).map((cat) => (
                                  <span key={cat} className={`inline-block px-2 py-0.5 rounded-full text-xs ${CATEGORIA_COLORS[cat] ?? "bg-gray-100 text-gray-600"}`}>{cat}</span>
                                ))}
                              </div>
                            ) : isVin && resolved !== "—" ? (
                              <span className="font-mono text-xs bg-gray-50 px-2 py-0.5 rounded">{resolved}</span>
                            ) : isLibretto && resolved !== "—" ? (
                              <a
                                href={`/api/admin/leads/blob?url=${encodeURIComponent(resolved)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs"
                              >
                                📄 Visualizza libretto
                              </a>
                            ) : resolved === "—" ? (
                              <span className="text-gray-300 font-normal">—</span>
                            ) : resolved}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  {lead.missingFields.length > 0 && (
                    <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      Campi mancanti: {lead.missingFields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}
                    </div>
                  )}
                </>
              )}
            </CardBody>
          </Card>

          {/* Follow-up email — visibile se ci sono campi mancanti */}
          {lead.missingFields.length > 0 && lead.emailContatto && (
            <FollowUpEmailSection
              leadId={lead.id}
              emailContatto={lead.emailContatto}
              missingFields={lead.missingFields}
            />
          )}

          {/* Chat WhatsApp — visibile solo se il lead ha una conversazione WA */}
          <WaChatSection leadId={lead.id} />

        </div>

        {/* Colonna destra — sticky */}
        <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-6 lg:self-start">
          <NoteSection leadId={lead.id} initialNote={initialNote} />
          <Card>
            <CardHeader>
              <span className="text-sm font-medium text-gray-700">🕐 Cronologia attività</span>
            </CardHeader>
            <CardBody>
              <div className="max-h-72 overflow-y-auto">
                <ActivitySection leadId={lead.id} initialLogs={initialLogs} />
              </div>
            </CardBody>
          </Card>
        </div>

      </div>
    </div>
  );
}
