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

// ─── Tipo per lead esistenti trovati nel DB ───────────────────────────────────
type ExistingLead = {
  id: string;
  nome: string | null;
  cognome: string | null;
  emailContatto: string | null;
  clienteType: string;
  ragioneSociale: string | null;
  brandProdotto: string | null;
  categoriaProdotto: string | null;
  score: string;
  statoLead: string;
  commercialeAssegnato: string | null;
  createdAt: Date;
  data: unknown;
};

// ─── SYSTEM_PROMPT per nuovi contatti ────────────────────────────────────────
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

// ─── SYSTEM_PROMPT per contatti già noti ─────────────────────────────────────
function buildReturningCustomerPrompt(leads: ExistingLead[]): string {
  const latest = leads[0];
  const nomeCompleto = [latest.nome, latest.cognome].filter(Boolean).join(" ");
  const knownFields = [
    `- Nome: ${nomeCompleto}`,
    latest.emailContatto ? `- Email: ${latest.emailContatto}` : null,
    `- Tipo cliente: ${latest.clienteType}`,
    latest.ragioneSociale ? `- Ragione sociale: ${latest.ragioneSociale}` : null,
  ].filter(Boolean).join("\n");

  const historyLines = leads.slice(0, 3).map((l, i) => {
    const d = l.data as MagnusLeadData;
    const desc = d.descrizioneProdotto?.slice(0, 60) || "—";
    return `  ${i + 1}. ${l.createdAt.toLocaleDateString("it-IT")} — ${l.categoriaProdotto || "—"} | ${l.brandProdotto || "—"} | ${desc}`;
  }).join("\n");

  return `Sei un operatore WhatsApp di Magnus SRL, specializzati in ricambi e accessori per veicoli americani (Ford, Dodge, Chevrolet, RAM, Jeep, ecc.).

ATTENZIONE: QUESTO È UN CONTATTO GIÀ CONOSCIUTO nel nostro database.

HAI GIÀ QUESTE INFORMAZIONI (non richiedere di nuovo):
${knownFields}

Storico richieste precedenti:
${historyLines}

COMPORTAMENTO:
- Salutalo subito per nome con calore (es. "Ciao ${latest.nome}! 👋 Bentornato da Magnus, è un piacere risentirti!")
- Fagli presente brevemente che lo riconosci come contatto/cliente
- NON chiedere mai: nome, cognome, email, tipo cliente, ragione sociale (già noti)
- Chiedi direttamente: di cosa hai bisogno oggi? nuovo veicolo o stesso di prima?
- Se il veicolo è cambiato rispetto all'ultima volta, aggiornalo
- Per Ricambi/Accessori: chiedi sempre VIN aggiornato e libretto
- Fai UNA domanda alla volta, max 2-3 frasi per messaggio
- Rispondi in italiano, stile naturale e amichevole, al massimo 1 emoji per messaggio

CAMPI DA RACCOGLIERE ORA:
- Veicolo (conferma o nuovo)
- Descrizione di cosa cerca
- Categoria (deducila dalla descrizione)
- VIN (solo per Ricambi/Accessori)
- Libretto (solo per Ricambi/Accessori)
- Se email o tipo sono cambiati, aggiornali

VERIFICA FINALE OBBLIGATORIA:
Prima di emettere <LEAD_DATA> controlla:
- Per Ricambi/Accessori: veicolo, descrizione, categoria, VIN, libretto ✓?
- Per Vernici/Lubrificanti: veicolo, descrizione, categoria ✓?

QUANDO HAI TUTTO:
Scrivi un messaggio di conferma naturale poi aggiungi ESATTAMENTE questo blocco JSON:

<LEAD_DATA>
{"nome":"${latest.nome ?? ""}","cognome":"${latest.cognome ?? ""}","email":"${latest.emailContatto ?? ""}","clienteType":"${latest.clienteType}","clienteEsistente":"SI","ragioneSociale":"${latest.ragioneSociale ?? ""}","brandProdotto":"...","descrizioneProdotto":"...","categoriaProdotto":"Ricambi","vin":"...","librettoRicevuto":"NO"}
</LEAD_DATA>

Valori validi per categoriaProdotto: "Ricambi" | "Accessori" | "Lubrificanti" | "Vernici"
Per vin: inserisci il numero di telaio se raccolto, altrimenti ""
Per librettoRicevuto: "SI" se l'utente ha inviato la foto, "NO" altrimenti`;
}

// ─── Nota di briefing per il team commerciale ────────────────────────────────
async function sendAgentBriefing(conversationId: number, leads: ExistingLead[], phone: string): Promise<void> {
  const latest = leads[0];

  const scoreEmoji = (s: string) => s === "ALTA" ? "🔴" : s === "MEDIA" ? "🟡" : "🟢";
  const statoLabel = (s: string) => ({
    NUOVO: "Nuovo", IN_LAVORAZIONE: "In lavorazione",
    OFFERTA_INVIATA: "Offerta inviata", CHIUSO_VINTO: "Chiuso ✅", CHIUSO_PERSO: "Chiuso ❌",
  }[s] ?? s);

  const prevRequests = leads.slice(0, 3).map((l, i) => {
    const d = l.data as MagnusLeadData;
    const desc = d.descrizioneProdotto?.slice(0, 80) || "—";
    return [
      `📌 Richiesta #${i + 1} — ${l.createdAt.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })}`,
      `   📦 ${l.categoriaProdotto || "—"} | 🚗 ${l.brandProdotto || "—"}`,
      `   📝 ${desc}`,
      `   ${scoreEmoji(l.score)} Score: ${l.score} | Stato: ${statoLabel(l.statoLead)}`,
      l.commercialeAssegnato ? `   👔 Commerciale: ${l.commercialeAssegnato}` : "",
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const tips: string[] = [];
  if (leads.length >= 3) tips.push("🌟 Cliente ad alta fedeltà — considera trattamento prioritario e offerta dedicata");
  if (latest.clienteType === "AZIENDA") tips.push("🏢 Cliente aziendale — verifica opportunità di accordo commerciale o listino dedicato");
  if (leads.some(l => l.score === "ALTA")) tips.push("⚡ Ha precedenti richieste ad alta priorità — coinvolgi subito un commerciale senior");
  if (latest.statoLead === "OFFERTA_INVIATA") tips.push("📋 Ultima offerta ancora in sospeso — ottima occasione per fare follow-up");
  if (latest.statoLead === "CHIUSO_VINTO") tips.push("✅ Ha già acquistato da Magnus — alta probabilità di conversione, cliente fidelizzabile");
  if (latest.statoLead === "CHIUSO_PERSO") tips.push("⚠️ In passato non ha chiuso — scopri cosa è cambiato e personalizza l'approccio");
  if (leads.length === 1) tips.push("📞 Seconda interazione — momento ideale per costruire una relazione duratura");

  const note = [
    "🔔 CONTATTO GIÀ CONOSCIUTO — Briefing per il team commerciale",
    "",
    `👤 ${[latest.nome, latest.cognome].filter(Boolean).join(" ")}${latest.ragioneSociale ? ` (${latest.ragioneSociale})` : ""}`,
    `📱 +${phone}`,
    latest.emailContatto ? `📧 ${latest.emailContatto}` : "",
    `🏷️ Tipo: ${latest.clienteType} | ${leads.length} richiesta${leads.length > 1 ? "e" : ""} in storico`,
    "",
    "📋 STORICO RICHIESTE:",
    prevRequests,
    tips.length > 0 ? "\n💡 SUGGERIMENTI PER IL COMMERCIALE:" : "",
    ...tips.map(t => `• ${t}`),
  ].filter(l => l !== "").join("\n");

  await sendPrivateNote(conversationId, note);
  console.log(`[Chatwoot Events] Briefing agenti inviato per contatto noto ${phone} (${leads.length} lead in storico)`);
}

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

// ─── Webhook regolare Chatwoot — riceve eventi per TUTTE le conversazioni ─────
// Sostituisce il chatwoot-bot/webhook (che ora è disabilitato per evitare duplicati)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Log diagnostico per capire il formato del payload (utile per debug nuovi contatti)
    console.log(`[Chatwoot Events] RAW event=${body.event} message_type=${JSON.stringify(body.message_type)} private=${body.private} conv=${body.conversation?.id} sender_phone=${body.sender?.phone_number} meta_phone=${body.conversation?.meta?.sender?.phone_number}`);

    // Solo eventi message_created
    if (body.event !== "message_created") return NextResponse.json({ ok: true });

    // Solo messaggi in arrivo dal cliente
    // Chatwoot può inviare message_type come stringa ("incoming") o numero (0)
    const isIncoming = body.message_type === "incoming" || body.message_type === 0;
    if (!isIncoming) return NextResponse.json({ ok: true });
    if (body.private) return NextResponse.json({ ok: true });

    const conversationId: number = body.conversation?.id;
    // Il numero di telefono può essere in più posti a seconda della versione Chatwoot e del tipo di contatto
    const phoneRaw: string =
      body.sender?.phone_number ??
      body.conversation?.meta?.sender?.phone_number ??
      body.meta?.sender?.phone_number ??
      "";
    const phone = phoneRaw.replace(/^\+/, "");
    const attachments: unknown[] = body.attachments ?? [];

    let incomingText: string = body.content ?? "";

    if (!conversationId || !phone) {
      console.warn("[Chatwoot Events] conversationId o phone mancanti");
      return NextResponse.json({ ok: true });
    }

    // Allegato senza testo → libretto
    if (attachments.length > 0 && !incomingText.trim()) {
      incomingText = "[LIBRETTO RICEVUTO - l'utente ha inviato la foto/scansione del libretto del veicolo]";
      console.log(`[Chatwoot Events] Allegato ricevuto da ${phone} (libretto)`);
    }

    console.log(`[Chatwoot Events] Messaggio da ${phone}: "${incomingText.slice(0, 80)}"`);

    // ─── Comando MAGNUS RESET ────────────────────────────────────────────────
    if (incomingText.trim().toUpperCase() === "MAGNUS RESET") {
      await prisma.waConversation.deleteMany({ where: { phone } });
      await sendChatwootMessage(conversationId, "Conversazione resettata. Ciao! 👋 Come posso aiutarti?");
      console.log(`[Chatwoot Events] MAGNUS RESET eseguito per ${phone}`);
      return NextResponse.json({ ok: true });
    }

    // ─── Cerca lead esistenti per questo numero (contatto già noto) ──────────
    const existingLeads = await prisma.lead.findMany({
      where: { telefono: `+${phone}`, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true, nome: true, cognome: true, emailContatto: true,
        clienteType: true, ragioneSociale: true, brandProdotto: true,
        categoriaProdotto: true, score: true, statoLead: true,
        commercialeAssegnato: true, createdAt: true, data: true,
      },
    });

    // ─── Carica conversazione dal DB ─────────────────────────────────────────
    const conv = await prisma.waConversation.findUnique({ where: { phone } });

    // ─── Gestione conversazione completata ───────────────────────────────────
    let shouldReset = false;
    if (conv?.completato) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (conv.updatedAt > thirtyDaysAgo) {
        // Entro 30 giorni → agenti gestiscono, bot silenzioso
        console.log(`[Chatwoot Events] Completato (entro 30gg) per ${phone} — agenti gestiscono`);
        return NextResponse.json({ ok: true });
      }

      // Oltre 30 giorni → riattiva bot per nuova richiesta
      console.log(`[Chatwoot Events] Riattivazione bot dopo 30+ giorni per ${phone}`);
      shouldReset = true;
      await prisma.waConversation.update({
        where: { phone },
        data: { completato: false, messages: [] },
      });
    }

    // ─── Determina se è un contatto noto che inizia una nuova chat ───────────
    const isReturningCustomer = existingLeads.length > 0;
    const history: ConvMessage[] = shouldReset ? [] : (conv ? (conv.messages as ConvMessage[]) : []);
    const isNewConversation = history.length === 0;

    // Se è un contatto noto all'inizio di una nuova chat → invia briefing agli agenti
    if (isReturningCustomer && isNewConversation) {
      await sendAgentBriefing(conversationId, existingLeads, phone);
    }

    history.push({ role: "user", content: incomingText });

    // ─── Scegli il prompt in base al tipo di contatto ────────────────────────
    const systemPrompt = isReturningCustomer ? buildReturningCustomerPrompt(existingLeads) : SYSTEM_PROMPT;

    // ─── Chiama Claude AI ────────────────────────────────────────────────────
    const aiResponse = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: history,
    });

    const fullText = aiResponse.content.find((b) => b.type === "text")?.text ?? "";
    const { replyText, leadData } = parseLeadData(fullText);

    history.push({ role: "assistant", content: replyText });

    // ─── Invia risposta al cliente via Chatwoot ──────────────────────────────
    await sendChatwootMessage(conversationId, replyText);

    if (leadData) {
      const lead = await createLeadFromWA(leadData, phone);

      await prisma.waConversation.upsert({
        where: { phone },
        create: { phone, messages: history, raccolto: leadData as object, completato: true, chatwootConversationId: conversationId },
        update: { messages: history, raccolto: leadData as object, completato: true, chatwootConversationId: conversationId },
      });

      // Nota privata agli agenti con riepilogo lead
      const librettoStatus = leadData.librettoRicevuto === "SI" ? "✅ Ricevuto" : "❌ Non inviato";
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
        `🔑 VIN: ${leadData.vin || "—"}`,
        `📄 Libretto: ${librettoStatus}`,
        "",
        `→ Vedi scheda completa nel pannello admin (Lead #${lead.id.slice(-8)})`,
      ].join("\n");

      await sendPrivateNote(conversationId, note);
      console.log(`[Chatwoot Events] Lead creato per ${phone} ✓`);
    } else {
      await prisma.waConversation.upsert({
        where: { phone },
        create: { phone, messages: history, raccolto: {}, completato: false, chatwootConversationId: conversationId },
        update: { messages: history, chatwootConversationId: conversationId },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Chatwoot Events] Errore:", error);
    return NextResponse.json({ ok: true });
  }
}

// ─── Crea Lead nel DB dalla conversazione ────────────────────────────────────
async function createLeadFromWA(data: WaLeadData, phone: string): Promise<{ id: string }> {
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
    console.error("[Chatwoot Events] Errore invio email agenzia:", err);
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
