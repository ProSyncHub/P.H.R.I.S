import { endOfWeek, format, startOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";
import { clampScore, hoursFromMinutes } from "@/lib/utils";
import { generateRiskLevel } from "@/services/openai-analysis";
import { syncWeeklyAnalysisToNotion } from "@/services/notion-sync";
import type { Employee, WeeklyAnalysis, WeeklyScope } from "@prisma/client";

type DailyAnalysisWithEmployee = Awaited<
  ReturnType<typeof prisma.dailyAnalysis.findMany>
>[number] & {
  employee: Employee;
};

export type WeeklyTargetInput = {
  scope: WeeklyScope;
  weekStart: string | Date;
  employeeId?: string;
  department?: string;
};

export type WeeklyGenerationResult = {
  weeklyAnalysisId: string;
  created: boolean;
  scope: WeeklyScope;
  weekStart: string;
  weekEnd: string;
  reportCount: number;
};

export function getWeekRange(input: string | Date) {
  const date = typeof input === "string" ? new Date(input) : new Date(input);
  const normalized = Number.isNaN(date.getTime()) ? new Date() : date;
  const weekStart = startOfWeek(normalized, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(normalized, { weekStartsOn: 1 });
  return { weekStart, weekEnd };
}

function expectedMinutesForDate(date: Date) {
  const day = date.getDay();
  if (day === 0) return 0;
  return day === 6 ? 6 * 60 + 45 : 8 * 60 + 30;
}

function safeArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function formatWeekLabel(weekStart: Date, weekEnd: Date) {
  return `${format(weekStart, "yyyy-MM-dd")} to ${format(weekEnd, "yyyy-MM-dd")}`;
}

function buildDaySummary(report: DailyAnalysisWithEmployee) {
  const login = report.loginLogoutSummaryJson as Record<string, unknown>;
  const flags = safeArray(report.flagsJson).map((flag) => String(flag));
  const eod = report.eodAnalysisJson as Record<string, unknown>;

  return {
    id: report.id,
    date: format(report.reportDate, "yyyy-MM-dd"),
    employeeId: report.employeeId,
    employeeName: report.employee.fullName,
    department: report.employee.department,
    score: report.score,
    riskLevel: report.riskLevel,
    totalHours: report.totalHours,
    productiveHours: report.productiveHours,
    unproductiveTime: report.unproductiveTime,
    idleTime: report.idleTime,
    expectedMinutes: expectedMinutesForDate(report.reportDate),
    lateLogin: Boolean(login.lateLogin),
    earlyLogout: Boolean(login.earlyLogout),
    missingLogout: Boolean(login.missingLogout),
    completedTasks: safeArray(eod.completed_tasks).length,
    pendingTasks: safeArray(eod.pending_tasks).length,
    flags
  };
}

function buildEmployeeBreakdown(reports: DailyAnalysisWithEmployee[]) {
  const map = new Map<
    string,
    {
      employeeId: string;
      fullName: string;
      department: string;
      reports: number;
      totalHours: number;
      productiveHours: number;
      scoreTotal: number;
      lowestScore: number;
      highestScore: number;
      redDays: number;
      yellowDays: number;
      greenDays: number;
    }
  >();

  for (const report of reports) {
    const current =
      map.get(report.employeeId) ??
      {
        employeeId: report.employeeId,
        fullName: report.employee.fullName,
        department: report.employee.department,
        reports: 0,
        totalHours: 0,
        productiveHours: 0,
        scoreTotal: 0,
        lowestScore: 100,
        highestScore: 0,
        redDays: 0,
        yellowDays: 0,
        greenDays: 0
      };

    current.reports += 1;
    current.totalHours += report.totalHours;
    current.productiveHours += report.productiveHours;
    current.scoreTotal += report.score;
    current.lowestScore = Math.min(current.lowestScore, report.score);
    current.highestScore = Math.max(current.highestScore, report.score);
    if (report.riskLevel === "RED") current.redDays += 1;
    if (report.riskLevel === "YELLOW") current.yellowDays += 1;
    if (report.riskLevel === "GREEN") current.greenDays += 1;
    map.set(report.employeeId, current);
  }

  return [...map.values()]
    .map((item) => ({
      ...item,
      averageScore: item.reports ? Math.round((item.scoreTotal / item.reports) * 10) / 10 : 0,
      score: clampScore(Math.round(item.scoreTotal / Math.max(1, item.reports))),
      totalHours: hoursFromMinutes(Math.round(item.totalHours * 60)),
      productiveHours: hoursFromMinutes(Math.round(item.productiveHours * 60))
    }))
    .sort((a, b) => b.score - a.score || a.fullName.localeCompare(b.fullName));
}

function aggregateWeeklySummary(reports: DailyAnalysisWithEmployee[], scope: WeeklyScope, weekStart: Date, weekEnd: Date) {
  const daySummaries = reports
    .slice()
    .sort((a, b) => a.reportDate.getTime() - b.reportDate.getTime())
    .map(buildDaySummary);

  const totalExpectedMinutes = daySummaries.reduce((sum, item) => sum + item.expectedMinutes, 0);
  const totalTrackedMinutes = reports.reduce((sum, report) => sum + Math.round(report.totalHours * 60), 0);
  const totalProductiveMinutes = reports.reduce((sum, report) => sum + Math.round(report.productiveHours * 60), 0);
  const totalUnproductiveMinutes = reports.reduce((sum, report) => sum + Math.round(report.unproductiveTime * 60), 0);
  const totalIdleMinutes = reports.reduce((sum, report) => sum + Math.round(report.idleTime * 60), 0);

  const scores = reports.map((report) => report.score);
  const averageScore = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
  const lowestScore = scores.length ? Math.min(...scores) : 0;
  const highestScore = scores.length ? Math.max(...scores) : 0;

  const flagCounts = new Map<string, number>();
  let lateLoginCount = 0;
  let earlyLogoutCount = 0;
  let missingLogoutCount = 0;

  for (const report of reports) {
    const login = report.loginLogoutSummaryJson as Record<string, unknown>;
    if (Boolean(login.lateLogin)) lateLoginCount += 1;
    if (Boolean(login.earlyLogout)) earlyLogoutCount += 1;
    if (Boolean(login.missingLogout)) missingLogoutCount += 1;

    for (const flag of safeArray(report.flagsJson)) {
      const key = String(flag);
      flagCounts.set(key, (flagCounts.get(key) ?? 0) + 1);
    }
  }

  const recurringFlags = [...flagCounts.entries()]
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count || a.message.localeCompare(b.message))
    .slice(0, 8);

  const employeeBreakdown = buildEmployeeBreakdown(reports);
  const redDays = reports.filter((report) => report.riskLevel === "RED").length;
  const yellowDays = reports.filter((report) => report.riskLevel === "YELLOW").length;
  const greenDays = reports.filter((report) => report.riskLevel === "GREEN").length;
  const coveragePct = totalExpectedMinutes ? Math.round((totalTrackedMinutes / totalExpectedMinutes) * 1000) / 10 : 100;

  const penalties =
    redDays * 6 +
    yellowDays * 2 +
    lateLoginCount * 2 +
    earlyLogoutCount * 2 +
    missingLogoutCount * 4 +
    Math.max(0, recurringFlags.length - 4);
  const bonuses = coveragePct >= 95 ? 4 : coveragePct >= 85 ? 2 : 0;
  const score = clampScore(Math.round(averageScore - penalties + bonuses));
  const riskLevel = generateRiskLevel(score);

  const scopeLabel = scope === "EMPLOYEE" ? "employee" : "department";
  const trackedHours = hoursFromMinutes(totalTrackedMinutes);
  const productiveHours = hoursFromMinutes(totalProductiveMinutes);
  const unproductiveHours = hoursFromMinutes(totalUnproductiveMinutes);
  const idleHours = hoursFromMinutes(totalIdleMinutes);

  const managerSummary = `${scopeLabel === "employee" ? "Employee" : "Department"} week ${formatWeekLabel(weekStart, weekEnd)}: ${reports.length} analysed days, average score ${Math.round(averageScore)}, coverage ${coveragePct}%, ${redDays} red days, ${lateLoginCount} late logins.`;
  const recommendation =
    score >= 80
      ? "Performance is stable. Keep the same execution rhythm and watch for repeat late-login or flag patterns."
      : score >= 55
        ? "Performance is mixed. Review recurring flags, late logins, and any low-coverage days with the employee."
        : "Performance is under pressure. Escalate repeated attendance gaps, low output days, and unresolved flags.";

  return {
    dailyCount: reports.length,
    totalHours: trackedHours,
    productiveHours,
    unproductiveTime: unproductiveHours,
    idleTime: idleHours,
    averageScore: Math.round(averageScore * 10) / 10,
    lowestScore,
    highestScore,
    score,
    riskLevel,
    summaryJson: {
      scope,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      coveragePct,
      totalExpectedMinutes,
      totalTrackedMinutes,
      totalProductiveMinutes,
      totalUnproductiveMinutes,
      totalIdleMinutes,
      lateLoginCount,
      earlyLogoutCount,
      missingLogoutCount,
      riskCounts: { GREEN: greenDays, YELLOW: yellowDays, RED: redDays },
      recurringFlags,
      dailyBreakdown: daySummaries,
      employeeBreakdown
    },
    flagsJson: recurringFlags,
    managerSummary,
    recommendation
  };
}

async function persistWeeklyAnalysis(
  existing: WeeklyAnalysis | null,
  input: WeeklyTargetInput,
  weekStart: Date,
  weekEnd: Date,
  reports: DailyAnalysisWithEmployee[]
) {
  const summary = aggregateWeeklySummary(reports, input.scope, weekStart, weekEnd);

  const payload = {
    scope: input.scope,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    employeeId: input.employeeId ?? null,
    department: input.department ?? null,
    ...summary
  };

  if (existing) {
    return prisma.weeklyAnalysis.update({
      where: { id: existing.id },
      data: {
        scope: input.scope,
        weekStart,
        weekEnd,
        employeeId: input.employeeId ?? null,
        department: input.department ?? null,
        dailyCount: summary.dailyCount,
        totalHours: summary.totalHours,
        productiveHours: summary.productiveHours,
        unproductiveTime: summary.unproductiveTime,
        idleTime: summary.idleTime,
        averageScore: summary.averageScore,
        lowestScore: summary.lowestScore,
        highestScore: summary.highestScore,
        score: summary.score,
        riskLevel: summary.riskLevel,
        summaryJson: payload as any,
        flagsJson: summary.flagsJson as any,
        managerSummary: summary.managerSummary,
        recommendation: summary.recommendation,
        notionSyncStatus: "PENDING",
        notionPageId: null,
        sources: {
          deleteMany: {},
          create: reports.map((report) => ({
            dailyAnalysisId: report.id
          }))
        }
      }
    });
  }

  return prisma.weeklyAnalysis.create({
    data: {
      scope: input.scope,
      weekStart,
      weekEnd,
      employeeId: input.employeeId ?? null,
      department: input.department ?? null,
      dailyCount: summary.dailyCount,
      totalHours: summary.totalHours,
      productiveHours: summary.productiveHours,
      unproductiveTime: summary.unproductiveTime,
      idleTime: summary.idleTime,
      averageScore: summary.averageScore,
      lowestScore: summary.lowestScore,
      highestScore: summary.highestScore,
      score: summary.score,
      riskLevel: summary.riskLevel,
      summaryJson: payload as any,
      flagsJson: summary.flagsJson as any,
      managerSummary: summary.managerSummary,
      recommendation: summary.recommendation,
      sources: {
        create: reports.map((report) => ({
          dailyAnalysisId: report.id
        }))
      }
    }
  });
}

export async function generateWeeklyAnalysis(input: WeeklyTargetInput) {
  const { weekStart, weekEnd } = getWeekRange(input.weekStart);
  if (input.scope === "EMPLOYEE" && !input.employeeId) {
    throw new Error("employeeId is required for employee weekly reports.");
  }
  if (input.scope === "DEPARTMENT" && !input.department) {
    throw new Error("department is required for department weekly reports.");
  }

  const reports = await prisma.dailyAnalysis.findMany({
    where: {
      reportDate: { gte: weekStart, lte: weekEnd },
      ...(input.scope === "EMPLOYEE"
        ? { employeeId: input.employeeId }
        : { employee: { department: input.department } })
    },
    include: { employee: true },
    orderBy: { reportDate: "asc" }
  });

  if (!reports.length) {
    throw new Error("No daily analyses found for the selected week and target.");
  }

  const existing = await prisma.weeklyAnalysis.findFirst({
    where: {
      scope: input.scope,
      weekStart,
      weekEnd,
      employeeId: input.employeeId ?? undefined,
      department: input.department ?? undefined
    }
  });

  const weeklyAnalysis = await persistWeeklyAnalysis(existing, input, weekStart, weekEnd, reports);
  await syncWeeklyAnalysisToNotion(weeklyAnalysis.id);
  return weeklyAnalysis;
}

export async function generateWeeklyReportsForWeek(weekStartInput: string | Date) {
  const { weekStart, weekEnd } = getWeekRange(weekStartInput);
  const allReports = await prisma.dailyAnalysis.findMany({
    where: { reportDate: { gte: weekStart, lte: weekEnd } },
    include: { employee: true },
    orderBy: { reportDate: "asc" }
  });

  const byEmployee = new Map<string, DailyAnalysisWithEmployee[]>();
  const byDepartment = new Map<string, DailyAnalysisWithEmployee[]>();

  for (const report of allReports) {
    const employeeReports = byEmployee.get(report.employeeId) ?? [];
    employeeReports.push(report);
    byEmployee.set(report.employeeId, employeeReports);

    const departmentReports = byDepartment.get(report.employee.department) ?? [];
    departmentReports.push(report);
    byDepartment.set(report.employee.department, departmentReports);
  }

  const employeeResults = [];
  for (const [employeeId] of byEmployee.entries()) {
    const created = await generateWeeklyAnalysis({
      scope: "EMPLOYEE",
      weekStart,
      employeeId
    });
    employeeResults.push(created);
  }

  const departmentResults = [];
  for (const [department] of byDepartment.entries()) {
    const created = await generateWeeklyAnalysis({
      scope: "DEPARTMENT",
      weekStart,
      department
    });
    departmentResults.push(created);
  }

  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    employeeReports: employeeResults.length,
    departmentReports: departmentResults.length,
    totalReports: employeeResults.length + departmentResults.length
  };
}
