"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

interface SettingsData {
  integrationMode: "WEBHOOK" | "DISABLED";
  webhookUrl: string;
  webhookSecretSet: boolean;
  notificheEmailCommerciale: boolean;
}

interface Props {
  initial: SettingsData;
}

export default function SettingsForm({ initial }: Props) {
  const [mode, setMode] = useState<"WEBHOOK" | "DISABLED">(initial.integrationMode);
  const [webhookUrl, setWebhookUrl] = useState(initial.webhookUrl);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [notificheEmail, setNotificheEmail] = useState(initial.notificheEmailCommerciale);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        integrationMode: mode,
        webhookUrl,
        notificheEmailCommerciale: notificheEmail,
      };
      if (webhookSecret) body["webhookSecret"] = webhookSecret;

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Errore salvataggio");
      }
      setMsg({ type: "ok", text: "Impostazioni salvate." });
      setWebhookSecret("");
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Errore" });
    } finally {
      setSaving(false);
    }
  };

  const testWebhook = async () => {
    setTesting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Test fallito");
      setMsg({ type: "ok", text: `Webhook OK (status ${data.status})` });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Errore" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Modalità integrazione
        </label>
        <div className="flex gap-3">
          {(["WEBHOOK", "DISABLED"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                mode === m
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {m === "WEBHOOK" ? "Webhook" : "Disabilitato"}
            </button>
          ))}
        </div>
      </div>

      {mode === "WEBHOOK" && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL Webhook
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Secret (opzionale)
              {initial.webhookSecretSet && (
                <span className="ml-2 text-xs text-green-600">✓ Secret configurato</span>
              )}
            </label>
            <input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={initial.webhookSecretSet ? "Lascia vuoto per mantenere" : "Nuovo secret…"}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-400">
              Inviato come header <code>X-Lead-Secret</code> ad ogni POST.
            </p>
          </div>
        </>
      )}

      {/* Toggle notifiche email commerciale */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-700">📧 Notifiche email ai commerciali</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Invia un'email al commerciale quando gli viene assegnato un lead
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNotificheEmail((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
            notificheEmail ? "bg-blue-600" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              notificheEmail ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {msg && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            msg.type === "ok"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={save} loading={saving}>
          Salva impostazioni
        </Button>
        {mode === "WEBHOOK" && webhookUrl && (
          <Button onClick={testWebhook} loading={testing} variant="secondary">
            Testa webhook
          </Button>
        )}
      </div>
    </div>
  );
}
