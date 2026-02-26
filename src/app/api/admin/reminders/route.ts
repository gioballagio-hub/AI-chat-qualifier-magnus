import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendReminderEmail } from "@/lib/email";
import { getSessionFromCookies } from "@/lib/auth";

// GET — esegue i reminder manualmente (solo ADMIN) oppure via cron con secret
export async function GET(req: Request) {
  // Autenticazione: accetta sessione ADMIN oppure header X-Cron-Secret
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers ? (req as Request & { headers: Headers }).headers.get("x-cron-secret") : null;

  const viaCron = cronSecret && headerSecret === cronSecret;

  if (!viaCron) {
    const session = await getSessionFromCookies();
    if (!session || session.ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }
  }

  // Leggi settings
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings?.reminderAbilitato) {
    return NextResponse.json({ ok: true, skipped: true, message: "Reminder disabilitati nelle impostazioni" });
  }

  const giorni = settings.reminderGiorni ?? 3;
  const cutoff = new Date(Date.now() - giorni * 24 * 60 * 60 * 1000);

  // Trova lead assegnati ma ancora in NUOVO, non eliminati, creati da più di `giorni` giorni
  const leadsInattivi = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      statoLead: "NUOVO",
      commercialeAssegnato: { not: null },
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      nome: true,
      cognome: true,
      score: true,
      createdAt: true,
      statoLead: true,
      commercialeAssegnato: true,
    },
  });

  if (leadsInattivi.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "Nessun lead inattivo trovato" });
  }

  // Raggruppa per commerciale assegnato
  const byCommerciale = new Map<
    string,
    typeof leadsInattivi
  >();

  for (const lead of leadsInattivi) {
    const nome = lead.commercialeAssegnato!;
    if (!byCommerciale.has(nome)) byCommerciale.set(nome, []);
    byCommerciale.get(nome)!.push(lead);
  }

  let sent = 0;
  let errors = 0;

  for (const [nomeCommerciale, leads] of byCommerciale) {
    try {
      const utente = await prisma.user.findFirst({
        where: { nome: nomeCommerciale, attivo: true },
        select: { email: true, nome: true },
      });

      if (!utente?.email) {
        logger.warn("Reminder: utente non trovato o senza email", { nomeCommerciale });
        continue;
      }

      await sendReminderEmail(utente.email, utente.nome, leads);
      logger.info("Reminder inviato", { commerciale: nomeCommerciale, leads: leads.length });
      sent++;
    } catch (err) {
      logger.warn("Reminder: invio email fallito", {
        commerciale: nomeCommerciale,
        error: err instanceof Error ? err.message : String(err),
      });
      errors++;
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    errors,
    leadsProcessed: leadsInattivi.length,
    message: `Reminder inviati a ${sent} commercial${sent === 1 ? "e" : "i"}`,
  });
}
