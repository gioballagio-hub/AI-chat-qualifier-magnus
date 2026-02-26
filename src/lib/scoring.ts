import type { MagnusLeadData, LeadScore } from "@/types/lead";

/**
 * Logica di priorità Magnus SRL:
 * ALTA  → Azienda con richiesta dettagliata (codice prodotto O VIN presenti)
 * MEDIA → Azienda senza dettagli completi, oppure Privato con richiesta dettagliata
 * BASSA → Privato con richiesta vaga o incompleta
 *
 * Nota: il valore economico dell'ordine non è verificabile in chat,
 * la valutazione finale spetta al commerciale.
 */
export function calcScore(data: MagnusLeadData): LeadScore {
  const isAzienda = data.clienteType === "AZIENDA";
  const hasDettagliProdotto = !!(data.codiceProdotto || data.vinCode);
  const hasDescrizioneCompleta = !!(
    data.descrizioneProdotto && data.descrizioneProdotto.trim().length > 20
  );

  if (isAzienda && hasDettagliProdotto) return "ALTA";
  if (isAzienda && hasDescrizioneCompleta) return "ALTA";
  if (isAzienda) return "MEDIA";
  if (!isAzienda && hasDettagliProdotto && hasDescrizioneCompleta) return "MEDIA";
  if (!isAzienda && hasDescrizioneCompleta) return "MEDIA";
  return "BASSA";
}

export function calcNextStep(score: LeadScore, clienteType: MagnusLeadData["clienteType"]): string {
  if (score === "ALTA" && clienteType === "AZIENDA")
    return "Contatta entro 24 ore: azienda con richiesta dettagliata";
  if (score === "ALTA")
    return "Contatta entro 24 ore: richiesta dettagliata con codice/VIN";
  if (score === "MEDIA" && clienteType === "AZIENDA")
    return "Segui entro 48 ore: azienda — richiedi dettagli prodotto mancanti";
  if (score === "MEDIA")
    return "Valuta la richiesta: privato con descrizione sufficiente";
  return "Bassa priorità: privato con richiesta generica. Valuta se procedere (min. ordine €300)";
}
