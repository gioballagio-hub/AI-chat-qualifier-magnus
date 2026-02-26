import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

const CreateNotaSchema = z.object({
  testo: z.string().min(1).max(2000),
});

// GET — lista note di un lead
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const note = await prisma.nota.findMany({
    where: { leadId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ note });
}

// POST — crea nuova nota
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = CreateNotaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Testo non valido" }, { status: 400 });
  }

  // Verifica che il lead esista
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });

  const nota = await prisma.nota.create({
    data: {
      leadId: id,
      autore: session.nome,
      testo: parsed.data.testo,
    },
  });

  return NextResponse.json(nota, { status: 201 });
}
