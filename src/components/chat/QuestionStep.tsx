"use client";

import { useState, KeyboardEvent } from "react";
import type { ChatStep } from "@/types/chat";
import Button from "@/components/ui/Button";

interface QuestionStepProps {
  step: ChatStep;
  onAnswer: (value: string) => void;
  disabled?: boolean;
}

function FileUploadInput({ step, onAnswer, disabled }: QuestionStepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/leads/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore upload");
      onAnswer(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il caricamento");
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 px-2 py-2">
      <label className="cursor-pointer rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-center text-sm text-gray-500 hover:border-blue-400 hover:bg-blue-50 transition-colors">
        {file ? (
          <span className="text-gray-800 font-medium">📄 {file.name}</span>
        ) : (
          <span>Clicca per selezionare un file <br /><span className="text-xs text-gray-400">PDF, JPG, PNG — max 5MB</span></span>
        )}
        <input
          type="file"
          className="sr-only"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); }}
          disabled={disabled || uploading}
        />
      </label>
      {error && <p className="text-xs text-red-500 px-1">{error}</p>}
      <div className="flex gap-2">
        {!step.required && (
          <Button
            onClick={() => onAnswer("")}
            disabled={disabled || uploading}
            variant="secondary"
            size="sm"
          >
            Salta
          </Button>
        )}
        <Button
          onClick={handleUpload}
          disabled={disabled || !file || uploading}
          loading={uploading}
          size="sm"
          className="flex-1"
        >
          {uploading ? "Caricamento…" : "Carica documento"}
        </Button>
      </div>
    </div>
  );
}

export default function QuestionStep({ step, onAnswer, disabled }: QuestionStepProps) {
  const [text, setText] = useState("");

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const val = text.trim();
      if (val || !step.required) {
        setText("");
        onAnswer(val);
      }
    }
  };

  if (step.type === "file") {
    return <FileUploadInput step={step} onAnswer={onAnswer} disabled={disabled} />;
  }

  if (step.type === "select" && step.options) {
    return (
      <div className="flex flex-wrap gap-2 px-2 py-2">
        {step.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onAnswer(opt.value)}
            disabled={disabled}
            className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm text-blue-700 transition-colors hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50 cursor-pointer"
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  if (step.type === "textarea") {
    return (
      <div className="flex gap-2 px-2 py-2">
        <textarea
          className="flex-1 resize-none rounded-xl border border-gray-200 p-3 text-base focus:border-blue-400 focus:outline-none"
          rows={3}
          placeholder={step.placeholder ?? "Scrivi qui…"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const val = text.trim();
              if (val || !step.required) {
                setText("");
                onAnswer(val);
              }
            }
          }}
        />
        <Button
          onClick={() => { const val = text.trim(); if (val || !step.required) { setText(""); onAnswer(val); } }}
          disabled={disabled || (step.required && !text.trim())}
          size="sm"
          className="self-end"
        >
          {!step.required && !text.trim() ? "Salta" : "Invia"}
        </Button>
      </div>
    );
  }

  // freetext: input singola riga
  return (
    <div className="flex gap-2 px-2 py-2">
      <input
        type="text"
        className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-base focus:border-blue-400 focus:outline-none"
        placeholder={step.placeholder ?? "Scrivi qui…"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKey}
        disabled={disabled}
      />
      <Button
        onClick={() => { const v = text.trim(); if (v || !step.required) { setText(""); onAnswer(v); } }}
        disabled={disabled || (step.required && !text.trim())}
        size="sm"
      >
        Avanti
      </Button>
    </div>
  );
}
