import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { dispatchWebhook } from "@/lib/integration";
import { logger } from "@/lib/logger";
import type { LeadSummary, LeadType } from "@/types/lead";

const UpdateSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "ARCHIVED"]).optional(),
  resend: z.boolean().optional(),
});

function toSummary(l: {
  id: string;
  type: string;
  data: unknown;
  score: string;
  completeness: number;
  missingFields: unknown;
  nextStep: string;
  status: string;
  sentToIntegration: boolean;
  emailInviata: boolean;
  consentGiven: boolean;
  nome: string | null;
  cognome: string | null;
  eta: number | null;
  emailContatto: string | null;
  createdAt: Date;
  updatedAt: Date;
}): LeadSummary {
  return {
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

  if (parsed.data.resend) {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (settings?.integrationMode === "WEBHOOK" && settings.webhookUrl) {
      const summary = toSummary(lead);
      const sent = await dispatchWebhook(summary, settings);
      if (sent) updateData["sentToIntegration"] = true;
      else {
        logger.warn("Re-invio webhook fallito", { leadId: id });
      }
    }
  }

  const updated = await prisma.lead.update({ where: { id }, data: updateData });
  return NextResponse.json(toSummary(updated));
}
