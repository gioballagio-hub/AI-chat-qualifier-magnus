export type ClienteType = "AZIENDA" | "PRIVATO" | "INDEFINITO";
export type LeadScore = "ALTA" | "MEDIA" | "BASSA";
export type LeadStatus = "NEW" | "CONTACTED" | "ARCHIVED";
export type CategoriaProdotto =
  | "Accessori"
  | "Ricambi"
  | "Lubrificanti"
  | "Vernici";

export interface MagnusLeadData {
  clienteType: ClienteType;
  // Dati azienda (opzionali per privati)
  ragioneSociale?: string;
  partitaIVA?: string;
  // Dati prodotto
  descrizioneProdotto?: string;
  codiceProdotto?: string;
  brandProdotto?: string;
  categoriaProdotto?: CategoriaProdotto;
  vinCode?: string;
  linkProdotto?: string;
  noteAggiuntive?: string;
}

export interface ContactInfo {
  nome: string;
  cognome: string;
  email: string;
  telefono?: string;
}

export interface LeadSummary {
  id: string;
  clienteType: ClienteType;
  data: MagnusLeadData;
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
  emailContatto: string | null;
  telefono: string | null;
  commercialeAssegnato: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadInput {
  clienteType: ClienteType;
  data: MagnusLeadData;
  contactInfo: ContactInfo;
  consentGiven: true;
}
