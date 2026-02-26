import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { calcScore, calcNextStep } from "@/lib/scoring";
import { calcCompleteness } from "@/lib/completeness";
import { dispatchWebhook } from "@/lib/integration";
import { sendCustomerEmail, sendAgencyEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import type { LeadSummary, MagnusLeadData, ClienteType } from "@/types/lead";

const ContactInfoSchema = z.object({
  nome: z.string().min(1),
  cognome: z.string().min(1),
  email: z.string().email(),
  telefono: z.string().optional(),
});

const CreateLeadSchema = z.object({
  clienteType: z.enum(["AZIENDA", "PRIVATO", "INDEFINITO"]),
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

  const { clienteType, data, contactInfo, consentGiven } = parsed.data;

  // Assicura che clienteType sia incluso nel data
  const leadData: MagnusLeadData = {
    ...(data as unknown as MagnusLeadData),
    clienteType: clienteType as ClienteType,
  };

  const score = calcScore(leadData);
  const nextStep = calcNextStep(score, clienteType as ClienteType);
  const { completeness, missingFields } = calcCompleteness(leadData);
  const ipHash = hashIp(getIp(req));

  try {
    const lead = await prisma.lead.create({
      data: {
        clienteType,
        data: leadData as object,
        score,
        completeness,
        missingFields,
        nextStep,
        consentGiven,
        ipHash,
        nome: contactInfo.nome,
        cognome: contactInfo.cognome,
        emailContatto: contactInfo.email,
        telefono: contactInfo.telefono ?? null,
        // Campi estratti per ricerca rapida in dashboard
        ragioneSociale: leadData.ragioneSociale ?? null,
        partitaIVA: leadData.partitaIVA ?? null,
        categoriaProdotto: leadData.categoriaProdotto ?? null,
        brandProdotto: leadData.brandProdotto ?? null,
        codiceProdotto: leadData.codiceProdotto ?? null,
        vinCode: leadData.vinCode ?? null,
      },
    });

    const summary: LeadSummary = {
      id: lead.id,
      clienteType: lead.clienteType as ClienteType,
      data: lead.data as unknown as MagnusLeadData,
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
      emailContatto: lead.emailContatto,
      telefono: lead.telefono ?? null,
      commercialeAssegnato: lead.commercialeAssegnato ?? null,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    };

    // Esegui email + webhook dopo la risposta
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

    logger.info("Lead Magnus creato", { leadId: lead.id, clienteType, score });
    return NextResponse.json(summary, { status: 201 });
  } catch (err) {
    logger.error("Errore creazione lead", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
