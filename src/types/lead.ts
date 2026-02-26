export type LeadType = "BUYER" | "SELLER";
export type LeadScore = "CALDO" | "TIEPIDO" | "FREDDO";
export type LeadStatus = "NEW" | "CONTACTED" | "ARCHIVED";

export type Tempistiche =
  | "entro_1_mese"
  | "1_3_mesi"
  | "3_6_mesi"
  | "6_12_mesi"
  | "oltre_12_mesi"
  | "solo_informazioni";

export type Tipologia =
  | "appartamento"
  | "villa"
  | "monolocale"
  | "bilocale"
  | "commerciale"
  | "altro";

export interface BuyerData {
  zona?: string;
  zonaRaw?: string;
  tipologia?: Tipologia;
  budgetMin?: string;
  tempistiche?: Tempistiche;
  mutuo?: "approvato" | "in_corso" | "no" | "non_so";
  note?: string;
}

export interface SellerData {
  zona?: string;
  zonaRaw?: string;
  tipologia?: Tipologia;
  metratura?: "<50" | "50-80" | "80-120" | "120-200" | ">200";
  stato?: "nuovo_ottimo" | "buono" | "da_ristrutturare";
  tempistiche?: Tempistiche;
  note?: string;
}

export interface ContactInfo {
  nome: string;
  cognome: string;
  eta: number;
  email: string;
}

export interface LeadSummary {
  id: string;
  type: LeadType;
  data: BuyerData | SellerData;
  score: LeadScore;
  completeness: number;
  missingFields: string[];
  nextStep: string;
  status: LeadStatus;
  sentToIntegration: boolean;
  emailInviata: boolean;
  consentGiven: boolean;
  nome: string | null;
  cognome: string | null;
  eta: number | null;
  emailContatto: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadInput {
  type: LeadType;
  data: BuyerData | SellerData;
  contactInfo: ContactInfo;
  consentGiven: true;
}
