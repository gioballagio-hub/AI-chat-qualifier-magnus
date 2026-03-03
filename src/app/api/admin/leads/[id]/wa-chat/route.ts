import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

const CHATWOOT_URL = process.env.CHATWOOT_URL ?? "";
const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID ?? "1";
const BOT_TOKEN = process.env.CHATWOOT_BOT_ACCESS_TOKEN ?? "";

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

  return NextResponse.json({ messages: conv.messages, hasConversation: true, completato: conv.completato });
}

// Trova la conversazione Chatwoot più recente per un numero di telefono
async function findLatestConversation(telefono: string): Promise<number | null> {
  const searchRes = await fetch(
    `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts/search?q=${encodeURIComponent(telefono)}&page=1`,
    { headers: { "api_access_token": BOT_TOKEN } }
  );
  if (!searchRes.ok) return null;

  const searchData = await searchRes.json();
  const contact = searchData.payload?.contacts?.[0];
  if (!contact) return null;

  const convsRes = await fetch(
    `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts/${contact.id}/conversations`,
    { headers: { "api_access_token": BOT_TOKEN } }
  );
  if (!convsRes.ok) return null;

  const convsData = await convsRes.json();
  const conversations = convsData.payload;
  if (!conversations?.length) return null;

  return conversations[conversations.length - 1].id as number;
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

  const conversationId = await findLatestConversation(lead.telefono);
  if (!conversationId) return NextResponse.json({ error: "Conversazione Chatwoot non trovata" }, { status: 404 });

  const contentType = req.headers.get("content-type") ?? "";
  let cwBody: FormData | string;
  let cwHeaders: Record<string, string>;

  if (contentType.includes("multipart/form-data")) {
    // Richiesta con allegato
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
    // Richiesta testo puro
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
