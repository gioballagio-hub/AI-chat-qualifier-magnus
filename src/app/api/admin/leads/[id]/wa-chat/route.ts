import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

const CHATWOOT_URL = process.env.CHATWOOT_URL ?? "";
const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID ?? "1";
const BOT_TOKEN = process.env.CHATWOOT_BOT_ACCESS_TOKEN ?? "";
// Token utente completo — usato per letture (contact search, GET messages)
const API_TOKEN = process.env.CHATWOOT_API_TOKEN || BOT_TOKEN;

type ChatMessage = { role: "user" | "assistant"; content: string };

// ─── Cerca la conversazione Chatwoot più recente per numero di telefono ───────
async function findChatwootConversationByPhone(phone: string): Promise<number | null> {
  try {
    const searchRes = await fetch(
      `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts/search?q=%2B${phone}&page=1`,
      { headers: { "api_access_token": API_TOKEN } }
    );
    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const contact = searchData.payload?.[0];
    if (!contact?.id) return null;

    const convRes = await fetch(
      `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts/${contact.id}/conversations`,
      { headers: { "api_access_token": API_TOKEN } }
    );
    if (!convRes.ok) return null;

    const convData = await convRes.json();
    const conversations: Array<{ id: number }> = convData.payload ?? [];
    if (!conversations.length) return null;

    return conversations.sort((a, b) => b.id - a.id)[0].id;
  } catch {
    return null;
  }
}

// ─── Legge i messaggi direttamente dall'API Chatwoot (real-time) ─────────────
async function fetchChatwootMessages(conversationId: number): Promise<ChatMessage[]> {
  try {
    const res = await fetch(
      `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conversationId}/messages`,
      { headers: { "api_access_token": API_TOKEN } }
    );
    if (!res.ok) return [];

    const data = await res.json();
    const msgs: Array<{
      message_type: number;
      content: string | null;
      private: boolean;
      created_at: number;
      attachments?: Array<{ file_type: string }>;
    }> = data.payload ?? [];

    return msgs
      .filter((m) => (m.message_type === 0 || m.message_type === 1) && !m.private)
      .sort((a, b) => a.created_at - b.created_at)
      .map((m) => {
        let content = m.content?.trim() ?? "";
        if (!content && m.attachments?.length) {
          content = "📎 Allegato ricevuto";
        }
        return {
          role: (m.message_type === 0 ? "user" : "assistant") as "user" | "assistant",
          content,
        };
      })
      .filter((m) => m.content.length > 0);
  } catch {
    return [];
  }
}

// GET — Legge messaggi da Chatwoot direttamente (real-time), con fallback al DB
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id }, select: { telefono: true } });

  if (!lead?.telefono) return NextResponse.json({ messages: [], hasPhone: false });

  const phone = lead.telefono.replace(/^\+/, "");
  const conv = await prisma.waConversation.findUnique({ where: { phone } });

  // Cerca il chatwootConversationId: prima nel DB, poi via ricerca Chatwoot API
  let chatwootConvId = conv?.chatwootConversationId ?? null;

  if (!chatwootConvId && CHATWOOT_URL && BOT_TOKEN) {
    chatwootConvId = await findChatwootConversationByPhone(phone);
    if (chatwootConvId) {
      // Salva nel DB per le chiamate successive
      if (conv) {
        await prisma.waConversation.update({
          where: { phone },
          data: { chatwootConversationId: chatwootConvId },
        });
      }
      console.log(`[wa-chat GET] chatwootConversationId trovato e salvato: ${chatwootConvId}`);
    }
  }

  // Se abbiamo il conversationId, leggi i messaggi da Chatwoot direttamente
  if (chatwootConvId) {
    const chatwootMessages = await fetchChatwootMessages(chatwootConvId);

    // Se Chatwoot ha restituito messaggi, usali (più aggiornati del DB)
    if (chatwootMessages.length > 0) {
      return NextResponse.json({
        messages: chatwootMessages,
        hasPhone: true,
        completato: conv?.completato ?? false,
        hasDirectLink: true,
      });
    }
  }

  // Fallback: usa i messaggi salvati nel DB (se presenti)
  const dbMessages = (conv?.messages as ChatMessage[]) ?? [];
  return NextResponse.json({
    messages: dbMessages,
    hasPhone: true,
    completato: conv?.completato ?? false,
    hasDirectLink: !!chatwootConvId,
  });
}

// POST — Invia testo e/o immagine al cliente via Chatwoot
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id }, select: { telefono: true } });
  if (!lead?.telefono) return NextResponse.json({ error: "Lead senza telefono" }, { status: 400 });

  const phone = lead.telefono.replace(/^\+/, "");
  const conv = await prisma.waConversation.findUnique({ where: { phone }, select: { chatwootConversationId: true } });

  let chatwootConvId = conv?.chatwootConversationId ?? null;

  // Fallback: cerca su Chatwoot se non salvato nel DB
  if (!chatwootConvId && CHATWOOT_URL && BOT_TOKEN) {
    chatwootConvId = await findChatwootConversationByPhone(phone);
    if (chatwootConvId && conv) {
      await prisma.waConversation.update({ where: { phone }, data: { chatwootConversationId: chatwootConvId } });
    }
  }

  if (!chatwootConvId) {
    return NextResponse.json({ error: "Conversazione Chatwoot non trovata. Il cliente deve aver mandato almeno un messaggio WhatsApp." }, { status: 404 });
  }

  const conversationId = chatwootConvId;
  const contentType = req.headers.get("content-type") ?? "";
  let cwBody: FormData | string;
  let cwHeaders: Record<string, string>;

  if (contentType.includes("multipart/form-data")) {
    const incomingFormData = await req.formData();
    const message = (incomingFormData.get("message") as string | null) ?? "";
    const file = incomingFormData.get("file") as File | null;

    if (!message.trim() && !file) {
      return NextResponse.json({ error: "Messaggio o file richiesto" }, { status: 400 });
    }

    const fd = new FormData();
    fd.append("message_type", "outgoing");
    fd.append("private", "false");
    if (message.trim()) fd.append("content", message.trim());
    if (file) fd.append("attachments[]", file, file.name);

    cwBody = fd;
    cwHeaders = { "api_access_token": BOT_TOKEN };
  } else {
    const { message } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: "Messaggio vuoto" }, { status: 400 });

    cwBody = JSON.stringify({ content: message, message_type: "outgoing", private: false });
    cwHeaders = { "api_access_token": BOT_TOKEN, "Content-Type": "application/json" };
  }

  const sendRes = await fetch(
    `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conversationId}/messages`,
    { method: "POST", headers: cwHeaders, body: cwBody }
  );

  if (!sendRes.ok) {
    const err = await sendRes.text();
    console.error("[wa-chat POST] Errore Chatwoot:", err);
    return NextResponse.json({ error: "Errore invio messaggio" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE — Resetta la conversazione WA nel DB e riapre quella Chatwoot
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id }, select: { telefono: true } });
  if (!lead?.telefono) return NextResponse.json({ error: "Lead senza telefono" }, { status: 400 });

  const phone = lead.telefono.replace(/^\+/, "");

  const existing = await prisma.waConversation.findUnique({
    where: { phone },
    select: { chatwootConversationId: true },
  });

  await prisma.waConversation.deleteMany({ where: { phone } });
  console.log(`[wa-chat DELETE] Conversazione resettata per ${phone}`);

  // Tenta di riaprire la conversazione Chatwoot per far ripartire il bot
  if (existing?.chatwootConversationId && CHATWOOT_URL && BOT_TOKEN) {
    try {
      await fetch(
        `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations/${existing.chatwootConversationId}/toggle_status`,
        {
          method: "POST",
          headers: { "api_access_token": BOT_TOKEN, "Content-Type": "application/json" },
          body: JSON.stringify({ status: "open" }),
        }
      );
    } catch {
      // Non bloccante
    }
  }

  return NextResponse.json({ success: true });
}
