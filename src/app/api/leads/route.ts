import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { calcScore, calcNextStep } from "@/lib/scoring";
import { calcCompleteness } from "@/lib/completeness";
import { dispatchWebhook } from "@/lib/integration";
import { sendCustomerEmail, sendAgencyEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import type { LeadSummary, LeadType, BuyerData, SellerData } from "@/types/lead";

const ContactInfoSchema = z.object({
  nome: z.string().min(1),
  cognome: z.string().min(1),
  eta: z.number().int().min(18).max(99),
  email: z.string().email(),
});

const CreateLeadSchema = z.object({
  type: z.enum(["BUYER", "SELLER"]),
  data: z.record(z.string(), z.unknown()),
  contactInfo: ContactInfoSchema,
  consentGiven: z.literal(true),
});

function hashIp(ip: string): string {
  return createHash("sha256").update(ip + (process.env.IP_SALT ?? "salt")).digest("hex");
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = CreateLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { type, data, contactInfo, consentGiven } = parsed.data;
  const leadType = type as LeadType;
  const leadData = data as BuyerData | SellerData;

  const score = calcScore(leadType, leadData);
  const nextStep = calcNextStep(leadType, score);
  const { completeness, missingFields } = calcCompleteness(leadType, leadData);
  const ipHash = hashIp(getIp(req));

  try {
    const lead = await prisma.lead.create({
      data: {
        type: leadType,
        data: leadData as object,
        score,
        completeness,
        missingFields,
        nextStep,
        consentGiven,
        ipHash,
        nome: contactInfo.nome,
        cognome: contactInfo.cognome,
        eta: contactInfo.eta,
        emailContatto: contactInfo.email,
      },
    });

    const summary: LeadSummary = {
      id: lead.id,
      type: lead.type as LeadType,
      data: lead.data as BuyerData | SellerData,
      score: lead.score as LeadSummary["score"],
      completeness: lead.completeness,
      missingFields: lead.missingFields as string[],
      nextStep: lead.nextStep,
      status: lead.status as LeadSummary["status"],
      sentToIntegration: lead.sentToIntegration,
      emailInviata: lead.emailInviata,
      consentGiven: lead.consentGiven,
      nome: lead.nome,
      cognome: lead.cognome,
      eta: lead.eta,
      emailContatto: lead.emailContatto,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    };

    // Esegui email + webhook dopo la risposta (after garantisce completamento su Vercel)
    after(async () => {
      // Email invio
      try {
        await Promise.all([
          sendCustomerEmail(contactInfo, summary),
          sendAgencyEmail(contactInfo, summary),
        ]);
        await prisma.lead.update({
          where: { id: lead.id },
          data: { emailInviata: true },
        });
      } catch (err) {
        logger.error("Errore invio email", {
          leadId: lead.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Webhook dispatch
      try {
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        if (settings?.integrationMode === "WEBHOOK" && settings.webhookUrl) {
          const sent = await dispatchWebhook(summary, settings);
          if (sent) {
            await prisma.lead.update({
              where: { id: lead.id },
              data: { sentToIntegration: true },
            });
          }
        }
      } catch (err) {
        logger.error("Errore dispatch webhook", {
          leadId: lead.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    logger.info("Lead creato", { leadId: lead.id, type: leadType, score });
    return NextResponse.json(summary, { status: 201 });
  } catch (err) {
    logger.error("Errore creazione lead", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
