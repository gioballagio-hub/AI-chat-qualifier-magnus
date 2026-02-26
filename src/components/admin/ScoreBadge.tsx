import Badge from "@/components/ui/Badge";
import type { LeadScore } from "@/types/lead";

const scoreVariant = {
  CALDO: "caldo" as const,
  TIEPIDO: "tiepido" as const,
  FREDDO: "freddo" as const,
};
const scoreEmoji = { CALDO: "🔥", TIEPIDO: "☀️", FREDDO: "❄️" };

export default function ScoreBadge({ score }: { score: LeadScore }) {
  return (
    <Badge variant={scoreVariant[score]}>
      {scoreEmoji[score]} {score}
    </Badge>
  );
}
