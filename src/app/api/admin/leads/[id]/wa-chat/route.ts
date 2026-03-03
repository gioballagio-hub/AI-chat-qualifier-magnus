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

// POST — Invia un messaggio al cliente via Chatwoot
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { message } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Messaggio vuoto" }, { status: 400 });

  const lead = await prisma.lead.findUnique({ where: { id }, select: { telefono: true } });
  if (!lead?.telefono) return NextResponse.json({ error: "Lead senza telefono" }, { status: 400 });

  // Cerca il contatto in Chatwoot
  const searchRes = await fetch(
    `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts/search?q=${encodeURIComponent(lead.telefono)}&page=1`,
    { headers: { "api_access_token": BOT_TOKEN } }
  );
  if (!searchRes.ok) return NextResponse.json({ error: "Errore ricerca contatto" }, { status: 500 });

  const searchData = await searchRes.json();
  const contact = searchData.payload?.contacts?.[0];
  if (!contact) return NextResponse.json({ error: "Contatto non trovato in Chatwoot" }, { status: 404 });

  // Prende la conversazione più recente
  const convsRes = await fetch(
    `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts/${contact.id}/conversations`,
    { headers: { "api_access_token": BOT_TOKEN } }
  );
  if (!convsRes.ok) return NextResponse.json({ error: "Errore recupero conversazioni" }, { status: 500 });

  const convsData = await convsRes.json();
  const conversations = convsData.payload;
  if (!conversations?.length) return NextResponse.json({ error: "Nessuna conversazione trovata" }, { status: 404 });

  const latestConv = conversations[conversations.length - 1];

  // Invia il messaggio
  const sendRes = await fetch(
    `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations/${latestConv.id}/messages`,
    {
      method: "POST",
      headers: { "api_access_token": BOT_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ content: message, message_type: "outgoing", private: false }),
    }
  );
  if (!sendRes.ok) return NextResponse.json({ error: "Errore invio messaggio" }, { status: 500 });

  return NextResponse.json({ success: true });
}
