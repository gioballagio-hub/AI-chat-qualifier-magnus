import Badge from "@/components/ui/Badge";
import type { LeadScore } from "@/types/lead";

const scoreVariant: Record<LeadScore, "alta" | "media" | "bassa"> = {
  ALTA: "alta",
  MEDIA: "media",
  BASSA: "bassa",
};
const scoreEmoji: Record<LeadScore, string> = { ALTA: "🔥", MEDIA: "☀️", BASSA: "❄️" };
const scoreLabel: Record<LeadScore, string> = { ALTA: "Alta", MEDIA: "Media", BASSA: "Bassa" };

export default function ScoreBadge({ score }: { score: LeadScore }) {
  return (
    <Badge variant={scoreVariant[score]}>
      {scoreEmoji[score]} {scoreLabel[score]}
    </Badge>
  );
}
