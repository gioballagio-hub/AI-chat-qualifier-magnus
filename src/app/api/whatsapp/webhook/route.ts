import { NextRequest, NextResponse } from "next/server";

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

// ─── Genera risposta automatica ───────────────────────────────────────────────
async function generateReply(text: string, _from: string): Promise<string> {
  const lowerText = text.toLowerCase();

  // Risposta base — verrà sostituita con Claude AI nella fase successiva
  if (
    lowerText.includes("ricambi") ||
    lowerText.includes("accessori") ||
    lowerText.includes("pezzo") ||
    lowerText.includes("parte")
  ) {
    return (
      "Ciao! 👋 Sono il bot di *Magnus SRL*.\n\n" +
      "Hai bisogno di ricambi o accessori per veicoli americani? " +
      "Compilare il form sul nostro sito è il modo più veloce per ricevere un preventivo: " +
      `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://gestione.aixum.it"}/qualifica\n\n` +
      "Un nostro commerciale ti risponderà entro poche ore. 🚗"
    );
  }

  if (
    lowerText.includes("ciao") ||
    lowerText.includes("salve") ||
    lowerText.includes("buongiorno") ||
    lowerText.includes("buonasera")
  ) {
    return (
      "Ciao! 👋 Sono il bot di *Magnus SRL*, specializzati in ricambi e accessori per veicoli americani.\n\n" +
      "Come posso aiutarti? Scrivimi cosa stai cercando o visita il nostro form per una richiesta veloce: " +
      `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://gestione.aixum.it"}/qualifica`
    );
  }

  if (
    lowerText.includes("prezzo") ||
    lowerText.includes("quanto costa") ||
    lowerText.includes("preventivo") ||
    lowerText.includes("offerta")
  ) {
    return (
      "Per ricevere un preventivo preciso, compila il nostro form con i dettagli del veicolo e del pezzo che cerchi: " +
      `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://gestione.aixum.it"}/qualifica\n\n` +
      "Il nostro team ti risponderà con l'offerta migliore. 💬"
    );
  }

  // Risposta generica
  return (
    "Grazie per il messaggio! 🙏\n\n" +
    "Sono il bot di *Magnus SRL*. Per ricambi, accessori, lubrificanti o vernici per veicoli americani, " +
    "il modo più veloce è compilare il nostro form: " +
    `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://gestione.aixum.it"}/qualifica\n\n` +
    "Un commerciale ti contatterà al più presto."
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
