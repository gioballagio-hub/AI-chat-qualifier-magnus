import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";
import type { LeadSummary, ClienteType, MagnusLeadData, StatoLead } from "@/types/lead";
import type { Lead } from "@prisma/client";

// GET — lista lead nel cestino (solo ADMIN)
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || session.ruolo !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const leads = await prisma.lead.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
  });

  const summaries: (LeadSummary & { deletedAt: string })[] = (leads as Lead[]).map((l) => ({
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
    deletedAt: l.deletedAt ? l.deletedAt.toISOString() : "",
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }));

  return NextResponse.json({ leads: summaries, total: summaries.length });
}
