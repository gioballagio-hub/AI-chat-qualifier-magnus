"use client";

import { useEffect } from "react";

const CHATWOOT_URL = process.env.NEXT_PUBLIC_CHATWOOT_URL ?? "https://chatwoot-production-7a9b.up.railway.app";

export default function ChatwootPage() {
  useEffect(() => {
    window.open(CHATWOOT_URL, "_blank");
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="text-5xl">💬</div>
      <h2 className="text-xl font-semibold text-gray-800">Chatwoot WhatsApp Inbox</h2>
      <p className="text-sm text-gray-500">Si apre automaticamente in una nuova finestra.</p>
      <a
        href={CHATWOOT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        Apri Chatwoot
      </a>
    </div>
  );
}
