import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";
import { logger } from "@/lib/logger";

const ChangePasswordSchema = z.object({
  passwordAttuale: z.string().min(1, "Password attuale obbligatoria"),
  nuovaPassword: z.string().min(8, "La nuova password deve essere di almeno 8 caratteri"),
  confermaPassword: z.string().min(1, "Conferma password obbligatoria"),
}).refine((d) => d.nuovaPassword === d.confermaPassword, {
  message: "Le password non coincidono",
  path: ["confermaPassword"],
});

export async function PUT(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = ChangePasswordSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Dati non validi";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { passwordAttuale, nuovaPassword } = parsed.data;

  // Recupera utente dal DB
  const utente = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!utente) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  }

  // Verifica vecchia password
  const ok = await bcrypt.compare(passwordAttuale, utente.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Password attuale non corretta" }, { status: 400 });
  }

  // Hash nuova password e salva
  const nuovoHash = await bcrypt.hash(nuovaPassword, 12);
  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: nuovoHash },
  });

  logger.info("Password cambiata", { userId: session.userId, email: session.email });
  return NextResponse.json({ ok: true });
}
