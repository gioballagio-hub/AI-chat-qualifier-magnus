import { prisma } from "@/lib/prisma";
import SettingsForm from "@/components/admin/SettingsForm";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function ImpostazioniPage() {
  let settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings) {
    settings = await prisma.settings.create({ data: { id: 1 } });
  }

  const initial = {
    integrationMode: (settings.integrationMode as "WEBHOOK" | "DISABLED") ?? "DISABLED",
    webhookUrl: settings.webhookUrl ?? "",
    webhookSecretSet: !!settings.webhookSecret,
    notificheEmailCommerciale: settings.notificheEmailCommerciale ?? true,
  };

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Impostazioni</h1>

      <Card>
        <CardHeader>
          <span className="text-sm font-medium text-gray-700">Integrazione Webhook</span>
        </CardHeader>
        <CardBody>
          <SettingsForm initial={initial} />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <p className="text-xs text-gray-400 mb-2">Payload inviato ad ogni nuovo lead:</p>
          <pre className="overflow-x-auto rounded-lg bg-gray-900 px-4 py-3 text-xs text-green-300">
{`{
  "event": "lead.created",
  "lead": {
    "id": "...",
    "type": "BUYER" | "SELLER",
    "data": { ... },
    "score": "CALDO" | "TIEPIDO" | "FREDDO",
    "completeness": 80,
    "missingFields": ["mutuo"],
    "nextStep": "...",
    "createdAt": "2024-01-01T..."
  }
}`}
          </pre>
        </CardBody>
      </Card>
    </div>
  );
}
