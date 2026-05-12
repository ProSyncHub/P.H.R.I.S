import { Badge } from "@/components/ui/badge";

export function RiskBadge({ risk }: { risk: string }) {
  const color =
    risk === "GREEN"
      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
      : risk === "YELLOW"
        ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
        : "border-red-400/40 bg-red-400/10 text-red-200";
  return <Badge className={color}>{risk}</Badge>;
}
