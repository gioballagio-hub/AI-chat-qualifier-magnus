import type { LeadSummary as LeadSummaryType } from "@/types/lead";
import { LABEL_MAP, FIELD_LABELS } from "@/constants/questions";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";

interface LeadSummaryProps {
  summary: LeadSummaryType;
  customerEmail?: string;
}

function resolveValue(field: string, value: unknown): string {
  if (!value || (typeof value === "string" && value.trim() === "")) return "—";
  const map = LABEL_MAP[field];
  if (map && typeof value === "string" && map[value]) return map[value];
  return String(value);
}

const CLIENTE_TYPE_LABEL: Record<string, string> = {
  AZIENDA: "🏢 Azienda",
  PRIVATO: "👤 Privato",
  INDEFINITO: "Indefinito",
};

export default function LeadSummary({ summary, customerEmail }: LeadSummaryProps) {
  const data = summary.data;

  // Campi da mostrare nel riepilogo, in ordine logico (escludi clienteType già mostrato nell'header)
  const DISPLAY_FIELDS = [
    "ragioneSociale",
    "partitaIVA",
    "descrizioneProdotto",
    "categoriaProdotto",
    "brandProdotto",
    "codiceProdotto",
    "vinCode",
    "linkProdotto",
    "noteAggiuntive",
  ];

  const fields = DISPLAY_FIELDS
    .map((key) => [key, (data as Record<string, unknown>)[key]] as [string, unknown])
    .filter(([, val]) => !!val && (typeof val !== "string" || val.trim() !== ""));

  const tipoLabel = CLIENTE_TYPE_LABEL[data.clienteType] ?? data.clienteType;

  return (
    <div className="space-y-4 px-2 py-2">
      <div className="text-center">
        <div className="mb-1 text-2xl">✅</div>
        <h2 className="text-lg font-semibold text-gray-900">Richiesta inviata!</h2>
        <p className="text-sm text-gray-500">
          Il team commerciale Magnus SRL ti contatterà il prima possibile.
        </p>
      </div>

      <Card>
        <CardHeader>
          <span className="text-sm font-medium text-gray-700">{tipoLabel}</span>
        </CardHeader>
        <CardBody>
          {fields.length > 0 ? (
            <dl className="space-y-2">
              {fields.map(([key, val]) => (
                <div key={key} className="flex justify-between text-sm gap-2">
                  <dt className="text-gray-500 shrink-0">{FIELD_LABELS[key] ?? key}</dt>
                  <dd className="max-w-[60%] text-right font-medium text-gray-800 break-words">
                    {resolveValue(key, val)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-gray-400">Nessun dettaglio prodotto fornito.</p>
          )}
        </CardBody>
      </Card>

      <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm">
        <p className="font-medium text-blue-800">📧 Email di conferma inviata</p>
        {customerEmail && (
          <p className="text-blue-600">
            Controlla la tua casella: <strong>{customerEmail}</strong>
          </p>
        )}
      </div>

      <p className="text-center text-xs text-gray-400 pb-2">
        Ricorda: ordini minimi €300. Per info urgenti contatta direttamente Magnus SRL.
      </p>
    </div>
  );
}
