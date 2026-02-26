import type { ChatMessage } from "@/types/chat";

interface ChatBubbleProps {
  message: ChatMessage;
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isAgent = message.role === "agent";
  return (
    <div className={`flex ${isAgent ? "justify-start" : "justify-end"} mb-3`}>
      {isAgent && (
        <div className="mr-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
          A
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isAgent
            ? "rounded-tl-sm bg-gray-100 text-gray-800"
            : "rounded-tr-sm bg-blue-600 text-white"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
