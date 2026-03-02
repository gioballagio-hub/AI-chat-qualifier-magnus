import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { calcScore, calcNextStep } from "@/lib/scoring";
import { calcCompleteness } from "@/lib/completeness";
import { sendAgencyEmail } from "@/lib/email";
import { sendChatwootMessage, sendPrivateNote } from "@/lib/chatwoot";
import type { MagnusLeadData, ContactInfo, LeadSummary } from "@/types/lead";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type ConvMessage = { role: "user" | "assistant"; content: string };

// ─── Stesso SYSTEM_PROMPT del webhook WhatsApp ────────────────────────────────
const SYSTEM_PROMPT = `Sei un operatore WhatsApp di Magnus SRL, specializzati in ricambi e accessori per veicoli americani (Ford, Dodge, Chevrolet, RAM, Jeep, ecc.).

Il tuo obiettivo è raccogliere TUTTE le informazioni necessarie per compilare la scheda cliente al 100% e passarla al team commerciale.

CAMPI OBBLIGATORI da raccogliere (uno alla volta, in modo naturale):
- nome del cliente
- cognome
- se ha già acquistato da Magnus in passato (sì o no)
- email (per ricontattarlo)
- tipo cliente: privato o azienda (se azienda: ragione sociale)
- marca e modello del veicolo (es. "Ford F-150 2019")
- descrizione di cosa cerca esattamente
- categoria prodotto: deducila dalla descrizione del cliente (Ricambi, Accessori, Lubrificanti, o Vernici)
- VIN (numero di telaio, 17 caratteri): OBBLIGATORIO solo se la categoria è Ricambi o Accessori. NON richiederlo per Vernici o Lubrificanti.
- FOTO o scansione del libretto del veicolo: OBBLIGATORIA solo se la categoria è Ricambi o Accessori. NON richiederla per Vernici o Lubrificanti. Quando la chiedi, specifica che possono oscurare i dati sensibili (nome, indirizzo) se vogliono. Quando l'utente invia una foto (vedrai "[LIBRETTO RICEVUTO]" nella conversazione), confermala e vai avanti.

STILE:
- Scrivi come una persona reale: naturale, amichevole, mai robotico
- Fai UNA domanda alla volta
- Massimo 2-3 frasi per messaggio
- Rispondi sempre in italiano
- Al massimo 1 emoji per messaggio

VERIFICA FINALE OBBLIGATORIA:
Prima di emettere il blocco <LEAD_DATA>, fai mentalmente un check di tutti i campi obbligatori per la categoria del cliente:
- Per Ricambi/Accessori: nome, cognome, clienteEsistente, email, clienteType, veicolo, descrizione, categoria, VIN, libretto ✓?
- Per Vernici/Lubrificanti: nome, cognome, clienteEsistente, email, clienteType, veicolo, descrizione, categoria ✓?
Se manca qualcosa, chiedilo prima di chiudere. Solo quando hai TUTTO emetti il blocco.

QUANDO HAI TUTTI I CAMPI OBBLIGATORI:
Scrivi un messaggio di conferma naturale (es. "Perfetto [nome], ho tutto quello che mi serve. Ti ricontatteremo a [email] entro poche ore!") poi aggiungi ESATTAMENTE questo blocco JSON alla fine, senza modifiche al formato:

<LEAD_DATA>
{"nome":"...","cognome":"...","email":"...","clienteType":"PRIVATO","clienteEsistente":"SI","ragioneSociale":"","brandProdotto":"...","descrizioneProdotto":"...","categoriaProdotto":"Ricambi","vin":"...","librettoRicevuto":"SI"}
</LEAD_DATA>

Valori validi per categoriaProdotto: "Ricambi" | "Accessori" | "Lubrificanti" | "Vernici"
Valori validi per clienteType: "PRIVATO" | "AZIENDA"
Per vin: inserisci il numero di telaio se raccolto, altrimenti stringa vuota ""
Per clienteEsistente: "SI" se ha già acquistato da Magnus, "NO" se è la prima volta
Per librettoRicevuto: "SI" se l'utente ha inviato la foto/scansione, "NO" altrimenti (o "" per categorie che non lo richiedono)
Non includere il blocco <LEAD_DATA> finché non hai TUTTI i campi obbligatori.`;

interface WaLeadData {
  nome: string;
  cognome?: string;
  email: string;
  clienteType: "PRIVATO" | "AZIENDA";
  clienteEsistente?: "SI" | "NO";
  ragioneSociale?: string;
  brandProdotto?: string;
  descrizioneProdotto: string;
  categoriaProdotto: "Ricambi" | "Accessori" | "Lubrificanti" | "Vernici";
  vin?: string;
  librettoRicevuto?: "SI" | "NO";
}

// ─── Ricezione eventi da Chatwoot Agent Bot (POST) ────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Logga il tipo di evento ricevuto
    console.log(`[Chatwoot Bot] Evento ricevuto: ${body.event}`);

    // Processa solo messaggi in arrivo dal cliente
    if (body.event !== "message_created") {
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    const messageType = body.data?.message?.message_type;
    if (messageType !== "incoming") {
      // Ignora messaggi in uscita (evita loop)
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    // Estrai dati dalla conversazione Chatwoot
    const conversationId: number = body.data?.conversation?.id;
    const phoneRaw: string = body.data?.contact?.phone_number ?? "";
    // Chatwoot invia "+393331234567" → noi usiamo "393331234567" come chiave
    const phone = phoneRaw.replace(/^\+/, "");
    const attachments: unknown[] = body.data?.message?.attachments ?? [];

    let incomingText = body.data?.message?.content ?? "";

    // Se il messaggio ha allegati (foto libretto) e il testo è vuoto
    if (attachments.length > 0 && !incomingText.trim()) {
      incomingText = "[LIBRETTO RICEVUTO - l'utente ha inviato la foto/scansione del libretto del veicolo]";
      console.log(`[Chatwoot Bot] Allegato ricevuto da ${phone} (libretto)`);
    }

    if (!phone || !conversationId) {
      console.warn("[Chatwoot Bot] phone o conversationId mancanti nel payload");
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    console.log(`[Chatwoot Bot] Messaggio da ${phone}: "${incomingText.slice(0, 80)}"`);

    // ─── Comando reset conversazione ──────────────────────────────────────────
    if (incomingText.trim().toUpperCase() === "MAGNUS RESET") {
      await prisma.waConversation.deleteMany({ where: { phone } });
      await sendChatwootMessage(conversationId, "Conversazione resettata. Ciao! 👋 Come posso aiutarti?");
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    // ─── Carica conversazione dal DB ──────────────────────────────────────────
    const conv = await prisma.waConversation.findUnique({ where: { phone } });

    // Conversazione già completata → agenti gestiscono, bot silenzioso
    if (conv?.completato) {
      console.log(`[Chatwoot Bot] Conversazione già completata per ${phone} — agenti gestiscono`);
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    const history: ConvMessage[] = conv ? (conv.messages as ConvMessage[]) : [];
    history.push({ role: "user", content: incomingText });

    // ─── Chiama Claude AI ──────────────────────────────────────────────────────
    const aiResponse = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: history,
    });

    const fullText = aiResponse.content.find((b) => b.type === "text")?.text ?? "";
    const { replyText, leadData } = parseLeadData(fullText);

    // Salva il testo pulito nello storico (senza blocco JSON)
    history.push({ role: "assistant", content: replyText });

    // ─── Invia risposta al cliente via Chatwoot ────────────────────────────────
    await sendChatwootMessage(conversationId, replyText);

    if (leadData) {
      // Crea il lead nel DB e notifica l'agenzia via email
      const lead = await createLeadFromWA(leadData, phone);

      // Marca la conversazione come completata
      await prisma.waConversation.upsert({
        where: { phone },
        create: { phone, messages: history, raccolto: leadData as object, completato: true },
        update: { messages: history, raccolto: leadData as object, completato: true },
      });

      // ─── Nota privata agli agenti in Chatwoot ─────────────────────────────
      const librettoStatus = leadData.librettoRicevuto === "SI" ? "✅ Ricevuto" : "❌ Non inviato";
      const vinStatus = leadData.vin ? leadData.vin : "—";
      const note = [
        "📋 Lead qualificato automaticamente dal bot",
        "",
        `👤 Cliente: ${leadData.nome} ${leadData.cognome ?? ""}`,
        `📧 Email: ${leadData.email}`,
        `📱 Telefono: +${phone}`,
        `🏢 Tipo: ${leadData.clienteType}${leadData.ragioneSociale ? ` — ${leadData.ragioneSociale}` : ""}`,
        `🔄 Cliente esistente: ${leadData.clienteEsistente === "SI" ? "Sì" : "No"}`,
        "",
        `📦 Categoria: ${leadData.categoriaProdotto}`,
        `🚗 Veicolo: ${leadData.brandProdotto ?? "—"}`,
        `📝 Descrizione: ${leadData.descrizioneProdotto}`,
        `🔑 VIN: ${vinStatus}`,
        `📄 Libretto: ${librettoStatus}`,
        "",
        `→ Vedi scheda completa nel pannello admin (Lead #${lead.id.slice(-8)})`,
      ].join("\n");

      await sendPrivateNote(conversationId, note);

      console.log(`[Chatwoot Bot] Lead creato per ${phone} ✓`);
    } else {
      // Aggiorna storia conversazione
      await prisma.waConversation.upsert({
        where: { phone },
        create: { phone, messages: history, raccolto: {}, completato: false },
        update: { messages: history },
      });
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("[Chatwoot Bot] Errore:", error);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }
}

// ─── Crea Lead nel DB dalla conversazione ────────────────────────────────────
async function createLeadFromWA(
  data: WaLeadData,
  phone: string
): Promise<{ id: string }> {
  const leadData: MagnusLeadData = {
    clienteType: data.clienteType,
    clienteEsistente: data.clienteEsistente || undefined,
    ragioneSociale: data.ragioneSociale || undefined,
    descrizioneProdotto: data.descrizioneProdotto,
    categoriaProdotto: data.categoriaProdotto,
    brandProdotto: data.brandProdotto || undefined,
    vinCode: data.vin || undefined,
    noteAggiuntive: data.librettoRicevuto === "SI" ? "📄 Libretto inviato via WhatsApp" : undefined,
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

  // Notifica email all'agenzia
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
    console.error("[Chatwoot Bot] Errore invio email agenzia:", err);
  }

  return { id: lead.id };
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
