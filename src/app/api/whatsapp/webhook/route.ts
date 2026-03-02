import { NextRequest, NextResponse, after } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const FORM_URL = "https://gestione.aixum.it/qualifica";
const DEBOUNCE_MS = 10_000; // attendi 10 secondi prima di rispondere

// ─── Verifica webhook (GET) — richiesta da Meta al momento della configurazione ───
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

// ─── Ricezione messaggi (POST) — Meta invia qui i messaggi in arrivo ───
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Ignora notifiche di stato (delivered, read, ecc.)
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages) {
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    const message = value.messages[0];
    const from = message.from; // numero mittente (es. "393331234567")
    const messageType = message.type;
    const businessPhoneNumberId = value.metadata?.phone_number_id;

    if (messageType !== "text") {
      // Tipi non supportati (audio, immagine, ecc.) — risposta immediata
      await sendWhatsAppMessage(
        businessPhoneNumberId,
        from,
        "Ciao! Al momento gestisco solo messaggi di testo. Scrivi la tua richiesta e ti rispondo subito. 🙂"
      );
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    const incomingText = message.text?.body ?? "";
    console.log(`[WA] Messaggio da ${from}: "${incomingText}"`);

    // Salva il messaggio in DB
    await prisma.waMessage.create({
      data: {
        phone: from,
        text: incomingText,
        phoneNumberId: businessPhoneNumberId,
      },
    });

    // Risponde a Meta subito — l'elaborazione avviene in background dopo il debounce
    after(async () => {
      await processDebounced(from, businessPhoneNumberId);
    });

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("[WA Webhook] Errore:", error);
    return NextResponse.json({ status: "ok" }, { status: 200 }); // sempre 200 a Meta
  }
}

// ─── Debounce: aspetta, poi processa solo se nessun messaggio più recente ─────
async function processDebounced(phone: string, phoneNumberId: string) {
  await sleep(DEBOUNCE_MS);

  // Controlla se è arrivato un messaggio più recente dallo stesso utente
  const latest = await prisma.waMessage.findFirst({
    where: { phone, processed: false },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) return; // già tutto processato

  const msSinceLast = Date.now() - latest.createdAt.getTime();
  if (msSinceLast < DEBOUNCE_MS) {
    // C'è un messaggio recente — il suo timer gestirà tutto
    console.log(`[WA] Debounce skip per ${phone} — attendo messaggio più recente`);
    return;
  }

  // Nessun messaggio recente — recupera tutti i pending e processa insieme
  const pending = await prisma.waMessage.findMany({
    where: { phone, processed: false },
    orderBy: { createdAt: "asc" },
  });

  if (pending.length === 0) return;

  // Marca tutti come processati prima di chiamare Claude (evita doppi invii)
  await prisma.waMessage.updateMany({
    where: { phone, processed: false },
    data: { processed: true },
  });

  const combinedText = pending.map((m) => m.text).join("\n");
  console.log(`[WA] Processo ${pending.length} messaggio/i da ${phone}: "${combinedText}"`);

  const reply = await generateReply(combinedText, phone);
  await sendWhatsAppMessage(phoneNumberId, phone, reply);
}

// ─── Genera risposta con Claude AI ────────────────────────────────────────────
async function generateReply(text: string, _from: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system: `Sei un operatore WhatsApp di Magnus SRL, specializzati in ricambi e accessori per veicoli americani.

Scrivi come una persona reale: tono amichevole, frasi corte, naturale. Mai sembrare un bot.

Regole:
- Massimo 2-3 frasi in totale
- Niente elenchi, niente grassetti, niente emoji in eccesso (al massimo 1)
- Capisci cosa vuole il cliente e mandalo al form per il preventivo: ${FORM_URL}
- Scrivi il link per intero, senza modificarlo
- Rispondi sempre in italiano`,
    messages: [{ role: "user", content: text }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return (
    textBlock?.text ??
    `Grazie per il messaggio! 🙏 Per una risposta rapida, compila il nostro form: ${FORM_URL}`
  );
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

// ─── Utility ──────────────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
