import Link from "next/link";
import { format, startOfWeek, subWeeks } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge } from "@/components/risk-badge";
import { DeleteWeeklyReportButton } from "@/components/delete-weekly-report-button";
import { generateWeeklyReportsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function WeeklyReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const weekStart = params.weekStart ? new Date(params.weekStart) : startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
  const reports = await prisma.weeklyAnalysis.findMany({
    where: {
      scope: params.scope ? (params.scope as any) : undefined,
      department: params.department ?? undefined,
      weekStart
    },
    include: { employee: true },
    orderBy: { createdAt: "desc" }
  });

  const metrics = {
    total: reports.length,
    employee: reports.filter((report) => report.scope === "EMPLOYEE").length,
    department: reports.filter((report) => report.scope === "DEPARTMENT").length,
    avgScore: reports.length ? Math.round(reports.reduce((sum, report) => sum + report.score, 0) / reports.length) : 0
  };

  const weekLabel = `${format(weekStart, "yyyy-MM-dd")} week`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Weekly Reports</h1>
          <p className="text-sm text-muted-foreground">Aggregated weekly intelligence built from the daily analyses already in P.H.R.I.S.</p>
        </div>
        <form action={generateWeeklyReportsAction} className="flex items-center gap-2">
          <input type="hidden" name="weekStart" value={weekStart.toISOString()} />
          <Button type="submit">Generate Previous Week</Button>
        </form>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Weekly Reports", metrics.total],
          ["Employee Scope", metrics.employee],
          ["Department Scope", metrics.department],
          ["Average Score", metrics.avgScore]
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{value}</CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Archive</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                {["Scope", "Employee / Department", "Week", "Days", "Score", "Risk", "Notion", ""].map((head) => (
                  <th key={head} className="border-b px-3 py-2">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-muted/40">
                  <td className="px-3 py-3">{report.scope}</td>
                  <td className="px-3 py-3">{report.scope === "EMPLOYEE" ? report.employee?.fullName ?? "-" : report.department ?? "-"}</td>
                  <td className="px-3 py-3">{`${report.weekStart.toISOString().slice(0, 10)} to ${report.weekEnd.toISOString().slice(0, 10)}`}</td>
                  <td className="px-3 py-3">{report.dailyCount}</td>
                  <td className="px-3 py-3">{report.score}</td>
                  <td className="px-3 py-3"><RiskBadge risk={report.riskLevel} /></td>
                  <td className="px-3 py-3">{report.notionSyncStatus}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/weekly/${report.id}`}>View</Link>
                      </Button>
                      <DeleteWeeklyReportButton weeklyReportId={report.id} redirectTo="/dashboard/weekly" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!reports.length ? <p className="mt-4 text-sm text-muted-foreground">No weekly reports found for {weekLabel}.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
