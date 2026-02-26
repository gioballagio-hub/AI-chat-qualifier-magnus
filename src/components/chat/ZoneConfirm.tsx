"use client";

import Button from "@/components/ui/Button";

// Tipo locale — ZoneExtractResult rimosso dai tipi chat
interface ZoneExtractResult {
  zona: string;
  confidence: "high" | "low";
  raw: string;
}

interface ZoneConfirmProps {
  result: ZoneExtractResult;
  onConfirm: (zona: string) => void;
  onRetry: () => void;
}

export default function ZoneConfirm({ result, onConfirm, onRetry }: ZoneConfirmProps) {
  return (
    <div className="px-2 py-2">
      <div className="mb-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Ho capito:{" "}
        <span className="font-semibold">{result.zona}</span>
        <br />
        <span className="text-xs text-blue-600">È corretto?</span>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => onConfirm(result.zona)} size="sm">
          Sì, corretto
        </Button>
        <Button onClick={onRetry} variant="secondary" size="sm">
          No, riscrivo
        </Button>
      </div>
    </div>
  );
}
