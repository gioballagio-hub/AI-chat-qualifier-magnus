import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

// GET — Restituisce lo storico email inviate per questo lead
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [emails, lead] = await Promise.all([
    prisma.activityLog.findMany({
      where: { leadId: id, azione: "FOLLOWUP_EMAIL_INVIATA" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lead.findUnique({
      where: { id },
      select: { emailContatto: true, missingFields: true, telefono: true },
    }),
  ]);

  if (!lead) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });

  return NextResponse.json({
    emails,
    emailContatto: lead.emailContatto ?? null,
    missingFields: (lead.missingFields as string[]) ?? [],
    hasTelefono: !!lead.telefono,
  });
}
