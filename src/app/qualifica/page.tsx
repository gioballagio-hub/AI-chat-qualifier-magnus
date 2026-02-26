import type { LeadType } from "@/types/lead";
import ChatContainer from "@/components/chat/ChatContainer";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ tipo?: string }>;
}

export default async function QualificaPage({ searchParams }: Props) {
  const params = await searchParams;
  const tipo = params.tipo;
  const initialType: LeadType | undefined =
    tipo === "buyer" ? "BUYER" : tipo === "seller" ? "SELLER" : undefined;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
          ← Torna alla home
        </Link>
        <span className="text-sm font-medium text-gray-700">
          Qualifica la tua richiesta
        </span>
      </header>

      {/* Chat */}
      <div className="flex-1 mx-auto w-full max-w-lg flex flex-col" style={{ height: "calc(100dvh - 57px)" }}>
        <ChatContainer initialType={initialType} />
      </div>
    </div>
  );
}
