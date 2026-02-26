import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSessionToken, COOKIE_NAME, SESSION_HOURS } from "@/lib/auth";
import { logger } from "@/lib/logger";

const LoginSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  // --- Login con tabella User (multi-utente) ---
  if (email) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user || !user.attivo) {
      logger.warn("Tentativo login fallito - utente non trovato o disabilitato", { email });
      return NextResponse.json({ error: "Credenziali non valide" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      logger.warn("Tentativo login fallito - password errata", { email });
      return NextResponse.json({ error: "Credenziali non valide" }, { status: 401 });
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      nome: user.nome,
      ruolo: user.ruolo,
    });

    logger.info("Login utente effettuato", { email, ruolo: user.ruolo });

    const res = NextResponse.json({ ok: true, nome: user.nome, ruolo: user.ruolo });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_HOURS * 60 * 60,
      path: "/",
    });
    return res;
  }

  // --- Fallback: login con password admin dal .env (retrocompatibilità) ---
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    logger.error("ADMIN_PASSWORD non configurata");
    return NextResponse.json({ error: "Configurazione server errata" }, { status: 500 });
  }

  const isValid = adminPassword.startsWith("$2")
    ? await bcrypt.compare(password, adminPassword)
    : password === adminPassword;

  if (!isValid) {
    logger.warn("Tentativo login admin fallito");
    return NextResponse.json({ error: "Password non corretta" }, { status: 401 });
  }

  const token = await createSessionToken({
    userId: "admin",
    email: "admin@magnus.it",
    nome: "Admin",
    ruolo: "ADMIN",
  });

  logger.info("Login admin (.env) effettuato");

  const res = NextResponse.json({ ok: true, nome: "Admin", ruolo: "ADMIN" });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_HOURS * 60 * 60,
    path: "/",
  });
  return res;
}
