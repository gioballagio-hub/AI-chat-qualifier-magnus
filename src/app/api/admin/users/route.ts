import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

const CreateUserSchema = z.object({
  email: z.string().email(),
  nome: z.string().min(1),
  password: z.string().min(6),
  ruolo: z.enum(["ADMIN", "COMMERCIALE"]).default("COMMERCIALE"),
});

// GET — lista tutti gli utenti (solo ADMIN)
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || session.ruolo !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const utenti = await prisma.user.findMany({
    select: { id: true, email: true, nome: true, ruolo: true, attivo: true, createdAt: true },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json(utenti);
}

// POST — crea nuovo utente (solo ADMIN)
export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session || session.ruolo !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, nome, password, ruolo } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "Email già registrata" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), nome, passwordHash, ruolo },
    select: { id: true, email: true, nome: true, ruolo: true, attivo: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
