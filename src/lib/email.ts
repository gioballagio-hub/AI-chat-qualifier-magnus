import nodemailer from "nodemailer";
import type { LeadSummary, ContactInfo, BuyerData, SellerData } from "@/types/lead";
import { LABEL_MAP, FIELD_LABELS } from "@/constants/questions";

function resolveValue(field: string, value: unknown): string {
  if (!value) return "—";
  const map = LABEL_MAP[field];
  if (map && typeof value === "string" && map[value]) return map[value];
  return String(value);
}

function buildDataTable(data: BuyerData | SellerData): string {
  return Object.entries(data)
    .filter(([k]) => k !== "zonaRaw")
    .map(([k, v]) => `  • ${FIELD_LABELS[k] ?? k}: ${resolveValue(k, v)}`)
    .join("\n");
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("Configurazione SMTP mancante (SMTP_HOST, SMTP_USER, SMTP_PASS)");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

const scoreEmoji: Record<string, string> = {
  CALDO: "🔥",
  TIEPIDO: "☀️",
  FREDDO: "❄️",
};

export async function sendCustomerEmail(
  contactInfo: ContactInfo,
  summary: LeadSummary
): Promise<void> {
  const transport = createTransport();
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const tipoLabel = summary.type === "BUYER" ? "Acquisto" : "Vendita";

  const dataTable = buildDataTable(summary.data);

  const text = `
Ciao ${contactInfo.nome},

Grazie per aver compilato il nostro questionario. Abbiamo ricevuto la tua richiesta e un nostro agente ti contatterà al più presto.

=== RIEPILOGO DELLA TUA RICHIESTA ===
Tipo: ${tipoLabel}

${dataTable}

Cordiali saluti,
Il Team dell'Agenzia

---
Hai ricevuto questa email perché hai compilato il modulo sul nostro sito.
`.trim();

  await transport.sendMail({
    from,
    to: contactInfo.email,
    subject: `La tua richiesta di ${tipoLabel.toLowerCase()} è stata ricevuta ✓`,
    text,
  });
}

export async function sendAgencyEmail(
  contactInfo: ContactInfo,
  summary: LeadSummary
): Promise<void> {
  const agencyEmail = process.env.AGENCY_EMAIL;
  if (!agencyEmail) {
    throw new Error("AGENCY_EMAIL non configurata");
  }

  const transport = createTransport();
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const tipoLabel = summary.type === "BUYER" ? "COMPRARE" : "VENDERE";
  const emoji = scoreEmoji[summary.score] ?? "";
  const dataTable = buildDataTable(summary.data);

  const text = `
Nuovo lead ricevuto tramite il qualificatore AI.

=== DATI DI CONTATTO ===
  • Nome: ${contactInfo.nome} ${contactInfo.cognome}
  • Età: ${contactInfo.eta} anni
  • Email: ${contactInfo.email}

=== QUALIFICA ===
  • Score: ${emoji} ${summary.score}
  • Completeness: ${Math.round(summary.completeness)}%
  • Tipo: ${tipoLabel}

=== DATI RICHIESTA ===
${dataTable}

=== PROSSIMO PASSO ===
${summary.nextStep}

Lead ID: ${summary.id}
Data: ${new Date(summary.createdAt).toLocaleString("it-IT")}
`.trim();

  await transport.sendMail({
    from,
    to: agencyEmail,
    subject: `${emoji} Nuovo Lead ${summary.score} — ${contactInfo.nome} ${contactInfo.cognome} vuole ${tipoLabel}`,
    text,
  });
}
