import type { LeadSummary as LeadSummaryType } from "@/types/lead";
import { LABEL_MAP, FIELD_LABELS } from "@/constants/questions";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";

interface LeadSummaryProps {
  summary: LeadSummaryType;
  customerEmail?: string;
}

function resolveValue(field: string, value: unknown): string {
  if (!value) return "—";
  const map = LABEL_MAP[field];
  if (map && typeof value === "string" && map[value]) return map[value];
  return String(value);
}

export default function LeadSummary({ summary, customerEmail }: LeadSummaryProps) {
  const fields = Object.entries(summary.data).filter(([k]) => k !== "zonaRaw");
  const tipoLabel = summary.type === "BUYER" ? "Richiesta Acquisto" : "Richiesta Vendita";

  return (
    <div className="space-y-4 px-2 py-2">
      <div className="text-center">
        <div className="mb-1 text-2xl">✅</div>
        <h2 className="text-lg font-semibold text-gray-900">Richiesta inviata!</h2>
        <p className="text-sm text-gray-500">
          Un agente ti contatterà il prima possibile.
        </p>
      </div>

      <Card>
        <CardHeader>
          <span className="text-sm font-medium text-gray-700">{tipoLabel}</span>
        </CardHeader>
        <CardBody>
          <dl className="space-y-2">
            {fields.map(([key, val]) => (
              <div key={key} className="flex justify-between text-sm">
                <dt className="text-gray-500">{FIELD_LABELS[key] ?? key}</dt>
                <dd className="max-w-[60%] text-right font-medium text-gray-800">
                  {resolveValue(key, val)}
                </dd>
              </div>
            ))}
          </dl>
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
    </div>
  );
}
