import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createSessionToken, COOKIE_NAME, SESSION_HOURS } from "@/lib/auth";
import { logger } from "@/lib/logger";

const LoginSchema = z.object({
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
    return NextResponse.json({ error: "Password mancante" }, { status: 400 });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    logger.error("ADMIN_PASSWORD non configurata");
    return NextResponse.json({ error: "Configurazione server errata" }, { status: 500 });
  }

  // Supporta sia password in chiaro (dev) che hashata con bcrypt (prod)
  const isValid = adminPassword.startsWith("$2")
    ? await bcrypt.compare(parsed.data.password, adminPassword)
    : parsed.data.password === adminPassword;

  if (!isValid) {
    logger.warn("Tentativo login fallito");
    return NextResponse.json({ error: "Password non corretta" }, { status: 401 });
  }

  const token = await createSessionToken();
  logger.info("Login admin effettuato");

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_HOURS * 60 * 60,
    path: "/",
  });
  return res;
}
