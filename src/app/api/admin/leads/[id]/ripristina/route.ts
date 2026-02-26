import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

// POST — ripristina lead dal cestino (solo ADMIN)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session || session.ruolo !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  if (!lead.deletedAt) return NextResponse.json({ error: "Il lead non è nel cestino" }, { status: 400 });

  await prisma.lead.update({ where: { id }, data: { deletedAt: null } });
  return NextResponse.json({ ok: true });
}
