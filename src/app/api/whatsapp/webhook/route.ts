import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { calcScore, calcNextStep } from "@/lib/scoring";
import { calcCompleteness } from "@/lib/completeness";
import { sendAgencyEmail } from "@/lib/email";
import type { MagnusLeadData, ContactInfo, LeadSummary } from "@/types/lead";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type ConvMessage = { role: "user" | "assistant"; content: string };

interface WaLeadData {
  nome: string;
  cognome?: string;
  email: string;
  clienteType: "PRIVATO" | "AZIENDA";
  ragioneSociale?: string;
  brandProdotto?: string;
  descrizioneProdotto: string;
  categoriaProdotto: "Ricambi" | "Accessori" | "Lubrificanti" | "Vernici";
}

const SYSTEM_PROMPT = `Sei un operatore WhatsApp di Magnus SRL, specializzati in ricambi e accessori per veicoli americani (Ford, Dodge, Chevrolet, RAM, Jeep, ecc.).

Il tuo obiettivo è raccogliere le informazioni necessarie per passare la richiesta al team commerciale.

CAMPI OBBLIGATORI da raccogliere (uno alla volta, in modo naturale):
- nome del cliente
- email (per ricontattarlo)
- tipo cliente: privato o azienda (se azienda: ragione sociale)
- descrizione di cosa cerca esattamente
- categoria prodotto: Ricambi, Accessori, Lubrificanti, o Vernici

CAMPI OPZIONALI (raccoglili se emergono naturalmente):
- cognome
- marca e modello del veicolo

STILE:
- Scrivi come una persona reale: naturale, amichevole, mai robotico
- Fai UNA domanda alla volta
- Massimo 2-3 frasi per messaggio
- Rispondi sempre in italiano
- Al massimo 1 emoji per messaggio

QUANDO HAI TUTTI I CAMPI OBBLIGATORI (nome + email + tipo cliente + descrizione + categoria):
Scrivi un messaggio di conferma naturale (es. "Perfetto [nome], ho tutto quello che mi serve. Ti ricontatteremo a [email] entro poche ore!") poi aggiungi ESATTAMENTE questo blocco JSON alla fine, senza modifiche al formato:

<LEAD_DATA>
{"nome":"...","cognome":"...","email":"...","clienteType":"PRIVATO","ragioneSociale":"","brandProdotto":"...","descrizioneProdotto":"...","categoriaProdotto":"Ricambi"}
</LEAD_DATA>

Valori validi per categoriaProdotto: "Ricambi" | "Accessori" | "Lubrificanti" | "Vernici"
Valori validi per clienteType: "PRIVATO" | "AZIENDA"
Non includere il blocco <LEAD_DATA> finché non hai TUTTI i campi obbligatori.`;

// ─── Verifica webhook (GET) ───────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("[WA Webhook] Verifica completata ✓");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[WA Webhook] Verifica fallita — token non valido");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ─── Ricezione messaggi (POST) ────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages) {
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    const message = value.messages[0];
    const from = message.from; // es. "393331234567"
    const messageType = message.type;
    const businessPhoneNumberId = value.metadata?.phone_number_id;

    if (messageType !== "text") {
      await sendWhatsAppMessage(
        businessPhoneNumberId,
        from,
        "Al momento gestisco solo messaggi di testo. Scrivi la tua richiesta e ti rispondo subito!"
      );
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    const incomingText = message.text?.body ?? "";
    console.log(`[WA] Messaggio da ${from}: "${incomingText}"`);

    // Carica o crea la conversazione per questo numero
    const conv = await prisma.waConversation.findUnique({ where: { phone: from } });

    // Se la conversazione è già completata (lead creato) → ignora
    if (conv?.completato) {
      console.log(`[WA] Conversazione già completata per ${from} — nessuna risposta automatica`);
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    const history: ConvMessage[] = conv ? (conv.messages as ConvMessage[]) : [];
    history.push({ role: "user", content: incomingText });

    // Chiama Claude con tutta la storia della conversazione
    const aiResponse = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: history,
    });

    const fullText = aiResponse.content.find((b) => b.type === "text")?.text ?? "";

    // Cerca il blocco <LEAD_DATA> nella risposta
    const { replyText, leadData } = parseLeadData(fullText);

    // Salva il testo pulito nello storico (senza il blocco JSON)
    history.push({ role: "assistant", content: replyText });

    if (leadData) {
      // Crea il lead nel DB e notifica l'agenzia
      await createLeadFromWA(leadData, from);

      // Marca la conversazione come completata
      await prisma.waConversation.upsert({
        where: { phone: from },
        create: { phone: from, messages: history, raccolto: leadData as object, completato: true },
        update: { messages: history, raccolto: leadData as object, completato: true },
      });

      console.log(`[WA] Lead creato per ${from} ✓`);
    } else {
      // Aggiorna la storia della conversazione
      await prisma.waConversation.upsert({
        where: { phone: from },
        create: { phone: from, messages: history, raccolto: {}, completato: false },
        update: { messages: history },
      });
    }

    await sendWhatsAppMessage(businessPhoneNumberId, from, replyText);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("[WA Webhook] Errore:", error);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }
}

// ─── Crea Lead nel DB dalla conversazione WA ──────────────────────────────────
async function createLeadFromWA(data: WaLeadData, phone: string): Promise<void> {
  const leadData: MagnusLeadData = {
    clienteType: data.clienteType,
    ragioneSociale: data.ragioneSociale || undefined,
    descrizioneProdotto: data.descrizioneProdotto,
    categoriaProdotto: data.categoriaProdotto,
    brandProdotto: data.brandProdotto || undefined,
  };

  const contactInfo: ContactInfo = {
    nome: data.nome,
    cognome: data.cognome ?? "",
    email: data.email,
    telefono: `+${phone}`,
  };

  const score = calcScore(leadData);
  const { completeness, missingFields } = calcCompleteness(leadData);
  const nextStep = calcNextStep(score, data.clienteType);

  const lead = await prisma.lead.create({
    data: {
      clienteType: data.clienteType,
      nome: data.nome,
      cognome: data.cognome ?? "",
      emailContatto: data.email,
      telefono: `+${phone}`,
      ragioneSociale: data.ragioneSociale || null,
      brandProdotto: data.brandProdotto || null,
      categoriaProdotto: data.categoriaProdotto,
      score,
      completeness,
      missingFields,
      nextStep,
      data: leadData as object,
      consentGiven: true,
      status: "NEW",
      statoLead: "NUOVO",
    },
  });

  // Notifica l'agenzia via email
  const summary: LeadSummary = {
    id: lead.id,
    clienteType: lead.clienteType as LeadSummary["clienteType"],
    data: leadData,
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
    telefono: lead.telefono,
    commercialeAssegnato: lead.commercialeAssegnato,
    statoLead: lead.statoLead as LeadSummary["statoLead"],
    deletedAt: lead.deletedAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };

  try {
    await sendAgencyEmail(contactInfo, summary);
  } catch (err) {
    console.error("[WA] Errore invio email agenzia:", err);
  }
}

// ─── Parsing del blocco <LEAD_DATA> dalla risposta Claude ─────────────────────
function parseLeadData(text: string): { replyText: string; leadData: WaLeadData | null } {
  const match = text.match(/<LEAD_DATA>\s*([\s\S]*?)\s*<\/LEAD_DATA>/);
  if (!match) return { replyText: text.trim(), leadData: null };

  try {
    const leadData = JSON.parse(match[1]) as WaLeadData;
    const replyText = text.replace(/<LEAD_DATA>[\s\S]*?<\/LEAD_DATA>/, "").trim();
    return { replyText, leadData };
  } catch {
    return { replyText: text.trim(), leadData: null };
  }
}

// ─── Invia messaggio WhatsApp via Cloud API ───────────────────────────────────
async function sendWhatsAppMessage(
  phoneNumberId: string,
  to: string,
  text: string
): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    console.error("[WA] WHATSAPP_ACCESS_TOKEN mancante");
    return;
  }

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.error("[WA] Errore invio messaggio:", err);
  } else {
    console.log(`[WA] Messaggio inviato a ${to} ✓`);
  }
}
