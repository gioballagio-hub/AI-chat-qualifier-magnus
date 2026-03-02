import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/admin/reset-wa?phone=393XXXXXXXXX&token=IL_TUO_VERIFY_TOKEN
// Resetta la conversazione WhatsApp di un numero (utile per test dopo ogni deploy)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const phone = searchParams.get("phone");
  const token = searchParams.get("token");

  // Verifica token
  if (!token || token !== process.env.WHATSAPP_VERIFY_TOKEN) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  if (!phone) {
    return NextResponse.json({ error: "Parametro phone mancante" }, { status: 400 });
  }

  try {
    const deleted = await prisma.waConversation.deleteMany({
      where: { phone },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ status: "nessuna conversazione trovata", phone });
    }

    console.log(`[Admin] Reset conversazione WA per ${phone} ✓`);
    return NextResponse.json({ status: "ok", message: `Conversazione resettata per ${phone}` });
  } catch (error) {
    console.error("[Admin] Errore reset WA:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
