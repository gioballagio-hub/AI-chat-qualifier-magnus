import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  extractLeadFromEmail,
  calcolaScore,
  calcolaCompletezza,
  calcolaMissingFields,
} from "@/lib/ai-extract";
import { logger } from "@/lib/logger";
import type { ClienteType } from "@/types/lead";

// Payload Postmark Inbound Webhook
interface PostmarkPayload {
  FromFull?: { Email?: string; Name?: string };
  From?: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  StrippedTextReply?: string;
  MessageID?: string;
  Date?: string;
}

// Rimuove tag HTML in modo minimale
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

export async function POST(req: NextRequest) {
  // 1. Verifica secret nel query param
  const secret = req.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.POSTMARK_WEBHOOK_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    logger.warn("[inbound/email] Secret non valido o mancante");
    // Ritorna 200 per evitare retry di Postmark, ma logga il problema
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 200 });
  }

  // 2. Parsing payload
  let payload: PostmarkPayload;
  try {
    payload = await req.json();
  } catch {
    logger.warn("[inbound/email] Payload JSON non valido");
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 200 });
  }

  const fromEmail =
    payload.FromFull?.Email ?? payload.From?.match(/<(.+)>/)?.[1] ?? payload.From ?? "";
  const fromName = payload.FromFull?.Name ?? fromEmail.split("@")[0] ?? "";
  const subject = payload.Subject ?? "(senza oggetto)";

  // Usa TextBody se disponibile, altrimenti HtmlBody stripped
  const bodyRaw = payload.TextBody?.trim()
    ? payload.TextBody
    : payload.HtmlBody
    ? stripHtml(payload.HtmlBody)
    : "";

  const body = bodyRaw || payload.StrippedTextReply || "";

  if (!fromEmail || !body) {
    logger.warn("[inbound/email] Email senza mittente o corpo", { fromEmail, subject });
    return NextResponse.json({ ok: false, reason: "missing_data" }, { status: 200 });
  }

  logger.info("[inbound/email] Email ricevuta", { fromEmail, subject, bodyLength: body.length });

  // 3. Estrazione lead con Claude AI
  let extracted;
  try {
    extracted = await extractLeadFromEmail(fromEmail, fromName, subject, body);
  } catch (err) {
    logger.error("[inbound/email] Errore estrazione AI", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, reason: "ai_error" }, { status: 200 });
  }

  if (!extracted) {
    logger.warn("[inbound/email] Estrazione AI fallita, nessun risultato");
    return NextResponse.json({ ok: true, reason: "extraction_failed" }, { status: 200 });
  }

  // 4. Se non è un lead commerciale rilevante, ignora
  if (!extracted.isLeadRelevante) {
    logger.info("[inbound/email] Email non rilevante", {
      motivo: extracted.motivoNonRelevante,
      fromEmail,
    });
    return NextResponse.json({
      ok: true,
      rilevante: false,
      motivo: extracted.motivoNonRelevante,
    });
  }

  // 5. Costruisce il lead data (oggetto libero — i campi extra vanno nel JSON data)
  const clienteType: ClienteType = extracted.clienteType as ClienteType;

  const leadData = {
    clienteType,
    descrizioneProdotto: extracted.descrizioneProdotto,
    ragioneSociale: extracted.ragioneSociale,
    partitaIVA: extracted.partitaIVA,
    categoriaProdotto: extracted.categoriaProdotto,
    brandProdotto: extracted.brandProdotto,
    codiceProdotto: extracted.codiceProdotto,
    vinCode: extracted.vinCode,
    noteAggiuntive: extracted.noteAggiuntive,
    // Metadati origine (salvati nel JSON data per tracciabilità)
    fonte: "EMAIL_INBOUND",
    emailOrigineOggetto: subject,
  };

  const score = calcolaScore(extracted);
  const completeness = calcolaCompletezza(extracted, fromEmail);
  const missingFields = calcolaMissingFields(extracted, fromEmail);
  const nextStep = extracted.nextStep;

  // 6. Crea il lead nel DB
  try {
    const lead = await prisma.lead.create({
      data: {
        clienteType,
        data: leadData as object,
        score,
        completeness,
        missingFields,
        nextStep,
        consentGiven: false, // email inbound: nessun consenso esplicito
        nome: extracted.nome ?? null,
        cognome: extracted.cognome ?? null,
        emailContatto: fromEmail,
        telefono: extracted.telefono ?? null,
        ragioneSociale: extracted.ragioneSociale ?? null,
        partitaIVA: extracted.partitaIVA ?? null,
        categoriaProdotto: extracted.categoriaProdotto ?? null,
        brandProdotto: extracted.brandProdotto ?? null,
        codiceProdotto: extracted.codiceProdotto ?? null,
        vinCode: extracted.vinCode ?? null,
      },
    });

    // Log attività
    await prisma.activityLog.create({
      data: {
        leadId: lead.id,
        autore: "Sistema",
        azione: "LEAD_CREATO_DA_EMAIL",
        dettagli: JSON.stringify({
          fromEmail,
          subject,
          score,
          completeness,
        }),
      },
    });

    logger.info("[inbound/email] Lead creato da email", {
      leadId: lead.id,
      fromEmail,
      clienteType,
      score,
      completeness,
    });

    return NextResponse.json({
      ok: true,
      rilevante: true,
      leadId: lead.id,
      score,
      completeness,
    });
  } catch (err) {
    logger.error("[inbound/email] Errore creazione lead", {
      error: err instanceof Error ? err.message : String(err),
      fromEmail,
    });
    return NextResponse.json({ ok: false, reason: "db_error" }, { status: 200 });
  }
}
