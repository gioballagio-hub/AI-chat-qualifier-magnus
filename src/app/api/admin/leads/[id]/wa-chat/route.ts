import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

const CHATWOOT_URL = process.env.CHATWOOT_URL ?? "";
const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID ?? "1";
const BOT_TOKEN = process.env.CHATWOOT_BOT_ACCESS_TOKEN ?? "";

// ─── Cerca la conversazione Chatwoot per numero di telefono ──────────────────
async function findChatwootConversationByPhone(phone: string): Promise<number | null> {
  try {
    // Cerca il contatto per telefono (Chatwoot salva il numero con +)
    const searchRes = await fetch(
      `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts/search?q=%2B${phone}&page=1`,
      { headers: { "api_access_token": BOT_TOKEN } }
    );
    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const contact = searchData.payload?.[0];
    if (!contact?.id) return null;

    // Recupera le conversazioni del contatto
    const convRes = await fetch(
      `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts/${contact.id}/conversations`,
      { headers: { "api_access_token": BOT_TOKEN } }
    );
    if (!convRes.ok) return null;

    const convData = await convRes.json();
    const conversations: Array<{ id: number }> = convData.payload ?? [];
    if (!conversations.length) return null;

    // Restituisce l'ID della conversazione più recente
    return conversations.sort((a, b) => b.id - a.id)[0].id;
  } catch {
    return null;
  }
}

// GET — Restituisce la cronologia chat dal DB
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id }, select: { telefono: true } });
  if (!lead?.telefono) return NextResponse.json({ messages: [], hasConversation: false });

  const phone = lead.telefono.replace(/^\+/, "");
  const conv = await prisma.waConversation.findUnique({ where: { phone } });
  if (!conv) return NextResponse.json({ messages: [], hasConversation: false });

  return NextResponse.json({
    messages: conv.messages,
    hasConversation: true,
    completato: conv.completato,
    hasDirectLink: !!conv.chatwootConversationId,
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

  // Fallback: se l'ID non è nel DB, cercalo su Chatwoot tramite telefono
  if (!chatwootConvId && CHATWOOT_URL && BOT_TOKEN) {
    chatwootConvId = await findChatwootConversationByPhone(phone);
    if (chatwootConvId) {
      await prisma.waConversation.update({ where: { phone }, data: { chatwootConversationId: chatwootConvId } });
      console.log(`[wa-chat] chatwootConversationId trovato via API e salvato: ${chatwootConvId}`);
    }
  }

  if (!chatwootConvId) {
    return NextResponse.json({ error: "Conversazione Chatwoot non trovata. Aspetta che il cliente mandi almeno un messaggio." }, { status: 404 });
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
    console.error("[wa-chat] Errore Chatwoot:", err);
    return NextResponse.json({ error: "Errore invio messaggio" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE — Resetta la conversazione WA per questo lead (equivalente a MAGNUS RESET)
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
  await prisma.waConversation.deleteMany({ where: { phone } });

  console.log(`[wa-chat] Conversazione resettata per ${phone}`);
  return NextResponse.json({ success: true });
}
