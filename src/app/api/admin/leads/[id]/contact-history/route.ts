import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

// GET /api/admin/leads/[id]/contact-history
// Restituisce tutti gli altri lead con stesso telefono o email del lead indicato
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { id } = await params;

  // Recupera telefono e email del lead corrente
  const currentLead = await prisma.lead.findUnique({
    where: { id },
    select: { telefono: true, emailContatto: true },
  });

  if (!currentLead) {
    return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  }

  const orConditions: object[] = [];

  // Cerca per telefono con normalizzazione (stessa logica del bot WhatsApp)
  if (currentLead.telefono) {
    const phoneDigits = currentLead.telefono.replace(/\D/g, "");
    const phoneVariants = Array.from(
      new Set(
        [currentLead.telefono, `+${phoneDigits}`, phoneDigits].filter(
          (v) => v.replace(/\D/g, "").length >= 8
        )
      )
    );
    orConditions.push({ telefono: { in: phoneVariants } });
  }

  // Cerca per email
  if (currentLead.emailContatto) {
    orConditions.push({ emailContatto: currentLead.emailContatto });
  }

  if (orConditions.length === 0) {
    return NextResponse.json({ history: [], total: 0 });
  }

  const history = await prisma.lead.findMany({
    where: {
      id: { not: id }, // Escludi il lead corrente
      deletedAt: null,
      OR: orConditions,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      nome: true,
      cognome: true,
      score: true,
      statoLead: true,
      categoriaProdotto: true,
      brandProdotto: true,
      commercialeAssegnato: true,
      createdAt: true,
      data: true,
    },
  });

  return NextResponse.json({
    history: history.map((l) => ({
      id: l.id,
      nome: l.nome,
      cognome: l.cognome,
      score: l.score,
      statoLead: l.statoLead,
      categoriaProdotto: l.categoriaProdotto,
      brandProdotto: l.brandProdotto,
      commercialeAssegnato: l.commercialeAssegnato,
      descrizioneProdotto:
        (
          (l.data as Record<string, unknown>)
            ?.descrizioneProdotto as string | undefined
        )?.slice(0, 80) ?? null,
      createdAt: l.createdAt.toISOString(),
    })),
    total: history.length,
  });
}
