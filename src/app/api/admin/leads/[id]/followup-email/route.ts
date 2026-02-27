import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { logger } from "@/lib/logger";
import { FIELD_LABELS } from "@/constants/questions";
import type { MagnusLeadData } from "@/types/lead";

const FIELD_LABELS_IT: Record<string, string> = {
  ...FIELD_LABELS,
  ragioneSociale: "ragione sociale",
  partitaIVA: "partita IVA",
  descrizioneProdotto: "descrizione del prodotto cercato",
  categoriaProdotto: "categoria del prodotto",
  brandProdotto: "brand di riferimento",
  codiceProdotto: "codice prodotto / part number",
  vinCode: "numero di telaio (VIN)",
  noteAggiuntive: "note aggiuntive",
  telefono: "numero di telefono",
  nome: "nome",
  cognome: "cognome",
};

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? "465", 10),
    secure: parseInt(process.env.SMTP_PORT ?? "465", 10) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// GET — genera bozza email con template fisso
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;

  const lead = await prisma.lead.findUnique({ where: { id, deletedAt: null } });
  if (!lead) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  if (!lead.emailContatto) return NextResponse.json({ error: "Nessuna email di contatto" }, { status: 400 });

  const missingFields = (lead.missingFields as string[]) ?? [];
  if (missingFields.length === 0) {
    return NextResponse.json({ error: "Nessun campo mancante" }, { status: 400 });
  }

  const data = lead.data as MagnusLeadData & Record<string, unknown>;
  const isAzienda = lead.clienteType === "AZIENDA";
  const nomePersona = [lead.nome, lead.cognome].filter(Boolean).join(" ");
  const nomeCliente = isAzienda
    ? (lead.ragioneSociale || nomePersona || "Spettabile azienda")
    : (nomePersona || "Cliente");
  const missingLabels = missingFields.map((f) => FIELD_LABELS_IT[f] ?? f);

  // Riepilogo di ciò che sappiamo già
  const datoNoti: string[] = [];
  if (data.descrizioneProdotto) datoNoti.push(`"${data.descrizioneProdotto}"`);
  if (data.categoriaProdotto) datoNoti.push(String(data.categoriaProdotto));
  if (data.brandProdotto) datoNoti.push(String(data.brandProdotto));

  const elenco = missingLabels.map((l) => `  - ${l}`).join("\n");

  // Template differenziato per AZIENDA e PRIVATO
  let draft: string;

  if (isAzienda) {
    const riepilogo = datoNoti.length > 0
      ? `In riferimento alla vostra richiesta (${datoNoti.join(", ")}), per poterti fornire un preventivo preciso abbiamo bisogno di qualche informazione in più:`
      : "Per potervi fornire un preventivo preciso, abbiamo bisogno di qualche informazione in più:";

    draft = `Gentile ${nomeCliente},

grazie per aver contattato Magnus SRL!

${riepilogo}

${elenco}

Rispondete a questa email con i dettagli richiesti e vi ricontatteremo al più presto con un preventivo su misura.

A presto,
Il Team Commerciale Magnus SRL
📞 +39 XXX XXX XXXX
✉️ ${process.env.AGENCY_EMAIL ?? "info@aixum.it"}`;
  } else {
    const riepilogo = datoNoti.length > 0
      ? `In riferimento alla tua richiesta (${datoNoti.join(", ")}), per poterti fornire un preventivo preciso abbiamo bisogno di qualche informazione in più:`
      : "Per poterti fornire un preventivo preciso, abbiamo bisogno di qualche informazione in più:";

    draft = `Gentile ${nomeCliente},

grazie per aver contattato Magnus SRL!

${riepilogo}

${elenco}

Rispondi a questa email con i dettagli richiesti e ti ricontatteremo al più presto con un preventivo su misura.

A presto,
Il Team Commerciale Magnus SRL
📞 +39 XXX XXX XXXX
✉️ ${process.env.AGENCY_EMAIL ?? "info@aixum.it"}`;
  }

  return NextResponse.json({
    draft,
    to: lead.emailContatto,
    subject: `Magnus SRL — Completamento richiesta`,
    missingFields: missingLabels,
  });
}

// POST — invia l'email (testo eventualmente modificato dall'utente)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;

  const lead = await prisma.lead.findUnique({ where: { id, deletedAt: null } });
  if (!lead) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  if (!lead.emailContatto) return NextResponse.json({ error: "Nessuna email di contatto" }, { status: 400 });

  let body: { text: string; subject?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  if (!body.text?.trim()) {
    return NextResponse.json({ error: "Testo email mancante" }, { status: 400 });
  }

  const subject = body.subject?.trim() || "Magnus SRL — Completamento richiesta";

  try {
    const transport = createTransport();
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: lead.emailContatto,
      subject,
      text: body.text,
    });

    // Log attività
    await logActivity({
      leadId: id,
      autore: session.nome ?? "Admin",
      azione: "FOLLOWUP_EMAIL_INVIATA",
      dettagli: { to: lead.emailContatto, subject },
    });

    logger.info("[followup-email] Email inviata", { leadId: id, to: lead.emailContatto });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[followup-email] Errore invio email", {
      error: err instanceof Error ? err.message : String(err),
      leadId: id,
    });
    return NextResponse.json({ error: "Errore invio email" }, { status: 500 });
  }
}
