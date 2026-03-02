import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const FORM_URL = "https://gestione.aixum.it/qualifica";

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
    const from = message.from;
    const messageType = message.type;
    const businessPhoneNumberId = value.metadata?.phone_number_id;

    if (messageType !== "text") {
      await sendWhatsAppMessage(
        businessPhoneNumberId,
        from,
        "Ciao! Al momento gestisco solo messaggi di testo. Scrivi la tua richiesta e ti rispondo subito. 🙂"
      );
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    const incomingText = message.text?.body ?? "";
    console.log(`[WA] Messaggio da ${from}: "${incomingText}"`);

    const reply = await generateReply(incomingText);
    await sendWhatsAppMessage(businessPhoneNumberId, from, reply);

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("[WA Webhook] Errore:", error);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }
}

// ─── Genera risposta con Claude AI ────────────────────────────────────────────
async function generateReply(text: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system: `Sei un operatore WhatsApp di Magnus SRL, specializzati in ricambi e accessori per veicoli americani.

Scrivi come una persona reale: tono amichevole, frasi corte, naturale. Mai sembrare un bot.

Regole:
- Massimo 2-3 frasi in totale
- Niente elenchi, niente grassetti, niente emoji in eccesso (al massimo 1)
- Capisci cosa vuole il cliente e mandalo al form per il preventivo
- Scrivi sempre questo link per intero, senza modificarlo: ${FORM_URL}
- Rispondi sempre in italiano`,
    messages: [{ role: "user", content: text }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return (
    textBlock?.text ??
    `Certo! Compila il form e ti ricontatto subito: ${FORM_URL}`
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
