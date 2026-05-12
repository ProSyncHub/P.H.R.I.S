import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge } from "@/components/risk-badge";
import { DeleteReportButton } from "@/components/delete-report-button";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const reports = await prisma.dailyAnalysis.findMany({
    where: {
      riskLevel: params.risk ? (params.risk as any) : undefined,
      employee: params.department ? { department: params.department } : undefined
    },
    include: { employee: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Filter and inspect generated daily intelligence reports.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Report Archive</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>{["Employee", "Department", "Date", "Score", "Risk", "Flags", "Notion", ""].map((h) => <th key={h} className="border-b px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-muted/40">
                  <td className="px-3 py-3">{report.employee.fullName}</td>
                  <td className="px-3 py-3">{report.employee.department}</td>
                  <td className="px-3 py-3">{report.reportDate.toISOString().slice(0, 10)}</td>
                  <td className="px-3 py-3">{report.score}</td>
                  <td className="px-3 py-3"><RiskBadge risk={report.riskLevel} /></td>
                  <td className="px-3 py-3">{Array.isArray(report.flagsJson) ? report.flagsJson.length : 0}</td>
                  <td className="px-3 py-3">{report.notionSyncStatus}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Button asChild size="sm" variant="outline"><Link href={`/dashboard/reports/${report.id}`}>View</Link></Button>
                      <DeleteReportButton reportId={report.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
