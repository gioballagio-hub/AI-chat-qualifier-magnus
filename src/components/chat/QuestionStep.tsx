"use client";

import { useState, KeyboardEvent } from "react";
import type { ChatStep } from "@/types/chat";
import Button from "@/components/ui/Button";

interface QuestionStepProps {
  step: ChatStep;
  onAnswer: (value: string) => void;
  disabled?: boolean;
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

  // freetext + ai_zone: input singola riga
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
