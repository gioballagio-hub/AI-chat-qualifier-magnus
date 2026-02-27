import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";

const BLOB_DOMAIN = ".blob.vercel-storage.com";

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const blobUrl = req.nextUrl.searchParams.get("url");
  if (!blobUrl) {
    return NextResponse.json({ error: "URL mancante" }, { status: 400 });
  }

  // Verifica che sia un URL Vercel Blob legittimo
  let parsed: URL;
  try {
    parsed = new URL(blobUrl);
  } catch {
    return NextResponse.json({ error: "URL non valido" }, { status: 400 });
  }

  if (!parsed.hostname.endsWith(BLOB_DOMAIN)) {
    return NextResponse.json({ error: "URL non autorizzato" }, { status: 403 });
  }

  try {
    const res = await fetch(blobUrl, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "File non trovato" }, { status: 404 });
    }

    const contentType = res.headers.get("content-type") ?? "application/octet-stream";

    return new NextResponse(res.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Errore recupero file" }, { status: 500 });
  }
}
