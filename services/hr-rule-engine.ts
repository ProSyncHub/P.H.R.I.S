import type { Employee, PerformanceRuleSet, RiskLevel, RoleUsageRule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clampScore } from "@/lib/utils";
import type { ActivitySummary, ParsedActivityRow } from "@/types/analysis";

const DEFAULT_RELEVANT_APPS = ["vscode", "notion", "figma", "excel", "sheets", "docs", "slack", "teams", "gmail", "outlook", "github"];
const DEFAULT_RELEVANT_WEBSITES = ["github.com", "notion.so", "figma.com", "docs.google.com", "sheets.google.com", "drive.google.com"];
const DEFAULT_IRRELEVANT_APPS = ["youtube", "instagram", "facebook", "netflix", "primevideo", "hotstar", "spotify", "games"];
const DEFAULT_IRRELEVANT_WEBSITES = ["youtube.com", "instagram.com", "facebook.com", "netflix.com", "primevideo.com", "hotstar.com", "x.com", "twitter.com"];

export type RuleEvaluationItem = {
  code: string;
  title: string;
  passed: boolean;
  expected: string;
  actual: string;
  deviation: string;
  scoreImpact: number;
};

export type RuleEvaluationSummary = {
  passed: RuleEvaluationItem[];
  violated: RuleEvaluationItem[];
  all: RuleEvaluationItem[];
};

export type DeterministicScoreBreakdown = {
  attendance: number;
  work_hours: number;
  productive_activity: number;
  eod_clarity: number;
  timechamp_eod_match: number;
  idle_penalty: number;
  irrelevant_usage_penalty: number;
};

export type ActiveRuleConfig = {
  ruleSet: PerformanceRuleSet;
  roleUsageRule: RoleUsageRule | null;
  workingDays: number[];
  relevantApps: string[];
  relevantWebsites: string[];
  irrelevantApps: string[];
  irrelevantWebsites: string[];
};

export type EvaluatePerformanceInput = {
  employee: Pick<Employee, "id" | "fullName" | "department" | "role">;
  activity: ActivitySummary;
  attendance: {
    loginTime?: string;
    logoutTime?: string;
    totalTrackedMinutes: number;
  };
  completedTasks: string[];
  eodQuality: "Clear" | "Average" | "Vague" | "Weak/Suspicious";
};

export type EvaluatePerformanceResult = {
  scoreBreakdown: DeterministicScoreBreakdown;
  finalScore: number;
  riskLevel: RiskLevel;
  ruleEvaluation: RuleEvaluationSummary;
  managerSummary: string;
  recommendation: string;
  flags: string[];
  context: {
    ruleSetName: string;
    scope: "GLOBAL" | "DEPARTMENT";
    department: string | null;
    roleRuleApplied: boolean;
  };
  metrics: {
    productivePct: number;
    idlePct: number;
    irrelevantUsageMinutes: number;
    eodMatchPct: number;
    totalTrackedMinutes: number;
  };
};

function toNumberArray(value: unknown, fallback: number[]) {
  if (!Array.isArray(value)) return fallback;
  const parsed = value.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v >= 0 && v <= 6);
  return parsed.length ? [...new Set(parsed)] : fallback;
}

function toStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const parsed = value.map((v) => String(v).trim().toLowerCase()).filter(Boolean);
  return parsed.length ? [...new Set(parsed)] : fallback;
}

function parseClock(value?: string) {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  const match = normalized.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/);
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3];
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function formatClock(minutes: number) {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const hh = Math.floor(clamped / 60);
  const mm = clamped % 60;
  return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

function formatHours(hours: number) {
  return `${hours.toFixed(2)}h`;
}

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function matchesSignal(text: string, signals: string[]) {
  const normalized = normalizeText(text);
  return signals.some((signal) => normalized.includes(signal));
}

function rowLabel(row: ParsedActivityRow) {
  return [row.appName, row.website, row.url].filter(Boolean).join(" ");
}

function tokenize(text: string) {
  const stopWords = new Set(["and", "the", "for", "with", "from", "this", "that", "been", "also", "into", "were", "was", "are"]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3 && !stopWords.has(token));
}

function calculateEodMatchPct(completedTasks: string[], rows: ParsedActivityRow[], totalTrackedMinutes: number) {
  if (!completedTasks.length || !rows.length || totalTrackedMinutes <= 0) return 0;
  let evidenceMinutes = 0;
  for (const task of completedTasks.slice(0, 12)) {
    const tokens = tokenize(task);
    if (!tokens.length) continue;
    const matched = rows
      .map((row) => {
        const label = rowLabel(row).toLowerCase();
        const matches = tokens.filter((token) => label.includes(token)).length;
        return matches > 0 ? row.durationMinutes : 0;
      })
      .reduce((sum, minutes) => sum + minutes, 0);
    evidenceMinutes += matched;
  }
  const pct = (evidenceMinutes / totalTrackedMinutes) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}

function scoreImpactEntry(
  code: string,
  title: string,
  passed: boolean,
  expected: string,
  actual: string,
  deviation: string,
  scoreImpact: number
): RuleEvaluationItem {
  return { code, title, passed, expected, actual, deviation, scoreImpact };
}

function chooseRoleUsageRule(rules: RoleUsageRule[], role: string, department: string) {
  const normalizedRole = role.trim().toLowerCase();
  const normalizedDept = department.trim().toLowerCase();
  const byRole = rules.filter((rule) => rule.role.trim().toLowerCase() === normalizedRole && rule.isActive);
  const exactDepartment = byRole.find((rule) => (rule.department ?? "").trim().toLowerCase() === normalizedDept);
  if (exactDepartment) return exactDepartment;
  return byRole.find((rule) => !rule.department) ?? null;
}

export function splitListInput(value: string) {
  return [...new Set(value.split(/[\n,]/).map((item) => item.trim().toLowerCase()).filter(Boolean))];
}

export async function ensureGlobalRuleSet() {
  const existing = await prisma.performanceRuleSet.findFirst({
    where: { scope: "GLOBAL", isActive: true },
    orderBy: { updatedAt: "desc" }
  });
  if (existing) return existing;

  return prisma.performanceRuleSet.create({
    data: {
      name: "Default Global HR Rules",
      scope: "GLOBAL",
      isActive: true,
      workingDays: [1, 2, 3, 4, 5, 6],
      expectedLoginMinutes: 10 * 60,
      expectedLogoutMinutes: 18 * 60 + 30,
      gracePeriodMinutes: 5,
      minimumWorkingHours: 8,
      idealWorkingHours: 8.5,
      shortDayThresholdHours: 7.5,
      criticalShortDayThresholdHours: 6.5,
      productivePctGood: 70,
      productivePctWarning: 55,
      idlePctWarning: 20,
      idlePctCritical: 30,
      irrelevantUsageWarningMinutes: 45,
      irrelevantUsageCriticalMinutes: 90,
      eodScoreClear: 15,
      eodScoreAverage: 10,
      eodScoreVague: 6,
      eodScoreWeak: 3,
      timechampEodMatchGoodPct: 75,
      timechampEodMatchWarningPct: 50,
      riskGreenMin: 80,
      riskYellowMin: 55
    }
  });
}

export async function getActiveRuleConfig(department: string, role: string): Promise<ActiveRuleConfig> {
  const [departmentRule, globalRule, roleRules] = await Promise.all([
    prisma.performanceRuleSet.findFirst({
      where: { scope: "DEPARTMENT", department, isActive: true },
      orderBy: { updatedAt: "desc" }
    }),
    ensureGlobalRuleSet(),
    prisma.roleUsageRule.findMany({ where: { isActive: true } })
  ]);

  const ruleSet = departmentRule ?? globalRule;
  const roleRule = chooseRoleUsageRule(roleRules, role, department);

  return {
    ruleSet,
    roleUsageRule: roleRule,
    workingDays: toNumberArray(ruleSet.workingDays, [1, 2, 3, 4, 5, 6]),
    relevantApps: toStringArray(roleRule?.relevantApps, DEFAULT_RELEVANT_APPS),
    relevantWebsites: toStringArray(roleRule?.relevantWebsites, DEFAULT_RELEVANT_WEBSITES),
    irrelevantApps: toStringArray(roleRule?.irrelevantApps, DEFAULT_IRRELEVANT_APPS),
    irrelevantWebsites: toStringArray(roleRule?.irrelevantWebsites, DEFAULT_IRRELEVANT_WEBSITES)
  };
}

function computeIrrelevantUsageMinutes(rows: ParsedActivityRow[], irrelevantApps: string[], irrelevantWebsites: string[]) {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => {
    const app = String(row.appName ?? "");
    const website = String(row.website ?? "");
    const url = String(row.url ?? "");
    const appHit = app ? matchesSignal(app, irrelevantApps) : false;
    const siteHit = website ? matchesSignal(website, irrelevantWebsites) : false;
    const urlHit = url ? matchesSignal(url, irrelevantWebsites) : false;
    return sum + (appHit || siteHit || urlHit ? row.durationMinutes : 0);
  }, 0);
}

export async function evaluatePerformanceWithRules(input: EvaluatePerformanceInput): Promise<EvaluatePerformanceResult> {
  const config = await getActiveRuleConfig(input.employee.department, input.employee.role);
  const { ruleSet } = config;
  const totalTrackedMinutes = Math.max(0, Math.round(input.attendance.totalTrackedMinutes));
  const totalHours = totalTrackedMinutes / 60;
  const productiveMinutes = Math.max(0, Math.round(input.activity.totalProductiveMinutes));
  const idleMinutes = Math.max(0, Math.round(input.activity.totalIdleMinutes));
  const trackedBase = Math.max(1, totalTrackedMinutes);
  const productivePct = Math.round((productiveMinutes / trackedBase) * 1000) / 10;
  const idlePct = Math.round((idleMinutes / trackedBase) * 1000) / 10;
  const irrelevantUsageMinutes = computeIrrelevantUsageMinutes(input.activity.rows ?? [], config.irrelevantApps, config.irrelevantWebsites);
  const eodMatchPct = calculateEodMatchPct(input.completedTasks, input.activity.rows ?? [], totalTrackedMinutes);

  const date = new Date(input.activity.date ?? Date.now());
  const day = Number.isNaN(date.getTime()) ? new Date().getDay() : date.getDay();
  const isWorkingDay = config.workingDays.includes(day);

  const loginMinutes = parseClock(input.attendance.loginTime);
  const logoutMinutes = parseClock(input.attendance.logoutTime);
  const grace = ruleSet.gracePeriodMinutes;

  let attendanceScore = 20;
  const checks: RuleEvaluationItem[] = [];

  if (!isWorkingDay) {
    checks.push(
      scoreImpactEntry("working_days", "Working day rule", true, `Day index in [${config.workingDays.join(", ")}]`, `Day index ${day}`, "No deviation", 0)
    );
  } else {
    const lateBy = Math.max(0, (loginMinutes ?? ruleSet.expectedLoginMinutes + grace) - (ruleSet.expectedLoginMinutes + grace));
    const earlyBy = Math.max(0, (ruleSet.expectedLogoutMinutes - grace) - (logoutMinutes ?? 0));
    const missingLogout = !logoutMinutes;
    const loginImpact = lateBy > 0 ? -Math.min(8, Math.ceil(lateBy / 10) * 2) : 0;
    const logoutImpact = earlyBy > 0 ? -Math.min(8, Math.ceil(earlyBy / 10) * 2) : 0;
    const missingImpact = missingLogout ? -10 : 0;
    attendanceScore = clampScore(attendanceScore + loginImpact + logoutImpact + missingImpact);

    checks.push(
      scoreImpactEntry(
        "expected_login",
        "Expected login time",
        lateBy <= 0,
        `${formatClock(ruleSet.expectedLoginMinutes)} + ${grace}m grace`,
        loginMinutes !== undefined ? formatClock(loginMinutes) : "Missing",
        lateBy > 0 ? `${lateBy} min late` : "Within grace",
        loginImpact
      )
    );
    checks.push(
      scoreImpactEntry(
        "expected_logout",
        "Expected logout time",
        earlyBy <= 0 && !missingLogout,
        `${formatClock(ruleSet.expectedLogoutMinutes)} - ${grace}m grace`,
        logoutMinutes !== undefined ? formatClock(logoutMinutes) : "Missing",
        missingLogout ? "Logout missing" : earlyBy > 0 ? `${earlyBy} min early` : "Within grace",
        logoutImpact + missingImpact
      )
    );
  }

  let workHoursScore = 20;
  if (totalHours < ruleSet.minimumWorkingHours) workHoursScore -= 8;
  if (totalHours < ruleSet.idealWorkingHours) workHoursScore -= 4;
  if (totalHours < ruleSet.shortDayThresholdHours) workHoursScore -= 4;
  if (totalHours < ruleSet.criticalShortDayThresholdHours) workHoursScore -= 8;
  workHoursScore = clampScore(workHoursScore);

  checks.push(
    scoreImpactEntry(
      "minimum_working_hours",
      "Minimum working hours",
      totalHours >= ruleSet.minimumWorkingHours,
      `>= ${formatHours(ruleSet.minimumWorkingHours)}`,
      formatHours(totalHours),
      totalHours >= ruleSet.minimumWorkingHours ? "No deviation" : `${(ruleSet.minimumWorkingHours - totalHours).toFixed(2)}h short`,
      totalHours >= ruleSet.minimumWorkingHours ? 0 : -8
    )
  );
  checks.push(
    scoreImpactEntry(
      "ideal_working_hours",
      "Ideal working hours",
      totalHours >= ruleSet.idealWorkingHours,
      `>= ${formatHours(ruleSet.idealWorkingHours)}`,
      formatHours(totalHours),
      totalHours >= ruleSet.idealWorkingHours ? "No deviation" : `${(ruleSet.idealWorkingHours - totalHours).toFixed(2)}h below ideal`,
      totalHours >= ruleSet.idealWorkingHours ? 0 : -4
    )
  );
  checks.push(
    scoreImpactEntry(
      "short_day_threshold",
      "Short day threshold",
      totalHours >= ruleSet.shortDayThresholdHours,
      `>= ${formatHours(ruleSet.shortDayThresholdHours)}`,
      formatHours(totalHours),
      totalHours >= ruleSet.shortDayThresholdHours ? "No deviation" : `${(ruleSet.shortDayThresholdHours - totalHours).toFixed(2)}h below threshold`,
      totalHours >= ruleSet.shortDayThresholdHours ? 0 : -4
    )
  );
  checks.push(
    scoreImpactEntry(
      "critical_short_day_threshold",
      "Critical short day threshold",
      totalHours >= ruleSet.criticalShortDayThresholdHours,
      `>= ${formatHours(ruleSet.criticalShortDayThresholdHours)}`,
      formatHours(totalHours),
      totalHours >= ruleSet.criticalShortDayThresholdHours ? "No deviation" : `${(ruleSet.criticalShortDayThresholdHours - totalHours).toFixed(2)}h below critical`,
      totalHours >= ruleSet.criticalShortDayThresholdHours ? 0 : -8
    )
  );

  const productiveScore = productivePct >= ruleSet.productivePctGood ? 25 : productivePct >= ruleSet.productivePctWarning ? 16 : 8;
  checks.push(
    scoreImpactEntry(
      "productive_time_pct",
      "Productive time percentage",
      productivePct >= ruleSet.productivePctWarning,
      `>= ${ruleSet.productivePctWarning}% warning, ${ruleSet.productivePctGood}% good`,
      `${productivePct}%`,
      productivePct >= ruleSet.productivePctGood ? "Good range" : productivePct >= ruleSet.productivePctWarning ? "Warning range" : `${(ruleSet.productivePctWarning - productivePct).toFixed(1)}% below warning`,
      productiveScore - 25
    )
  );

  const idlePenalty = idlePct <= ruleSet.idlePctWarning ? 0 : idlePct <= ruleSet.idlePctCritical ? 5 : 10;
  checks.push(
    scoreImpactEntry(
      "idle_time_threshold",
      "Idle time threshold",
      idlePct <= ruleSet.idlePctWarning,
      `<= ${ruleSet.idlePctWarning}% warning, <= ${ruleSet.idlePctCritical}% critical`,
      `${idlePct}%`,
      idlePct <= ruleSet.idlePctWarning ? "No deviation" : idlePct <= ruleSet.idlePctCritical ? `${(idlePct - ruleSet.idlePctWarning).toFixed(1)}% above warning` : `${(idlePct - ruleSet.idlePctCritical).toFixed(1)}% above critical`,
      -idlePenalty
    )
  );

  const irrelevantPenalty =
    irrelevantUsageMinutes <= ruleSet.irrelevantUsageWarningMinutes
      ? 0
      : irrelevantUsageMinutes <= ruleSet.irrelevantUsageCriticalMinutes
        ? 5
        : 10;
  checks.push(
    scoreImpactEntry(
      "irrelevant_usage_threshold",
      "Irrelevant usage threshold",
      irrelevantUsageMinutes <= ruleSet.irrelevantUsageWarningMinutes,
      `<= ${ruleSet.irrelevantUsageWarningMinutes}m warning, <= ${ruleSet.irrelevantUsageCriticalMinutes}m critical`,
      `${irrelevantUsageMinutes}m`,
      irrelevantUsageMinutes <= ruleSet.irrelevantUsageWarningMinutes
        ? "No deviation"
        : irrelevantUsageMinutes <= ruleSet.irrelevantUsageCriticalMinutes
          ? `${irrelevantUsageMinutes - ruleSet.irrelevantUsageWarningMinutes}m above warning`
          : `${irrelevantUsageMinutes - ruleSet.irrelevantUsageCriticalMinutes}m above critical`,
      -irrelevantPenalty
    )
  );

  const eodScoreMap = {
    Clear: ruleSet.eodScoreClear,
    Average: ruleSet.eodScoreAverage,
    Vague: ruleSet.eodScoreVague,
    "Weak/Suspicious": ruleSet.eodScoreWeak
  } as const;
  const eodScore = clampScore(eodScoreMap[input.eodQuality]);
  checks.push(
    scoreImpactEntry(
      "eod_quality",
      "EOD quality scoring",
      input.eodQuality === "Clear" || input.eodQuality === "Average",
      `Clear:${ruleSet.eodScoreClear}, Average:${ruleSet.eodScoreAverage}, Vague:${ruleSet.eodScoreVague}, Weak:${ruleSet.eodScoreWeak}`,
      `${input.eodQuality} (${eodScore})`,
      input.eodQuality === "Clear" ? "Best quality" : input.eodQuality === "Average" ? "Acceptable quality" : "Low quality",
      eodScore - ruleSet.eodScoreClear
    )
  );

  const matchScore = eodMatchPct >= ruleSet.timechampEodMatchGoodPct ? 20 : eodMatchPct >= ruleSet.timechampEodMatchWarningPct ? 12 : 5;
  checks.push(
    scoreImpactEntry(
      "timechamp_eod_match",
      "Time Champ vs EOD match",
      eodMatchPct >= ruleSet.timechampEodMatchWarningPct,
      `>= ${ruleSet.timechampEodMatchWarningPct}% warning, ${ruleSet.timechampEodMatchGoodPct}% good`,
      `${eodMatchPct}%`,
      eodMatchPct >= ruleSet.timechampEodMatchGoodPct ? "Good alignment" : eodMatchPct >= ruleSet.timechampEodMatchWarningPct ? "Warning alignment" : `${(ruleSet.timechampEodMatchWarningPct - eodMatchPct).toFixed(1)}% below warning`,
      matchScore - 20
    )
  );

  const baseScore = attendanceScore + workHoursScore + productiveScore + eodScore + matchScore;
  const finalScore = clampScore(baseScore - idlePenalty - irrelevantPenalty);
  const riskLevel: RiskLevel = finalScore >= ruleSet.riskGreenMin ? "GREEN" : finalScore >= ruleSet.riskYellowMin ? "YELLOW" : "RED";
  checks.push(
    scoreImpactEntry(
      "risk_level_ranges",
      "Risk level score ranges",
      true,
      `GREEN >= ${ruleSet.riskGreenMin}, YELLOW >= ${ruleSet.riskYellowMin}, RED < ${ruleSet.riskYellowMin}`,
      `${finalScore} => ${riskLevel}`,
      "Derived from configured ranges",
      0
    )
  );

  const violated = checks.filter((check) => !check.passed);
  const passed = checks.filter((check) => check.passed);

  const flags = violated
    .filter((check) => check.code !== "risk_level_ranges")
    .slice(0, 8)
    .map((check) => `${check.title}: ${check.deviation}`);

  const topViolations = violated
    .filter((check) => check.scoreImpact < 0)
    .sort((a, b) => a.scoreImpact - b.scoreImpact)
    .slice(0, 3)
    .map((check) => `${check.title} (${check.deviation})`);

  const managerSummary = `Rule engine evaluated ${checks.length} checks: ${passed.length} passed and ${violated.length} violated. Final score ${finalScore}/100 with ${riskLevel} risk.`;
  const recommendation =
    riskLevel === "GREEN"
      ? "Continue current execution. Keep attendance discipline and maintain productive ratio above configured thresholds."
      : riskLevel === "YELLOW"
        ? `Review threshold deviations: ${topViolations.join("; ")}. Require corrective plan in next cycle.`
        : `Escalate immediately. Critical deviations detected: ${topViolations.join("; ")}. Start manager intervention and daily monitoring.`;

  return {
    scoreBreakdown: {
      attendance: attendanceScore,
      work_hours: workHoursScore,
      productive_activity: productiveScore,
      eod_clarity: eodScore,
      timechamp_eod_match: matchScore,
      idle_penalty: idlePenalty,
      irrelevant_usage_penalty: irrelevantPenalty
    },
    finalScore,
    riskLevel,
    ruleEvaluation: { passed, violated, all: checks },
    managerSummary,
    recommendation,
    flags,
    context: {
      ruleSetName: ruleSet.name,
      scope: ruleSet.scope,
      department: ruleSet.department ?? null,
      roleRuleApplied: Boolean(config.roleUsageRule)
    },
    metrics: {
      productivePct,
      idlePct,
      irrelevantUsageMinutes,
      eodMatchPct,
      totalTrackedMinutes
    }
  };
}
