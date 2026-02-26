"use client";

import { useState } from "react";
import type { ContactInfo } from "@/types/lead";
import Button from "@/components/ui/Button";

interface Props {
  onSubmit: (info: ContactInfo) => void;
}

export default function ContactForm({ onSubmit }: Props) {
  const [form, setForm] = useState({ nome: "", cognome: "", eta: "", email: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.nome.trim()) errs.nome = "Campo obbligatorio";
    if (!form.cognome.trim()) errs.cognome = "Campo obbligatorio";
    const eta = parseInt(form.eta, 10);
    if (!form.eta || isNaN(eta) || eta < 18 || eta > 99)
      errs.eta = "Inserisci un'età valida (18-99)";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Inserisci un'email valida";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      nome: form.nome.trim(),
      cognome: form.cognome.trim(),
      eta: parseInt(form.eta, 10),
      email: form.email.trim().toLowerCase(),
    });
  }

  function field(
    id: keyof typeof form,
    label: string,
    type: string = "text",
    placeholder?: string
  ) {
    return (
      <div>
        <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-600">
          {label} <span className="text-red-500">*</span>
        </label>
        <input
          id={id}
          type={type}
          value={form[id]}
          onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))}
          placeholder={placeholder}
          className={`w-full rounded-lg border px-3 py-2 text-base outline-none transition-colors focus:ring-2 focus:ring-blue-300 ${
            errors[id] ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"
          }`}
        />
        {errors[id] && <p className="mt-0.5 text-xs text-red-500">{errors[id]}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field("nome", "Nome", "text", "Mario")}
        {field("cognome", "Cognome", "text", "Rossi")}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field("eta", "Età", "number", "35")}
        {field("email", "Email", "email", "mario@example.com")}
      </div>
      <Button type="submit" className="w-full" size="lg">
        Continua →
      </Button>
    </form>
  );
}
