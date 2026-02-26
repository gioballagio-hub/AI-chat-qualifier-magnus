import type { BuyerData, SellerData, LeadType } from "@/types/lead";
import { FIELD_LABELS } from "@/constants/questions";

const BUYER_CORE = ["zona", "tipologia", "budgetMin", "tempistiche", "mutuo"] as const;
const SELLER_CORE = ["zona", "tipologia", "metratura", "stato", "tempistiche"] as const;

export interface CompletenessResult {
  completeness: number;
  missingFields: string[];
  missingLabels: string[];
}

export function calcCompleteness(
  type: LeadType,
  data: BuyerData | SellerData
): CompletenessResult {
  const coreFields = type === "BUYER" ? BUYER_CORE : SELLER_CORE;
  const d = data as Record<string, unknown>;

  const missing = coreFields.filter((f) => !d[f]);
  const filled = coreFields.filter((f) => !!d[f]);

  return {
    completeness: Math.round((filled.length / coreFields.length) * 100),
    missingFields: missing,
    missingLabels: missing.map((f) => FIELD_LABELS[f] ?? f),
  };
}
