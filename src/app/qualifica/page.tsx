import ChatContainer from "@/components/chat/ChatContainer";
import Link from "next/link";

export default async function QualificaPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
          ← Torna alla home
        </Link>
        <span className="text-sm font-medium text-gray-700">
          Richiesta ricambi — Magnus SRL
        </span>
      </header>

      {/* Chat */}
      <div
        className="flex-1 mx-auto w-full max-w-lg flex flex-col"
        style={{ height: "calc(100dvh - 57px)" }}
      >
        <ChatContainer />
      </div>
    </div>
  );
}
