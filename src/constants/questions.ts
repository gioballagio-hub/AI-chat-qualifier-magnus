import type { ChatStep } from "@/types/chat";

// Step comune: cliente esistente o nuovo
const clienteEsistenteStep: ChatStep = {
  id: "clienteEsistente",
  question: "Hai già acquistato da Magnus in passato?",
  type: "select",
  required: true,
  options: [
    { label: "Sì, sono già cliente", value: "SI" },
    { label: "No, è il mio primo contatto", value: "NO" },
  ],
};

// Domande per clienti AZIENDA
export const AZIENDA_STEPS: ChatStep[] = [
  clienteEsistenteStep,
  {
    id: "ragioneSociale",
    question: "Come si chiama la tua azienda?",
    type: "freetext",
    required: true,
    placeholder: "Es: Mario Rossi SRL, Autoricambi Bianchi SpA…",
  },
  {
    id: "partitaIVA",
    question: "E la Partita IVA?",
    type: "freetext",
    required: true,
    placeholder: "Es: IT12345678901",
  },
  {
    id: "descrizioneProdotto",
    question:
      "Cosa stai cercando esattamente? Più dettagli dai, prima riusciamo ad aiutarti.",
    type: "textarea",
    required: true,
    placeholder:
      "Es: Filtri olio per Ford F-150 2018, lubrificanti AMSOIL per cambio automatico…",
  },
  {
    id: "categoriaProdotto",
    question: "In che categoria rientra il prodotto?",
    type: "select",
    required: true,
    options: [
      { label: "Ricambi", value: "Ricambi" },
      { label: "Accessori", value: "Accessori" },
      { label: "Lubrificanti", value: "Lubrificanti" },
      { label: "Vernici", value: "Vernici" },
    ],
  },
  {
    id: "brandProdotto",
    question: "Hai un brand di riferimento?",
    type: "freetext",
    required: false,
    placeholder: "Es: Mopar, Ford, GM, AMSOIL, Mothers… (puoi saltare)",
  },
  {
    id: "codiceProdotto",
    question: "Conosci il codice o il part number del prodotto?",
    type: "freetext",
    required: false,
    placeholder: "Es: 68218956AA, FL-2005… (puoi saltare)",
  },
  {
    id: "vinCode",
    question:
      "Hai il numero di telaio (VIN) del veicolo? Ci aiuta a trovare il pezzo esatto.",
    type: "freetext",
    required: false,
    placeholder: "Es: 1HGBH41JXMN109186 (puoi saltare)",
  },
  {
    id: "libretto",
    question:
      "Puoi caricare il libretto del veicolo? Ci aiuta a identificare il ricambio esatto.",
    type: "file",
    required: false,
  },
  {
    id: "noteAggiuntive",
    question:
      "Hai link a prodotti, foto o altre informazioni utili?",
    type: "textarea",
    required: false,
    placeholder:
      "Incolla link a prodotti, inserisci note o dettagli aggiuntivi… (puoi saltare)",
  },
];

// Domande per clienti PRIVATO (senza ragione sociale e P.IVA)
export const PRIVATO_STEPS: ChatStep[] = [
  clienteEsistenteStep,
  {
    id: "descrizioneProdotto",
    question:
      "Cosa stai cercando esattamente? Più dettagli dai, prima riusciamo ad aiutarti.",
    type: "textarea",
    required: true,
    placeholder:
      "Es: Filtri olio per Ford F-150 2018, lubrificanti AMSOIL per cambio automatico…",
  },
  {
    id: "categoriaProdotto",
    question: "In che categoria rientra il prodotto?",
    type: "select",
    required: true,
    options: [
      { label: "Ricambi", value: "Ricambi" },
      { label: "Accessori", value: "Accessori" },
      { label: "Lubrificanti", value: "Lubrificanti" },
      { label: "Vernici", value: "Vernici" },
    ],
  },
  {
    id: "brandProdotto",
    question: "Hai un brand di riferimento?",
    type: "freetext",
    required: false,
    placeholder: "Es: Mopar, Ford, GM, AMSOIL, Mothers… (puoi saltare)",
  },
  {
    id: "codiceProdotto",
    question: "Conosci il codice o il part number del prodotto?",
    type: "freetext",
    required: false,
    placeholder: "Es: 68218956AA, FL-2005… (puoi saltare)",
  },
  {
    id: "vinCode",
    question:
      "Hai il numero di telaio (VIN) del veicolo? Ci aiuta a trovare il pezzo esatto.",
    type: "freetext",
    required: false,
    placeholder: "Es: 1HGBH41JXMN109186 (puoi saltare)",
  },
  {
    id: "libretto",
    question:
      "Puoi caricare il libretto del veicolo? Ci aiuta a identificare il ricambio esatto.",
    type: "file",
    required: false,
  },
  {
    id: "noteAggiuntive",
    question:
      "Hai link a prodotti, foto o altre informazioni utili?",
    type: "textarea",
    required: false,
    placeholder:
      "Incolla link a prodotti, inserisci note o dettagli aggiuntivi… (puoi saltare)",
  },
];

// Mappa per etichette leggibili dei valori select
export const LABEL_MAP: Record<string, Record<string, string>> = {
  categoriaProdotto: {
    Ricambi: "Ricambi",
    Accessori: "Accessori",
    Lubrificanti: "Lubrificanti",
    Vernici: "Vernici",
  },
  clienteEsistente: {
    SI: "Sì, già cliente",
    NO: "Primo contatto",
  },
};

// Etichette per i campi nel riepilogo
export const FIELD_LABELS: Record<string, string> = {
  clienteType: "Tipologia cliente",
  clienteEsistente: "Cliente esistente",
  ragioneSociale: "Ragione Sociale",
  partitaIVA: "Partita IVA",
  descrizioneProdotto: "Cosa cerca",
  categoriaProdotto: "Categoria",
  brandProdotto: "Brand",
  codiceProdotto: "Codice prodotto",
  vinCode: "Numero di telaio (VIN)",
  libretto: "Libretto veicolo",
  librettoUrl: "Libretto veicolo",
  linkProdotto: "Link / Foto",
  noteAggiuntive: "Note aggiuntive",
};
