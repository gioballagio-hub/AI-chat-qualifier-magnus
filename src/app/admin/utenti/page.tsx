"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";

interface Utente {
  id: string;
  email: string;
  nome: string;
  ruolo: string;
  attivo: boolean;
  createdAt: string;
}

const ruoloLabel: Record<string, string> = {
  ADMIN: "🛡️ Admin",
  COMMERCIALE: "👤 Commerciale",
};

export default function UtentiPage() {
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form nuovo utente
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", password: "", ruolo: "COMMERCIALE" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadUtenti() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Accesso negato — solo gli Admin possono gestire gli utenti");
      const data = await res.json();
      setUtenti(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento utenti");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUtenti(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Errore creazione utente");
      }
      setForm({ nome: "", email: "", password: "", ruolo: "COMMERCIALE" });
      setShowForm(false);
      await loadUtenti();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Errore");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAttivo(utente: Utente) {
    await fetch(`/api/admin/users/${utente.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attivo: !utente.attivo }),
    });
    await loadUtenti();
  }

  async function handleDelete(utente: Utente) {
    if (!confirm(`Eliminare l'utente ${utente.nome}? Questa azione non è reversibile.`)) return;
    await fetch(`/api/admin/users/${utente.id}`, { method: "DELETE" });
    await loadUtenti();
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      Caricamento utenti…
    </div>
  );

  if (error) return (
    <div className="rounded-xl bg-red-50 px-6 py-8 text-center text-red-700">
      <p className="font-medium">Accesso negato</p>
      <p className="text-sm mt-1">{error}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestione Utenti</h1>
          <p className="text-sm text-gray-500">{utenti.length} utenti registrati</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          {showForm ? "Annulla" : "+ Nuovo utente"}
        </Button>
      </div>

      {/* Form nuovo utente */}
      {showForm && (
        <Card>
          <CardHeader>
            <span className="text-sm font-medium text-gray-700">Crea nuovo utente</span>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Nome *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Mario Rossi"
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="mario@magnus.it"
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Password * (min 6 caratteri)</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Ruolo *</label>
                <select
                  value={form.ruolo}
                  onChange={(e) => setForm((f) => ({ ...f, ruolo: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                >
                  <option value="COMMERCIALE">👤 Commerciale</option>
                  <option value="ADMIN">🛡️ Admin</option>
                </select>
              </div>
              {formError && (
                <p className="col-span-2 text-sm text-red-600">{formError}</p>
              )}
              <div className="col-span-2">
                <Button type="submit" loading={saving} className="w-full">
                  Crea utente
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Tabella utenti */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {utenti.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p>Nessun utente ancora.</p>
            <p className="text-sm mt-1">Crea il primo utente con il pulsante in alto.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-500">Nome</th>
                <th className="px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 font-medium text-gray-500">Ruolo</th>
                <th className="px-4 py-3 font-medium text-gray-500">Stato</th>
                <th className="px-4 py-3 font-medium text-gray-500">Creato</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {utenti.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{u.nome}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{u.email}</td>
                  <td className="px-4 py-3 text-xs">{ruoloLabel[u.ruolo] ?? u.ruolo}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.attivo
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {u.attivo ? "Attivo" : "Disabilitato"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(u.createdAt).toLocaleDateString("it-IT")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => toggleAttivo(u)}
                        className="text-xs text-gray-400 hover:text-blue-600 cursor-pointer"
                        title={u.attivo ? "Disabilita" : "Abilita"}
                      >
                        {u.attivo ? "Disabilita" : "Abilita"}
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="text-xs text-red-400 hover:text-red-600 cursor-pointer"
                        title="Elimina"
                      >
                        Elimina
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
