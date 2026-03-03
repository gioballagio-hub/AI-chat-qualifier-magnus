import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendChatwootMessage } from "@/lib/chatwoot";

const CHATWOOT_URL = process.env.CHATWOOT_URL ?? "";
const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID ?? "1";
const API_TOKEN = process.env.CHATWOOT_API_TOKEN || process.env.CHATWOOT_BOT_ACCESS_TOKEN || "";

// Webhook regolare Chatwoot — riceve eventi per TUTTE le conversazioni (anche assigned/open)
// Gestisce SOLO il comando MAGNUS RESET dal cliente
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Solo eventi message_created
    if (body.event !== "message_created") return NextResponse.json({ ok: true });

    // Solo messaggi in arrivo dal cliente (non uscenti, non privati)
    if (body.message_type !== "incoming") return NextResponse.json({ ok: true });
    if (body.private) return NextResponse.json({ ok: true });

    const content: string = body.content ?? "";

    // Ignora tutto tranne MAGNUS RESET
    if (content.trim().toUpperCase() !== "MAGNUS RESET") return NextResponse.json({ ok: true });

    const conversationId: number = body.conversation?.id;
    const phoneRaw: string = body.conversation?.meta?.sender?.phone_number ?? "";
    const phone = phoneRaw.replace(/^\+/, "");

    if (!conversationId || !phone) {
      console.warn("[Chatwoot Events] MAGNUS RESET: conversationId o phone mancanti");
      return NextResponse.json({ ok: true });
    }

    console.log(`[Chatwoot Events] MAGNUS RESET da ${phone} (conv #${conversationId})`);

    // 1. Cancella la conversazione dal DB così il bot riparte da zero
    await prisma.waConversation.deleteMany({ where: { phone } });

    // 2. Invia messaggio di conferma al cliente
    await sendChatwootMessage(conversationId, "Conversazione resettata. Ciao! 👋 Come posso aiutarti?");

    // 3. Rimetti la conversazione in "pending" DOPO il messaggio,
    //    così il bot riceve i prossimi messaggi del cliente
    if (CHATWOOT_URL && API_TOKEN) {
      await fetch(
        `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conversationId}/toggle_status`,
        {
          method: "POST",
          headers: { "api_access_token": API_TOKEN, "Content-Type": "application/json" },
          body: JSON.stringify({ status: "pending" }),
        }
      ).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Chatwoot Events] Errore:", error);
    return NextResponse.json({ ok: true });
  }
}
