"use client";

export default function ChatwootPage() {
  const chatwootUrl = process.env.NEXT_PUBLIC_CHATWOOT_URL ?? "https://chatwoot-production-7a9b.up.railway.app";

  return (
    <div className="fixed inset-0 z-10" style={{ top: 53 }}>
      <iframe
        src={chatwootUrl}
        className="w-full h-full border-0"
        title="Chatwoot Inbox"
        allow="microphone; camera"
      />
    </div>
  );
}
