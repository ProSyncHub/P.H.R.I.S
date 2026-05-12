import { clampScore } from "@/lib/utils";
import type { ActivitySummary, LoginLogoutSummary } from "@/types/analysis";

export function calculateRuleScore(activity: ActivitySummary, attendance: LoginLogoutSummary, eodQuality: string, matchPenalty: number) {
  const attendanceScore = attendance.missingLogout ? 5 : attendance.lateLogin || attendance.earlyLogout ? 12 : 20;
  const workHours = attendance.totalTrackedMinutes / 60;
  const workHoursScore = clampScore(Math.min(20, (workHours / 8) * 20));
  const tracked = Math.max(1, activity.totalProductiveMinutes + activity.totalUnproductiveMinutes + activity.totalIdleMinutes);
  const productiveRatio = activity.totalProductiveMinutes / tracked;
  const productiveScore = clampScore(productiveRatio * 25);
  const eodScore = eodQuality === "Clear" ? 15 : eodQuality === "Average" ? 10 : eodQuality === "Vague" ? 6 : 3;
  const matchScore = clampScore(20 - matchPenalty);

  const finalScore = clampScore(attendanceScore + workHoursScore + productiveScore + eodScore + matchScore);
  const riskLevel = finalScore >= 80 ? "GREEN" : finalScore >= 55 ? "YELLOW" : "RED";

  return {
    score_breakdown: {
      attendance: attendanceScore,
      work_hours: workHoursScore,
      productive_activity: productiveScore,
      eod_clarity: eodScore,
      timechamp_eod_match: matchScore
    },
    final_score: finalScore,
    risk_level: riskLevel as "GREEN" | "YELLOW" | "RED"
  };
}
