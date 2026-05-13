import { notFound } from "next/navigation";
import { CalendarDays, CheckCircle2, Clock3, FileText, Gauge, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge } from "@/components/risk-badge";
import { DeleteWeeklyReportButton } from "@/components/delete-weekly-report-button";

export const dynamic = "force-dynamic";

async function resendWeeklyToNotion(formData: FormData) {
  "use server";
  const { syncWeeklyAnalysisToNotion } = await import("@/services/notion-sync");
  await syncWeeklyAnalysisToNotion(String(formData.get("weeklyId")));
}

function formatHours(hours: number) {
  const minutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function metricClass(value: number) {
  if (value >= 80) return "text-emerald-300";
  if (value >= 55) return "text-amber-300";
  return "text-red-300";
}

export default async function WeeklyReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await prisma.weeklyAnalysis.findUnique({
    where: { id },
    include: {
      employee: true,
      sources: { include: { dailyAnalysis: { include: { employee: true } } } },
      notionSyncLogs: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!report) notFound();

  const summary = report.summaryJson as any;
  const dailyBreakdown = Array.isArray(summary?.dailyBreakdown) ? summary.dailyBreakdown : [];
  const employeeBreakdown = Array.isArray(summary?.employeeBreakdown) ? summary.employeeBreakdown : [];
  const recurringFlags = Array.isArray(summary?.recurringFlags) ? summary.recurringFlags : [];
  const coverage = Number(summary?.coveragePct ?? 0);
  const lateLoginCount = Number(summary?.lateLoginCount ?? 0);
  const missingLogoutCount = Number(summary?.missingLogoutCount ?? 0);
  const expectedMinutes = Number(summary?.totalExpectedMinutes ?? 0);
  const trackedMinutes = Number(summary?.totalTrackedMinutes ?? 0);
  const productiveMinutes = Number(summary?.totalProductiveMinutes ?? 0);
  const unproductiveMinutes = Number(summary?.totalUnproductiveMinutes ?? 0);
  const idleMinutes = Number(summary?.totalIdleMinutes ?? 0);
  const scopeLabel = report.scope === "EMPLOYEE" ? "Employee" : "Department";
  const targetLabel = report.scope === "EMPLOYEE" ? report.employee?.fullName ?? "Unknown employee" : report.department ?? "Department summary";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium uppercase text-primary">
            <CalendarDays className="h-3.5 w-3.5" />
            Weekly Intelligence
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{targetLabel}</h1>
            <p className="text-sm text-muted-foreground">
              {scopeLabel} weekly report - {report.weekStart.toISOString().slice(0, 10)} to {report.weekEnd.toISOString().slice(0, 10)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <form action={resendWeeklyToNotion}>
            <input type="hidden" name="weeklyId" value={report.id} />
            <Button variant="outline">Resend to Notion</Button>
          </form>
          <DeleteWeeklyReportButton weeklyReportId={report.id} redirectTo="/dashboard/weekly" />
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={Clock3} label="Tracked Time" value={formatHours(report.totalHours)} note={`Expected ${formatHours(expectedMinutes / 60)} - Coverage ${coverage}%`} />
        <MetricCard icon={Gauge} label="Average Score" value={String(Math.round(report.averageScore))} note={report.riskLevel} highlight={report.score} />
        <MetricCard icon={TriangleAlert} label="Late Logins" value={String(lateLoginCount)} note={`${missingLogoutCount} missing logout(s)`} />
        <MetricCard icon={FileText} label="Days Analysed" value={String(report.dailyCount)} note={`${recurringFlags.length} recurring flag(s)`} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <MiniStat label="Productive" value={formatHours(report.productiveHours)} />
            <MiniStat label="Unproductive" value={formatHours(report.unproductiveTime)} />
            <MiniStat label="Idle" value={formatHours(report.idleTime)} />
            <MiniStat label="Coverage" value={`${coverage}%`} />
          </div>
          <p className="text-sm text-muted-foreground">{report.managerSummary}</p>
          <p className="text-sm">{report.recommendation}</p>
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge risk={report.riskLevel} />
            <span className="text-sm text-muted-foreground">Score {report.score}/100</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                {["Date", "Employee", "Score", "Risk", "Tracked", "Productive", "Late", "Flags"].map((head) => (
                  <th key={head} className="border-b px-3 py-2">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dailyBreakdown.map((day: any) => (
                <tr key={day.id} className="hover:bg-muted/40">
                  <td className="px-3 py-3">{day.date}</td>
                  <td className="px-3 py-3">{day.employeeName}</td>
                  <td className="px-3 py-3">{day.score}</td>
                  <td className="px-3 py-3">
                    <RiskBadge risk={day.riskLevel} />
                  </td>
                  <td className="px-3 py-3">{formatHours(day.totalHours)}</td>
                  <td className="px-3 py-3">{formatHours(day.productiveHours)}</td>
                  <td className="px-3 py-3">{day.lateLogin ? "Yes" : "No"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{Array.isArray(day.flags) ? day.flags.length : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {report.scope === "DEPARTMENT" ? (
        <Card>
          <CardHeader>
            <CardTitle>Employee Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  {["Employee", "Days", "Score", "Tracked", "Productive", "Low", "High"].map((head) => (
                    <th key={head} className="border-b px-3 py-2">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employeeBreakdown.map((item: any) => (
                  <tr key={item.employeeId} className="hover:bg-muted/40">
                    <td className="px-3 py-3">{item.fullName}</td>
                    <td className="px-3 py-3">{item.reports}</td>
                    <td className={cn("px-3 py-3 font-medium", metricClass(item.score))}>{item.score}</td>
                    <td className="px-3 py-3">{item.totalHours}</td>
                    <td className="px-3 py-3">{item.productiveHours}</td>
                    <td className="px-3 py-3">{item.lowestScore}</td>
                    <td className="px-3 py-3">{item.highestScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Source Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {report.sources.map((source) => (
              <div key={source.id} className="rounded-md border p-2">
                {source.dailyAnalysis.reportDate.toISOString().slice(0, 10)} - {source.dailyAnalysis.employee.fullName} - {source.dailyAnalysis.score}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recurring Flags</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {recurringFlags.length
              ? recurringFlags.map((flag: any) => (
                  <div key={flag.message} className="rounded-md border p-2">
                    {flag.count}x {flag.message}
                  </div>
                ))
              : "No recurring flags recorded."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notion Sync Logs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {report.notionSyncLogs.length
              ? report.notionSyncLogs.map((log) => (
                  <div key={log.id} className="rounded-md border p-3">
                    {log.status}: {log.message}
                  </div>
                ))
              : "No sync attempts yet."}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
  highlight
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  note: string;
  highlight?: number;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <p className={cn("text-2xl font-semibold", highlight !== undefined ? metricClass(highlight) : undefined)}>{value}</p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
