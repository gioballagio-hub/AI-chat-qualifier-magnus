import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

// DELETE — elimina una nota (solo ADMIN o autore della nota)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ notaId: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { notaId } = await params;
  const nota = await prisma.nota.findUnique({ where: { id: notaId } });
  if (!nota) return NextResponse.json({ error: "Nota non trovata" }, { status: 404 });

  // Solo ADMIN o autore della nota possono eliminarla
  if (session.ruolo !== "ADMIN" && nota.autore !== session.nome) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  await prisma.nota.delete({ where: { id: notaId } });
  return NextResponse.json({ ok: true });
}
