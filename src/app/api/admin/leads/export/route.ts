import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { FIELD_LABELS } from "@/constants/questions";
import type { MagnusLeadData } from "@/types/lead";
import type { Lead } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const score = searchParams.get("score");
  const status = searchParams.get("status");
  const clienteType = searchParams.get("clienteType");
  const q = searchParams.get("q")?.trim() ?? "";
  const format = searchParams.get("format") ?? "xlsx"; // "xlsx" | "csv"

  const where: Record<string, unknown> = { deletedAt: null };
  if (score) where["score"] = score;
  if (status) where["status"] = status;
  if (clienteType) where["clienteType"] = clienteType;
  if (q) {
    where["OR"] = [
      { nome: { contains: q, mode: "insensitive" } },
      { cognome: { contains: q, mode: "insensitive" } },
      { emailContatto: { contains: q, mode: "insensitive" } },
      { telefono: { contains: q, mode: "insensitive" } },
      { ragioneSociale: { contains: q, mode: "insensitive" } },
      { partitaIVA: { contains: q, mode: "insensitive" } },
      { brandProdotto: { contains: q, mode: "insensitive" } },
      { codiceProdotto: { contains: q, mode: "insensitive" } },
      { vinCode: { contains: q, mode: "insensitive" } },
      { categoriaProdotto: { contains: q, mode: "insensitive" } },
      { commercialeAssegnato: { contains: q, mode: "insensitive" } },
    ];
  }

  const leads = await prisma.lead.findMany({ where, orderBy: { createdAt: "desc" } });

  const rows = (leads as Lead[]).map((l) => {
    const d = l.data as unknown as MagnusLeadData;
    return {
      ID: l.id,
      "Tipo cliente": l.clienteType,
      "Ragione sociale": d.ragioneSociale ?? "",
      "P.IVA": d.partitaIVA ?? "",
      "Nome contatto": [l.nome, l.cognome].filter(Boolean).join(" "),
      Email: l.emailContatto ?? "",
      Telefono: l.telefono ?? "",
      Score: l.score,
      Completezza: `${Math.round(l.completeness)}%`,
      Stato: l.status,
      Descrizione: d.descrizioneProdotto ?? "",
      Categoria: d.categoriaProdotto ?? "",
      Brand: d.brandProdotto ?? "",
      [FIELD_LABELS["codiceProdotto"] ?? "Codice prodotto"]: d.codiceProdotto ?? "",
      [FIELD_LABELS["vinCode"] ?? "VIN"]: d.vinCode ?? "",
      Note: d.noteAggiuntive ?? "",
      Commerciale: l.commercialeAssegnato ?? "",
      "Prossimo step": l.nextStep,
      "Webhook inviato": l.sentToIntegration ? "Sì" : "No",
      "Data creazione": new Date(l.createdAt).toLocaleString("it-IT"),
    };
  });

  const timestamp = new Date().toISOString().slice(0, 10);

  // CSV export
  if (format === "csv") {
    const headers = Object.keys(rows[0] ?? {});
    const escape = (v: unknown) => {
      const s = String(v ?? "").replace(/"/g, '""');
      return /[",\n\r]/.test(s) ? `"${s}"` : s;
    };
    const csvLines = [
      headers.join(","),
      ...rows.map((row) => headers.map((h) => escape((row as Record<string, unknown>)[h])).join(",")),
    ];
    const csv = "\uFEFF" + csvLines.join("\r\n"); // BOM per Excel italiano

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lead-magnus-${timestamp}.csv"`,
      },
    });
  }

  // Excel export (default)
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lead");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lead-magnus-${timestamp}.xlsx"`,
    },
  });
}
