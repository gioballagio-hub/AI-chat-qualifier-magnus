import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { LABEL_MAP, FIELD_LABELS } from "@/constants/questions";
import type { BuyerData, SellerData } from "@/types/lead";
import type { Lead } from "@prisma/client";

function resolveLabel(field: string, value: unknown): string {
  if (!value) return "";
  const map = LABEL_MAP[field];
  if (map && typeof value === "string" && map[value]) return map[value];
  return String(value);
}

export async function GET() {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" } });

  const rows = (leads as Lead[]).map((l) => {
    const d = l.data as BuyerData & SellerData;
    return {
      ID: l.id,
      Tipo: l.type === "BUYER" ? "Compratore" : "Venditore",
      Score: l.score,
      Completezza: `${Math.round(l.completeness)}%`,
      Stato: l.status,
      [FIELD_LABELS["zona"] ?? "Zona"]: d.zona ?? "",
      [FIELD_LABELS["tipologia"] ?? "Tipologia"]: resolveLabel("tipologia", d.tipologia),
      [FIELD_LABELS["budgetMin"] ?? "Budget"]: resolveLabel("budgetMin", d.budgetMin),
      [FIELD_LABELS["metratura"] ?? "Metratura"]: resolveLabel("metratura", d.metratura),
      [FIELD_LABELS["stato"] ?? "Stato immobile"]: resolveLabel("stato", d.stato),
      [FIELD_LABELS["tempistiche"] ?? "Tempistiche"]: resolveLabel("tempistiche", d.tempistiche),
      [FIELD_LABELS["mutuo"] ?? "Mutuo"]: resolveLabel("mutuo", d.mutuo),
      Note: d.note ?? "",
      "Prossimo step": l.nextStep,
      "Webhook inviato": l.sentToIntegration ? "Sì" : "No",
      "Data creazione": new Date(l.createdAt).toLocaleString("it-IT"),
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lead");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lead-export-${Date.now()}.xlsx"`,
    },
  });
}
