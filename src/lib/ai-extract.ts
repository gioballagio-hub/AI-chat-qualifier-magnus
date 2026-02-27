import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface LeadEmailData {
  isLeadRelevante: boolean;
  motivoNonRelevante?: string;
  clienteType: "AZIENDA" | "PRIVATO" | "INDEFINITO";
  nome?: string;
  cognome?: string;
  telefono?: string;
  ragioneSociale?: string;
  partitaIVA?: string;
  categoriaProdotto?: "Accessori" | "Ricambi" | "Lubrificanti" | "Vernici";
  brandProdotto?: string;
  codiceProdotto?: string;
  vinCode?: string;
  descrizioneProdotto: string;
  noteAggiuntive?: string;
  nextStep: string;
}

const SYSTEM_PROMPT = `Sei un assistente commerciale di Magnus SRL, importatore di ricambi auto, accessori, lubrificanti (AMSOIL) e vernici americane.

Analizza le email in arrivo e determina se sono richieste commerciali reali da clienti.

NON sono richieste commerciali: newsletter, spam, notifiche automatiche, conferme ordine, fatture, email interne tra colleghi, richieste di lavoro/collaborazione.

SONO richieste commerciali: qualsiasi email in cui un privato o un'azienda chiede informazioni su prodotti, prezzi, disponibilità, compatibilità con il proprio veicolo.

Rispondi SOLO con un oggetto JSON valido, senza markdown, senza backtick, senza testo aggiuntivo.

Schema JSON obbligatorio:
{
  "isLeadRelevante": boolean,
  "motivoNonRelevante": "stringa opzionale se non rilevante",
  "clienteType": "AZIENDA" | "PRIVATO" | "INDEFINITO",
  "nome": "stringa o null",
  "cognome": "stringa o null",
  "telefono": "stringa o null",
  "ragioneSociale": "stringa o null (solo per aziende)",
  "partitaIVA": "stringa o null (solo per aziende)",
  "categoriaProdotto": "Accessori" | "Ricambi" | "Lubrificanti" | "Vernici" | null,
  "brandProdotto": "stringa o null",
  "codiceProdotto": "stringa o null",
  "vinCode": "stringa o null",
  "descrizioneProdotto": "riassunto chiaro di cosa cerca il cliente",
  "noteAggiuntive": "stringa o null",
  "nextStep": "azione raccomandata per il commerciale (max 100 caratteri)"
}`;

export async function extractLeadFromEmail(
  fromEmail: string,
  fromName: string,
  subject: string,
  body: string
): Promise<LeadEmailData | null> {
  try {
    const emailText = `Da: ${fromName} <${fromEmail}>
Oggetto: ${subject}

${body.slice(0, 4000)}`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analizza questa email e restituisci il JSON:\n\n${emailText}`,
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Pulizia: rimuove eventuali backtick o markdown
    const cleaned = rawText
      .replace(/```json\n?/gi, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(cleaned) as LeadEmailData;
    return parsed;
  } catch (error) {
    console.error("[ai-extract] Errore estrazione lead:", error);
    return null;
  }
}

// Calcola score in base ai dati estratti
export function calcolaScore(
  data: LeadEmailData
): "ALTA" | "MEDIA" | "BASSA" {
  if (data.clienteType === "AZIENDA") {
    if (data.codiceProdotto || data.vinCode) return "ALTA";
    if (data.brandProdotto && data.categoriaProdotto) return "ALTA";
    return "MEDIA";
  }
  if (data.codiceProdotto || data.vinCode) return "MEDIA";
  if (data.brandProdotto || data.categoriaProdotto) return "MEDIA";
  return "BASSA";
}

// Calcola completezza percentuale
export function calcolaCompletezza(
  data: LeadEmailData,
  emailContatto: string
): number {
  const checks = [
    !!emailContatto,
    !!data.nome,
    !!data.cognome,
    !!data.telefono,
    !!data.descrizioneProdotto,
    !!data.categoriaProdotto,
    !!data.brandProdotto,
    !!(data.codiceProdotto || data.vinCode),
    data.clienteType === "AZIENDA" ? !!data.ragioneSociale : true,
    data.clienteType === "AZIENDA" ? !!data.partitaIVA : true,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// Campi mancanti per il lead
export function calcolaMissingFields(
  data: LeadEmailData,
  emailContatto: string
): string[] {
  const missing: string[] = [];
  if (!emailContatto) missing.push("emailContatto");
  if (!data.nome) missing.push("nome");
  if (!data.cognome) missing.push("cognome");
  if (!data.telefono) missing.push("telefono");
  if (!data.categoriaProdotto) missing.push("categoriaProdotto");
  if (!data.brandProdotto) missing.push("brandProdotto");
  if (!data.codiceProdotto && !data.vinCode) missing.push("codiceProdotto");
  if (data.clienteType === "AZIENDA") {
    if (!data.ragioneSociale) missing.push("ragioneSociale");
    if (!data.partitaIVA) missing.push("partitaIVA");
  }
  return missing;
}
