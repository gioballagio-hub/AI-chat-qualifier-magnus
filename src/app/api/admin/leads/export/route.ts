import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { FIELD_LABELS } from "@/constants/questions";
import type { MagnusLeadData } from "@/types/lead";
import type { Lead } from "@prisma/client";

export async function GET() {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" } });

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

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lead");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lead-magnus-${Date.now()}.xlsx"`,
    },
  });
}
