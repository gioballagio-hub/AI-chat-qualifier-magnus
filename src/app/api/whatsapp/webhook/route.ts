import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

    let incomingText = "";

    if (messageType === "text") {
      incomingText = message.text?.body ?? "";
    } else {
      // Tipi non supportati (audio, immagine, ecc.)
      await sendWhatsAppMessage(
        businessPhoneNumberId,
        from,
        "Ciao! Al momento gestisco solo messaggi di testo. Scrivi la tua richiesta e ti rispondo subito. 🙂"
      );
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    console.log(`[WA] Messaggio da ${from}: "${incomingText}"`);

    // Genera risposta automatica
    const reply = await generateReply(incomingText, from);

    // Invia risposta
    await sendWhatsAppMessage(businessPhoneNumberId, from, reply);

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("[WA Webhook] Errore:", error);
    return NextResponse.json({ status: "ok" }, { status: 200 }); // sempre 200 a Meta
  }
}

// ─── Genera risposta con Claude AI ────────────────────────────────────────────
async function generateReply(text: string, _from: string): Promise<string> {
  const formUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://gestione.aixum.it"}/qualifica`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system: `Sei il bot WhatsApp di *Magnus SRL*, azienda italiana specializzata in ricambi, accessori, lubrificanti e vernici per veicoli americani (pickup, SUV, muscle car: Ford, Dodge, Chevrolet, RAM, Jeep, ecc.).

Il tuo compito principale è indirizzare SUBITO il cliente a compilare il form di qualifica: ${formUrl}

Comportamento da seguire SEMPRE:
1. Saluta brevemente e riconosci cosa sta cercando il cliente
2. Spiega in UNA frase che siamo specializzati in veicoli americani
3. Chiedi di compilare il form per ricevere un preventivo personalizzato: ${formUrl}
4. Comunica che un commerciale risponde entro poche ore

Regole:
- Rispondi SEMPRE in italiano
- Sii cordiale e diretto (massimo 3-4 frasi)
- NON dare prezzi, disponibilità o dettagli tecnici: rimanda SEMPRE al form
- Includi SEMPRE il link al form nella risposta
- Usa emoji con moderazione (1-2 al massimo)`,
    messages: [{ role: "user", content: text }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return (
    textBlock?.text ??
    `Grazie per il messaggio! 🙏 Per una risposta rapida, compila il nostro form: ${formUrl}`
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
