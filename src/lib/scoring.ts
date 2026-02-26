import type { BuyerData, SellerData, LeadScore, LeadType } from "@/types/lead";

const SHORT_TIMELINES = ["entro_1_mese", "1_3_mesi"];
const MEDIUM_TIMELINES = ["3_6_mesi", "6_12_mesi"];
const COLD_TIMELINES = ["oltre_12_mesi", "solo_informazioni"];

export function scoreBuyer(data: BuyerData): LeadScore {
  const t = data.tempistiche ?? "";
  if (COLD_TIMELINES.includes(t)) return "FREDDO";
  const hasBudget = !!data.budgetMin && data.budgetMin !== "non_definito";
  const hasZona = !!data.zona;
  if (SHORT_TIMELINES.includes(t) && hasBudget && hasZona) return "CALDO";
  if (MEDIUM_TIMELINES.includes(t) || !hasBudget || !hasZona) return "TIEPIDO";
  return "TIEPIDO";
}

export function scoreSeller(data: SellerData): LeadScore {
  const t = data.tempistiche ?? "";
  if (COLD_TIMELINES.includes(t)) return "FREDDO";
  const hasDetails = !!(data.metratura || data.tipologia);
  const hasStato = !!data.stato;
  if (SHORT_TIMELINES.includes(t) && hasDetails && hasStato) return "CALDO";
  if (MEDIUM_TIMELINES.includes(t)) return "TIEPIDO";
  return "FREDDO";
}

export function calcScore(type: LeadType, data: BuyerData | SellerData): LeadScore {
  return type === "BUYER"
    ? scoreBuyer(data as BuyerData)
    : scoreSeller(data as SellerData);
}

export function calcNextStep(type: LeadType, score: LeadScore): string {
  if (score === "CALDO" && type === "BUYER")
    return "Contatta entro 24 ore: cliente pronto all'acquisto";
  if (score === "CALDO" && type === "SELLER")
    return "Sopralluogo urgente: venditore con tempistiche strette";
  if (score === "TIEPIDO")
    return "Pianifica un follow-up entro 1 settimana";
  return "Inserisci in newsletter o nurturing automatico";
}
