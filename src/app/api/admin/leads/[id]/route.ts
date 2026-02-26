import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { dispatchWebhook } from "@/lib/integration";
import { logger } from "@/lib/logger";
import { getSessionFromCookies } from "@/lib/auth";
import { sendCommercialEmail } from "@/lib/email";
import { logActivity } from "@/lib/activity";
import type { LeadSummary, ClienteType, MagnusLeadData, StatoLead } from "@/types/lead";

const UpdateSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "ARCHIVED"]).optional(),
  statoLead: z.enum(["NUOVO", "IN_LAVORAZIONE", "OFFERTA_INVIATA", "CHIUSO_VINTO", "CHIUSO_PERSO"]).optional(),
  commercialeAssegnato: z.string().nullable().optional(),
  resend: z.boolean().optional(),
});

function toSummary(l: {
  id: string;
  clienteType: string;
  data: unknown;
  score: string;
  completeness: number;
  missingFields: unknown;
  nextStep: string;
  status: string;
  statoLead: string;
  sentToIntegration: boolean;
  emailInviata: boolean;
  consentGiven: boolean;
  nome: string | null;
  cognome: string | null;
  emailContatto: string | null;
  telefono: string | null;
  commercialeAssegnato: string | null;
  createdAt: Date;
  updatedAt: Date;
}): LeadSummary {
  return {
    id: l.id,
    clienteType: l.clienteType as ClienteType,
    data: l.data as MagnusLeadData,
    score: l.score as LeadSummary["score"],
    completeness: l.completeness,
    missingFields: l.missingFields as string[],
    nextStep: l.nextStep,
    status: l.status as LeadSummary["status"],
    statoLead: l.statoLead as StatoLead,
    sentToIntegration: l.sentToIntegration,
    emailInviata: l.emailInviata,
    consentGiven: l.consentGiven,
    nome: l.nome,
    cognome: l.cognome,
    emailContatto: l.emailContatto,
    telefono: l.telefono,
    commercialeAssegnato: l.commercialeAssegnato,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  return NextResponse.json(toSummary(lead));
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (parsed.data.status) updateData["status"] = parsed.data.status;
  if (parsed.data.statoLead) updateData["statoLead"] = parsed.data.statoLead;
  if (parsed.data.commercialeAssegnato !== undefined) {
    updateData["commercialeAssegnato"] = parsed.data.commercialeAssegnato;
  }

  if (parsed.data.resend) {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (settings?.integrationMode === "WEBHOOK" && settings.webhookUrl) {
      const summary = toSummary(lead);
      const sent = await dispatchWebhook(summary, settings);
      if (sent) updateData["sentToIntegration"] = true;
      else logger.warn("Re-invio webhook fallito", { leadId: id });
    }
  }

  const updated = await prisma.lead.update({ where: { id }, data: updateData });
  return NextResponse.json(toSummary(updated));
}

// PATCH dedicato per aggiornamento rapido commerciale assegnato
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (parsed.data.status) updateData["status"] = parsed.data.status;
  if (parsed.data.statoLead) updateData["statoLead"] = parsed.data.statoLead;

  const nuovoCommerciale = parsed.data.commercialeAssegnato;
  const vecchioCommerciale = lead.commercialeAssegnato;
  if (nuovoCommerciale !== undefined) {
    updateData["commercialeAssegnato"] = nuovoCommerciale;
  }

  const updated = await prisma.lead.update({ where: { id }, data: updateData });
  const summary = toSummary(updated);

  // Activity log — pipeline
  if (parsed.data.statoLead && parsed.data.statoLead !== lead.statoLead) {
    await logActivity({
      leadId: id,
      autore: session.nome,
      azione: "PIPELINE_AGGIORNATO",
      dettagli: { da: lead.statoLead, a: parsed.data.statoLead },
    });
  }

  // Activity log — stato
  if (parsed.data.status && parsed.data.status !== lead.status) {
    await logActivity({
      leadId: id,
      autore: session.nome,
      azione: "STATO_AGGIORNATO",
      dettagli: { da: lead.status, a: parsed.data.status },
    });
  }

  // Invia email al commerciale se è stato appena assegnato (nome diverso dal precedente)
  if (nuovoCommerciale && nuovoCommerciale !== vecchioCommerciale) {
    try {
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      const notificheAbilitate = settings?.notificheEmailCommerciale ?? true;
      if (notificheAbilitate) {
        const utente = await prisma.user.findFirst({
          where: { nome: nuovoCommerciale, attivo: true },
          select: { email: true, nome: true },
        });
        if (utente?.email) {
          await sendCommercialEmail(utente.email, utente.nome, summary);
          logger.info("Email notifica inviata al commerciale", { commerciale: nuovoCommerciale, leadId: id });
        }
      } else {
        logger.info("Notifiche email commerciale disabilitate, skip invio", { leadId: id });
      }
    } catch (err) {
      logger.warn("Invio email commerciale fallito", {
        error: err instanceof Error ? err.message : String(err),
        leadId: id,
      });
    }

    // Activity log — assegnazione commerciale
    await logActivity({
      leadId: id,
      autore: session.nome,
      azione: "COMMERCIALE_ASSEGNATO",
      dettagli: { da: vecchioCommerciale, a: nuovoCommerciale },
    });
  }

  return NextResponse.json(summary);
}

// DELETE — soft delete, solo ADMIN
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session || session.ruolo !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });

  // Soft delete: imposta deletedAt invece di cancellare
  await prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
  await logActivity({ leadId: id, autore: session.nome, azione: "LEAD_ELIMINATO" });
  return NextResponse.json({ ok: true });
}
