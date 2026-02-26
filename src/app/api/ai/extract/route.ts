import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/lib/logger";

interface ZoneExtractResult {
  zona: string;
  confidence: "high" | "low";
  raw: string;
}

const ExtractSchema = z.object({
  text: z.string().min(1).max(500),
});

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = ExtractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Testo non valido" }, { status: 400 });
  }

  const { text } = parsed.data;
  const ai = getClient();

  // Fallback senza AI
  if (!ai) {
    logger.info("AI non configurata, uso testo raw per zona");
    const result: ZoneExtractResult = { zona: text, confidence: "low", raw: text };
    return NextResponse.json(result);
  }

  try {
    const message = await ai.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: `Estrai la zona o il quartiere dalla seguente frase scritta da un utente italiano interessato a un immobile.
Rispondi SOLO con un JSON valido nel formato: {"zona": "nome zona estratto", "confidence": "high" o "low"}
- "high" se hai identificato chiaramente un quartiere, zona, città o area geografica
- "low" se il testo è ambiguo o non contiene una zona chiara

Frase: "${text}"`,
        },
      ],
    });

    const raw = message.content[0];
    if (raw.type !== "text") throw new Error("Risposta AI non testuale");

    const jsonMatch = raw.text.match(/\{[^}]+\}/);
    if (!jsonMatch) throw new Error("JSON non trovato nella risposta AI");

    const parsed2 = JSON.parse(jsonMatch[0]) as { zona?: string; confidence?: string };
    if (!parsed2.zona) throw new Error("Campo zona mancante");

    const result: ZoneExtractResult = {
      zona: String(parsed2.zona),
      confidence: parsed2.confidence === "high" ? "high" : "low",
      raw: text,
    };
    return NextResponse.json(result);
  } catch (err) {
    logger.warn("Errore AI estrazione zona, uso fallback", {
      error: err instanceof Error ? err.message : String(err),
    });
    const result: ZoneExtractResult = { zona: text, confidence: "low", raw: text };
    return NextResponse.json(result);
  }
}
