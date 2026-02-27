import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type AzioneLog =
  | "COMMERCIALE_ASSEGNATO"
  | "PIPELINE_AGGIORNATO"
  | "NOTA_AGGIUNTA"
  | "NOTA_ELIMINATA"
  | "LEAD_ELIMINATO"
  | "LEAD_RIPRISTINATO"
  | "WEBHOOK_REINVIATO"
  | "STATO_AGGIORNATO"
  | "LEAD_CREATO_DA_EMAIL"
  | "FOLLOWUP_EMAIL_INVIATA"
  | "LEAD_MODIFICATO";

export async function logActivity(params: {
  leadId: string;
  autore: string;
  azione: AzioneLog;
  dettagli?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        leadId: params.leadId,
        autore: params.autore,
        azione: params.azione,
        dettagli: params.dettagli ? JSON.stringify(params.dettagli) : null,
      },
    });
  } catch (err) {
    // L'activity log non deve mai bloccare il flusso principale
    logger.warn("Errore scrittura activity log", {
      error: err instanceof Error ? err.message : String(err),
      leadId: params.leadId,
      azione: params.azione,
    });
  }
}
