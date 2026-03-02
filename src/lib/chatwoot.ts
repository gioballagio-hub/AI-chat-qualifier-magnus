// ─── Chatwoot API Helper ──────────────────────────────────────────────────────
// Usato dal bot Chatwoot per inviare messaggi e note private agli agenti.

const CHATWOOT_URL = process.env.CHATWOOT_URL ?? "";
const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID ?? "1";
const BOT_TOKEN = process.env.CHATWOOT_BOT_ACCESS_TOKEN ?? "";

function chatwootHeaders() {
  return {
    "api_access_token": BOT_TOKEN,
    "Content-Type": "application/json",
  };
}

// ─── Invia messaggio visibile al cliente ──────────────────────────────────────
export async function sendChatwootMessage(
  conversationId: number,
  content: string
): Promise<void> {
  if (!CHATWOOT_URL || !BOT_TOKEN) {
    console.error("[Chatwoot] Variabili env mancanti (CHATWOOT_URL / CHATWOOT_BOT_ACCESS_TOKEN)");
    return;
  }

  const url = `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conversationId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: chatwootHeaders(),
    body: JSON.stringify({
      content,
      message_type: "outgoing",
      private: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[Chatwoot] Errore invio messaggio conv #${conversationId}:`, err);
  } else {
    console.log(`[Chatwoot] Messaggio inviato → conv #${conversationId} ✓`);
  }
}

// ─── Invia nota privata (visibile solo agli agenti, non al cliente) ───────────
export async function sendPrivateNote(
  conversationId: number,
  content: string
): Promise<void> {
  if (!CHATWOOT_URL || !BOT_TOKEN) {
    console.error("[Chatwoot] Variabili env mancanti");
    return;
  }

  const url = `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conversationId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: chatwootHeaders(),
    body: JSON.stringify({
      content,
      message_type: "outgoing",
      private: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[Chatwoot] Errore nota privata conv #${conversationId}:`, err);
  } else {
    console.log(`[Chatwoot] Nota privata inviata → conv #${conversationId} ✓`);
  }
}
