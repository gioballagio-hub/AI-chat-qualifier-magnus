import type { LeadSummary } from "@/types/lead";
import { logger } from "@/lib/logger";

interface WebhookSettings {
  webhookUrl: string | null;
  webhookSecret: string | null;
}

export async function dispatchWebhook(
  summary: LeadSummary,
  settings: WebhookSettings
): Promise<boolean> {
  if (!settings.webhookUrl) return false;

  const payload = {
    event: "lead.created",
    lead: {
      id: summary.id,
      clienteType: summary.clienteType,
      data: summary.data,
      score: summary.score,
      completeness: summary.completeness,
      missingFields: summary.missingFields,
      nextStep: summary.nextStep,
      createdAt: summary.createdAt,
    },
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (settings.webhookSecret) {
    headers["X-Lead-Secret"] = settings.webhookSecret;
  }

  try {
    const res = await fetch(settings.webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      logger.warn("Webhook response non-OK", { status: res.status, leadId: summary.id });
      return false;
    }

    logger.info("Webhook inviato con successo", { leadId: summary.id });
    return true;
  } catch (err) {
    logger.error("Errore invio webhook", {
      leadId: summary.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
