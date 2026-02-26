import type { ChatStep } from "@/types/chat";

export const BUYER_STEPS: ChatStep[] = [
  {
    id: "zona",
    question: "In quale zona o quartiere stai cercando casa?",
    type: "ai_zone",
    required: true,
    placeholder: "Es: Milano Navigli, Roma Prati, centro storico…",
  },
  {
    id: "tipologia",
    question: "Che tipo di immobile stai cercando?",
    type: "select",
    required: true,
    options: [
      { label: "Appartamento", value: "appartamento" },
      { label: "Bilocale", value: "bilocale" },
      { label: "Monolocale", value: "monolocale" },
      { label: "Villa / Casa indipendente", value: "villa" },
      { label: "Commerciale / Ufficio", value: "commerciale" },
      { label: "Altro", value: "altro" },
    ],
  },
  {
    id: "budgetMin",
    question: "Qual è il tuo budget indicativo?",
    type: "select",
    required: true,
    options: [
      { label: "Fino a 100.000 €", value: "fino_100k" },
      { label: "100.000 – 200.000 €", value: "100_200k" },
      { label: "200.000 – 300.000 €", value: "200_300k" },
      { label: "300.000 – 500.000 €", value: "300_500k" },
      { label: "Oltre 500.000 €", value: "oltre_500k" },
      { label: "Non ancora definito", value: "non_definito" },
    ],
  },
  {
    id: "tempistiche",
    question: "Entro quando vorresti acquistare?",
    type: "select",
    required: true,
    options: [
      { label: "Entro 1 mese", value: "entro_1_mese" },
      { label: "1 – 3 mesi", value: "1_3_mesi" },
      { label: "3 – 6 mesi", value: "3_6_mesi" },
      { label: "6 – 12 mesi", value: "6_12_mesi" },
      { label: "Oltre 12 mesi", value: "oltre_12_mesi" },
      { label: "Sto solo raccogliendo informazioni", value: "solo_informazioni" },
    ],
  },
  {
    id: "mutuo",
    question: "Hai già valutato un mutuo?",
    type: "select",
    required: true,
    options: [
      { label: "Sì, già approvato", value: "approvato" },
      { label: "Sì, lo sto richiedendo", value: "in_corso" },
      { label: "No, compro in contanti", value: "no" },
      { label: "Non so ancora", value: "non_so" },
    ],
  },
  {
    id: "note",
    question: "Hai altre preferenze o informazioni utili? (facoltativo)",
    type: "textarea",
    required: false,
    placeholder: "Es: piano alto, con ascensore, parcheggio, animali…",
  },
];

export const SELLER_STEPS: ChatStep[] = [
  {
    id: "zona",
    question: "In quale zona o quartiere si trova l'immobile?",
    type: "ai_zone",
    required: true,
    placeholder: "Es: Milano zona 5, Roma Parioli, periferia nord…",
  },
  {
    id: "tipologia",
    question: "Che tipo di immobile vuoi vendere?",
    type: "select",
    required: true,
    options: [
      { label: "Appartamento", value: "appartamento" },
      { label: "Bilocale", value: "bilocale" },
      { label: "Monolocale", value: "monolocale" },
      { label: "Villa / Casa indipendente", value: "villa" },
      { label: "Commerciale / Ufficio", value: "commerciale" },
      { label: "Altro", value: "altro" },
    ],
  },
  {
    id: "metratura",
    question: "Qual è la metratura approssimativa?",
    type: "select",
    required: true,
    options: [
      { label: "Meno di 50 mq", value: "<50" },
      { label: "50 – 80 mq", value: "50-80" },
      { label: "80 – 120 mq", value: "80-120" },
      { label: "120 – 200 mq", value: "120-200" },
      { label: "Oltre 200 mq", value: ">200" },
    ],
  },
  {
    id: "stato",
    question: "In che condizioni si trova l'immobile?",
    type: "select",
    required: true,
    options: [
      { label: "Nuovo / Ottimo stato", value: "nuovo_ottimo" },
      { label: "Buono, abitabile", value: "buono" },
      { label: "Da ristrutturare", value: "da_ristrutturare" },
    ],
  },
  {
    id: "tempistiche",
    question: "Entro quando vorresti vendere?",
    type: "select",
    required: true,
    options: [
      { label: "Entro 1 mese", value: "entro_1_mese" },
      { label: "1 – 3 mesi", value: "1_3_mesi" },
      { label: "3 – 6 mesi", value: "3_6_mesi" },
      { label: "6 – 12 mesi", value: "6_12_mesi" },
      { label: "Oltre 12 mesi", value: "oltre_12_mesi" },
      { label: "Sto solo valutando, senza urgenza", value: "solo_informazioni" },
    ],
  },
  {
    id: "note",
    question: "Hai altre informazioni utili sull'immobile? (facoltativo)",
    type: "textarea",
    required: false,
    placeholder: "Es: piano, presenza di garage, cantina, terrazzo…",
  },
];

export const LABEL_MAP: Record<string, Record<string, string>> = {
  tipologia: {
    appartamento: "Appartamento",
    bilocale: "Bilocale",
    monolocale: "Monolocale",
    villa: "Villa / Casa indipendente",
    commerciale: "Commerciale / Ufficio",
    altro: "Altro",
  },
  budgetMin: {
    fino_100k: "Fino a 100.000 €",
    "100_200k": "100.000 – 200.000 €",
    "200_300k": "200.000 – 300.000 €",
    "300_500k": "300.000 – 500.000 €",
    oltre_500k: "Oltre 500.000 €",
    non_definito: "Non ancora definito",
  },
  tempistiche: {
    entro_1_mese: "Entro 1 mese",
    "1_3_mesi": "1 – 3 mesi",
    "3_6_mesi": "3 – 6 mesi",
    "6_12_mesi": "6 – 12 mesi",
    oltre_12_mesi: "Oltre 12 mesi",
    solo_informazioni: "Solo raccogliendo informazioni",
  },
  mutuo: {
    approvato: "Mutuo approvato",
    in_corso: "Mutuo in corso",
    no: "Acquisto in contanti",
    non_so: "Non ancora valutato",
  },
  metratura: {
    "<50": "Meno di 50 mq",
    "50-80": "50 – 80 mq",
    "80-120": "80 – 120 mq",
    "120-200": "120 – 200 mq",
    ">200": "Oltre 200 mq",
  },
  stato: {
    nuovo_ottimo: "Nuovo / Ottimo stato",
    buono: "Buono, abitabile",
    da_ristrutturare: "Da ristrutturare",
  },
};

export const FIELD_LABELS: Record<string, string> = {
  zona: "Zona",
  tipologia: "Tipologia",
  budgetMin: "Budget",
  tempistiche: "Tempistiche",
  mutuo: "Mutuo",
  metratura: "Metratura",
  stato: "Stato immobile",
  note: "Note",
};
