import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const SettingsSchema = z.object({
  integrationMode: z.enum(["WEBHOOK", "DISABLED"]),
  webhookUrl: z.string().url().optional().or(z.literal("")),
  webhookSecret: z.string().max(255).optional(),
  notificheEmailCommerciale: z.boolean().optional(),
  reminderAbilitato: z.boolean().optional(),
  reminderGiorni: z.number().int().min(1).max(30).optional(),
});

export async function GET() {
  let settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings) {
    settings = await prisma.settings.create({
      data: { id: 1 },
    });
  }
  // non esporre il secret in chiaro nel GET
  return NextResponse.json({
    integrationMode: settings.integrationMode,
    webhookUrl: settings.webhookUrl ?? "",
    webhookSecretSet: !!settings.webhookSecret,
    notificheEmailCommerciale: settings.notificheEmailCommerciale ?? true,
    reminderAbilitato: settings.reminderAbilitato ?? false,
    reminderGiorni: settings.reminderGiorni ?? 3,
  });
}

export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = SettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { integrationMode, webhookUrl, webhookSecret, notificheEmailCommerciale, reminderAbilitato, reminderGiorni } = parsed.data;

  const updateData: Record<string, unknown> = {
    integrationMode,
    webhookUrl: webhookUrl || null,
  };
  if (webhookSecret !== undefined) {
    updateData["webhookSecret"] = webhookSecret || null;
  }
  if (notificheEmailCommerciale !== undefined) {
    updateData["notificheEmailCommerciale"] = notificheEmailCommerciale;
  }
  if (reminderAbilitato !== undefined) {
    updateData["reminderAbilitato"] = reminderAbilitato;
  }
  if (reminderGiorni !== undefined) {
    updateData["reminderGiorni"] = reminderGiorni;
  }

  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, ...updateData },
    update: updateData,
  });

  logger.info("Impostazioni aggiornate", { integrationMode });
  return NextResponse.json({ ok: true });
}

// Endpoint di test webhook
export async function POST(req: NextRequest) {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings?.webhookUrl) {
    return NextResponse.json({ error: "URL webhook non configurato" }, { status: 400 });
  }

  const testPayload = {
    event: "webhook.test",
    message: "Test webhook da AI Lead Qualifier",
    timestamp: new Date().toISOString(),
  };

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (settings.webhookSecret) headers["X-Lead-Secret"] = settings.webhookSecret;

    const res = await fetch(settings.webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Webhook ha risposto con status ${res.status}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Errore connessione" },
      { status: 400 }
    );
  }
}
