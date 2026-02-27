import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";
import type { LeadSummary, ClienteType, MagnusLeadData, StatoLead } from "@/types/lead";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { id } = await params;

  const [lead, note, log, utenti] = await Promise.all([
    prisma.lead.findUnique({ where: { id } }),
    prisma.nota.findMany({
      where: { leadId: id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.activityLog.findMany({
      where: { leadId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    session.ruolo === "ADMIN"
      ? prisma.user.findMany({
          where: { attivo: true },
          select: { id: true, nome: true, ruolo: true, attivo: true },
          orderBy: { nome: "asc" },
        })
      : Promise.resolve([]),
  ]);

  if (!lead) {
    return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  }

  const leadSummary: LeadSummary = {
    id: lead.id,
    clienteType: lead.clienteType as ClienteType,
    data: lead.data as unknown as MagnusLeadData,
    score: lead.score as LeadSummary["score"],
    completeness: lead.completeness,
    missingFields: lead.missingFields as string[],
    nextStep: lead.nextStep,
    status: lead.status as LeadSummary["status"],
    statoLead: (lead.statoLead ?? "NUOVO") as StatoLead,
    sentToIntegration: lead.sentToIntegration,
    emailInviata: lead.emailInviata,
    consentGiven: lead.consentGiven,
    nome: lead.nome,
    cognome: lead.cognome,
    emailContatto: lead.emailContatto,
    telefono: lead.telefono ?? null,
    commercialeAssegnato: lead.commercialeAssegnato ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };

  return NextResponse.json({
    lead: leadSummary,
    note: note.map((n) => ({
      id: n.id,
      autore: n.autore,
      testo: n.testo,
      createdAt: n.createdAt.toISOString(),
    })),
    log: log.map((l) => ({
      id: l.id,
      leadId: l.leadId,
      autore: l.autore,
      azione: l.azione,
      dettagli: l.dettagli ?? null,
      createdAt: l.createdAt.toISOString(),
    })),
    utenti,
  });
}
