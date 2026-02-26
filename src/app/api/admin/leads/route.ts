import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { LeadSummary, LeadType } from "@/types/lead";
import type { Lead } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const score = searchParams.get("score");
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (score) where["score"] = score;
  if (status) where["status"] = status;
  if (type) where["type"] = type;

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

  return NextResponse.json({ leads: summaries, total, page, limit });
}
