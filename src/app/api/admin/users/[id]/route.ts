import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

const UpdateUserSchema = z.object({
  nome: z.string().min(1).optional(),
  ruolo: z.enum(["ADMIN", "COMMERCIALE"]).optional(),
  attivo: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

// PATCH — modifica utente (solo ADMIN)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session || session.ruolo !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.nome) updateData.nome = parsed.data.nome;
  if (parsed.data.ruolo) updateData.ruolo = parsed.data.ruolo;
  if (parsed.data.attivo !== undefined) updateData.attivo = parsed.data.attivo;
  if (parsed.data.password) {
    updateData.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, email: true, nome: true, ruolo: true, attivo: true, createdAt: true },
  });

  return NextResponse.json(user);
}

// DELETE — elimina utente (solo ADMIN, non può eliminare se stesso)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session || session.ruolo !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await params;

  if (session.userId === id) {
    return NextResponse.json({ error: "Non puoi eliminare il tuo stesso account" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
