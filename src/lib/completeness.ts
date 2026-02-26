import type { MagnusLeadData } from "@/types/lead";
import { FIELD_LABELS } from "@/constants/questions";

// Campi obbligatori per tutti (misurano la completezza base)
const CORE_FIELDS = ["descrizioneProdotto", "categoriaProdotto"] as const;

// Campi aggiuntivi che aumentano la completezza se presenti
const BONUS_FIELDS = ["brandProdotto", "codiceProdotto", "vinCode"] as const;

// Campi richiesti solo per le aziende
const AZIENDA_FIELDS = ["ragioneSociale", "partitaIVA"] as const;

export interface CompletenessResult {
  completeness: number;
  missingFields: string[];
  missingLabels: string[];
}

export function calcCompleteness(data: MagnusLeadData): CompletenessResult {
  const d = data as Record<string, unknown>;
  const isAzienda = data.clienteType === "AZIENDA";

  // Campi da valutare in base al tipo cliente
  const allFields = isAzienda
    ? [...AZIENDA_FIELDS, ...CORE_FIELDS, ...BONUS_FIELDS]
    : [...CORE_FIELDS, ...BONUS_FIELDS];

  const missing = allFields.filter((f) => !d[f] || (d[f] as string).trim() === "");
  const filled = allFields.filter((f) => !!d[f] && (d[f] as string).trim() !== "");

  return {
    completeness: Math.round((filled.length / allFields.length) * 100),
    missingFields: missing,
    missingLabels: missing.map((f) => FIELD_LABELS[f] ?? f),
  };
}
