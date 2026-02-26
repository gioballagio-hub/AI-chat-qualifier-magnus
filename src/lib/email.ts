import nodemailer from "nodemailer";
import type { LeadSummary, ContactInfo, MagnusLeadData } from "@/types/lead";
import { FIELD_LABELS } from "@/constants/questions";

function resolveValue(value: unknown): string {
  if (!value || (typeof value === "string" && value.trim() === "")) return "—";
  return String(value);
}

function buildDataTable(data: MagnusLeadData): string {
  const DISPLAY_FIELDS = [
    "ragioneSociale",
    "partitaIVA",
    "descrizioneProdotto",
    "categoriaProdotto",
    "brandProdotto",
    "codiceProdotto",
    "vinCode",
    "noteAggiuntive",
  ];

  return DISPLAY_FIELDS
    .map((k) => {
      const v = (data as unknown as Record<string, unknown>)[k];
      if (!v || (typeof v === "string" && v.trim() === "")) return null;
      return `  • ${FIELD_LABELS[k] ?? k}: ${resolveValue(v)}`;
    })
    .filter(Boolean)
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
  ALTA: "🔥",
  MEDIA: "☀️",
  BASSA: "❄️",
};

const clienteTypeLabel: Record<string, string> = {
  AZIENDA: "Azienda",
  PRIVATO: "Privato",
  INDEFINITO: "Indefinito",
};

export async function sendCustomerEmail(
  contactInfo: ContactInfo,
  summary: LeadSummary
): Promise<void> {
  const transport = createTransport();
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const data = summary.data as MagnusLeadData;
  const dataTable = buildDataTable(data);

  const text = `
Gentile ${contactInfo.nome},

Grazie per aver inviato la tua richiesta a Magnus SRL. Abbiamo ricevuto i tuoi dati e il nostro team commerciale ti contatterà il prima possibile.

=== RIEPILOGO DELLA TUA RICHIESTA ===
Tipo cliente: ${clienteTypeLabel[data.clienteType] ?? data.clienteType}

${dataTable}

Cordiali saluti,
Il Team Commerciale Magnus SRL

---
Ricorda: l'ordine minimo è di €300.
Hai ricevuto questa email perché hai compilato il modulo sul sito Magnus SRL.
`.trim();

  await transport.sendMail({
    from,
    to: contactInfo.email,
    subject: `La tua richiesta Magnus SRL è stata ricevuta ✓`,
    text,
  });
}

export async function sendCommercialEmail(
  commercialeEmail: string,
  commercialeNome: string,
  summary: LeadSummary
): Promise<void> {
  const transport = createTransport();
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const data = summary.data as MagnusLeadData;
  const emoji = scoreEmoji[summary.score] ?? "";
  const tipoCliente = clienteTypeLabel[data.clienteType] ?? data.clienteType;
  const dataTable = buildDataTable(data);

  const nomeContatto = [summary.nome, summary.cognome].filter(Boolean).join(" ") || "—";
  const ragioneSociale = data.ragioneSociale ? `\n  • Ragione Sociale: ${data.ragioneSociale}` : "";
  const partitaIVA = data.partitaIVA ? `\n  • Partita IVA: ${data.partitaIVA}` : "";

  const text = `
Ciao ${commercialeNome},

ti è stato assegnato un nuovo lead da gestire.

=== DATI DI CONTATTO ===
  • Nome: ${nomeContatto}
  • Email: ${summary.emailContatto ?? "—"}${summary.telefono ? `\n  • Telefono: ${summary.telefono}` : ""}
  • Tipo cliente: ${tipoCliente}${ragioneSociale}${partitaIVA}

=== PRIORITÀ ===
  • Score: ${emoji} ${summary.score}
  • Completezza: ${Math.round(summary.completeness)}%

=== PRODOTTO RICHIESTO ===
${dataTable}

=== PROSSIMO PASSO SUGGERITO ===
${summary.nextStep}

Accedi al pannello per gestire questo lead:
${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/admin/leads/${summary.id}

Lead ID: ${summary.id}
Data richiesta: ${new Date(summary.createdAt).toLocaleString("it-IT")}

---
Magnus SRL — Pannello Commerciale
`.trim();

  await transport.sendMail({
    from,
    to: commercialeEmail,
    subject: `${emoji} Lead assegnato a te — ${tipoCliente}: ${nomeContatto}`,
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
  const data = summary.data as MagnusLeadData;
  const emoji = scoreEmoji[summary.score] ?? "";
  const tipoCliente = clienteTypeLabel[data.clienteType] ?? data.clienteType;
  const dataTable = buildDataTable(data);

  const ragioneSociale = data.ragioneSociale ? `\n  • Ragione Sociale: ${data.ragioneSociale}` : "";
  const partitaIVA = data.partitaIVA ? `\n  • Partita IVA: ${data.partitaIVA}` : "";

  const text = `
Nuova richiesta ricevuta tramite il qualificatore Magnus SRL.

=== DATI DI CONTATTO ===
  • Nome: ${contactInfo.nome} ${contactInfo.cognome}
  • Email: ${contactInfo.email}${contactInfo.telefono ? `\n  • Telefono: ${contactInfo.telefono}` : ""}
  • Tipo cliente: ${tipoCliente}${ragioneSociale}${partitaIVA}

=== PRIORITÀ ===
  • Score: ${emoji} ${summary.score}
  • Completezza: ${Math.round(summary.completeness)}%

=== PRODOTTO RICHIESTO ===
${dataTable}

=== PROSSIMO PASSO ===
${summary.nextStep}

Lead ID: ${summary.id}
Data: ${new Date(summary.createdAt).toLocaleString("it-IT")}
`.trim();

  await transport.sendMail({
    from,
    to: agencyEmail,
    subject: `${emoji} Nuova richiesta ${summary.score} — ${tipoCliente}: ${contactInfo.nome} ${contactInfo.cognome}`,
    text,
  });
}
