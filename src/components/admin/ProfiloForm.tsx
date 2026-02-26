"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

export default function ProfiloForm() {
  const [passwordAttuale, setPasswordAttuale] = useState("");
  const [nuovaPassword, setNuovaPassword] = useState("");
  const [confermaPassword, setConfermaPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Validazione lato client
  function validate() {
    if (!passwordAttuale) return "Inserisci la password attuale";
    if (nuovaPassword.length < 8) return "La nuova password deve essere di almeno 8 caratteri";
    if (nuovaPassword !== confermaPassword) return "Le password non coincidono";
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    const err = validate();
    if (err) {
      setMsg({ type: "err", text: err });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/profilo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordAttuale, nuovaPassword, confermaPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore");

      setMsg({ type: "ok", text: "Password aggiornata con successo." });
      setPasswordAttuale("");
      setNuovaPassword("");
      setConfermaPassword("");
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Errore" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Password attuale
        </label>
        <input
          type="password"
          value={passwordAttuale}
          onChange={(e) => setPasswordAttuale(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          placeholder="••••••••"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nuova password
          <span className="ml-1 text-xs text-gray-400">(min. 8 caratteri)</span>
        </label>
        <input
          type="password"
          value={nuovaPassword}
          onChange={(e) => setNuovaPassword(e.target.value)}
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          placeholder="••••••••"
        />
        {/* Indicatore forza password */}
        {nuovaPassword.length > 0 && (
          <div className="mt-1 flex gap-1">
            {[
              nuovaPassword.length >= 8,
              /[A-Z]/.test(nuovaPassword),
              /[0-9]/.test(nuovaPassword),
              /[^A-Za-z0-9]/.test(nuovaPassword),
            ].map((passed, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  passed ? "bg-green-400" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        )}
        {nuovaPassword.length > 0 && (
          <p className="mt-1 text-xs text-gray-400">
            {nuovaPassword.length < 8
              ? "Troppo corta"
              : /[A-Z]/.test(nuovaPassword) && /[0-9]/.test(nuovaPassword) && /[^A-Za-z0-9]/.test(nuovaPassword)
              ? "Ottima"
              : /[A-Z]/.test(nuovaPassword) || /[0-9]/.test(nuovaPassword)
              ? "Buona — aggiungi numeri o simboli per rafforzarla"
              : "Media"}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Conferma nuova password
        </label>
        <input
          type="password"
          value={confermaPassword}
          onChange={(e) => setConfermaPassword(e.target.value)}
          autoComplete="new-password"
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
            confermaPassword && confermaPassword !== nuovaPassword
              ? "border-red-300 focus:border-red-400"
              : "border-gray-200 focus:border-blue-400"
          }`}
          placeholder="••••••••"
        />
        {confermaPassword && confermaPassword !== nuovaPassword && (
          <p className="mt-1 text-xs text-red-500">Le password non coincidono</p>
        )}
      </div>

      {msg && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      <Button type="submit" loading={saving}>
        Aggiorna password
      </Button>
    </form>
  );
}
