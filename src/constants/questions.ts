import type { ChatStep } from "@/types/chat";

// Domande per clienti AZIENDA
export const AZIENDA_STEPS: ChatStep[] = [
  {
    id: "ragioneSociale",
    question: "Qual è la ragione sociale della tua azienda?",
    type: "freetext",
    required: true,
    placeholder: "Es: Mario Rossi SRL, Autoricambi Bianchi SpA…",
  },
  {
    id: "partitaIVA",
    question: "Inserisci la Partita IVA aziendale.",
    type: "freetext",
    required: true,
    placeholder: "Es: IT12345678901",
  },
  {
    id: "descrizioneProdotto",
    question:
      "Descrivi cosa stai cercando. Più dettagli fornisci, prima riusciamo ad aiutarti.",
    type: "textarea",
    required: true,
    placeholder:
      "Es: Cerco filtri olio per Ford F-150 2018, oppure lubrificanti AMSOIL per cambio automatico…",
  },
  {
    id: "categoriaProdotto",
    question: "In quale categoria rientra il prodotto che cerchi?",
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
    question: "Hai un brand di riferimento? (facoltativo)",
    type: "freetext",
    required: false,
    placeholder: "Es: Mopar, Ford, GM, AMSOIL, Mothers…",
  },
  {
    id: "codiceProdotto",
    question:
      "Conosci il codice prodotto o il part number OEM? (facoltativo)",
    type: "freetext",
    required: false,
    placeholder: "Es: 68218956AA, FL-2005, 5W-30 QT…",
  },
  {
    id: "vinCode",
    question:
      "Hai il numero di telaio (VIN) del veicolo? Ci aiuta a trovare il ricambio esatto. (facoltativo)",
    type: "freetext",
    required: false,
    placeholder: "Es: 1HGBH41JXMN109186",
  },
  {
    id: "libretto",
    question:
      "Puoi caricare il libretto del veicolo? Ci aiuta a identificare il ricambio esatto. (facoltativo, solo PDF/JPG/PNG — max 5MB)",
    type: "file",
    required: false,
  },
  {
    id: "noteAggiuntive",
    question:
      "Hai link a prodotti, foto o altre informazioni utili? Aggiungile qui. (facoltativo)",
    type: "textarea",
    required: false,
    placeholder:
      "Incolla link a prodotti, inserisci note aggiuntive o dettagli sul veicolo…",
  },
];

// Domande per clienti PRIVATO (senza ragione sociale e P.IVA)
export const PRIVATO_STEPS: ChatStep[] = [
  {
    id: "descrizioneProdotto",
    question:
      "Descrivi cosa stai cercando nel modo più dettagliato possibile.",
    type: "textarea",
    required: true,
    placeholder:
      "Es: Filtri olio per Ford F-150 2018, lubrificanti AMSOIL per cambio automatico…",
  },
  {
    id: "categoriaProdotto",
    question: "In quale categoria rientra il prodotto che cerchi?",
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
    question: "Hai un brand di riferimento? (facoltativo)",
    type: "freetext",
    required: false,
    placeholder: "Es: Mopar, Ford, GM, AMSOIL, Mothers…",
  },
  {
    id: "codiceProdotto",
    question:
      "Conosci il codice prodotto o il part number OEM? (facoltativo)",
    type: "freetext",
    required: false,
    placeholder: "Es: 68218956AA, FL-2005, 5W-30 QT…",
  },
  {
    id: "vinCode",
    question:
      "Hai il numero di telaio (VIN) del veicolo? Ci aiuta a trovare il ricambio esatto. (facoltativo)",
    type: "freetext",
    required: false,
    placeholder: "Es: 1HGBH41JXMN109186",
  },
  {
    id: "libretto",
    question:
      "Puoi caricare il libretto del veicolo? Ci aiuta a identificare il ricambio esatto. (facoltativo, solo PDF/JPG/PNG — max 5MB)",
    type: "file",
    required: false,
  },
  {
    id: "noteAggiuntive",
    question:
      "Hai link a prodotti, foto o altre informazioni utili? Aggiungile qui. (facoltativo)",
    type: "textarea",
    required: false,
    placeholder:
      "Incolla link a prodotti, inserisci note aggiuntive o dettagli sul veicolo…",
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
};

// Etichette per i campi nel riepilogo
export const FIELD_LABELS: Record<string, string> = {
  clienteType: "Tipologia cliente",
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
