import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge } from "@/components/risk-badge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const [today, allRecent] = await Promise.all([
    prisma.dailyAnalysis.findMany({ where: { reportDate: { gte: start, lt: end } }, include: { employee: true }, orderBy: { createdAt: "desc" } }),
    prisma.dailyAnalysis.findMany({ include: { employee: true }, orderBy: { createdAt: "desc" }, take: 25 })
  ]);

  const source = today.length ? today : allRecent;
  const avgScore = source.length ? Math.round(source.reduce((sum, row) => sum + row.score, 0) / source.length) : 0;
  const counts = {
    green: source.filter((row) => row.riskLevel === "GREEN").length,
    yellow: source.filter((row) => row.riskLevel === "YELLOW").length,
    red: source.filter((row) => row.riskLevel === "RED").length,
    late: source.filter((row) => JSON.stringify(row.loginLogoutSummaryJson).includes("lateLogin\":true")).length,
    mismatch: source.filter((row) => JSON.stringify(row.flagsJson).toLowerCase().includes("mismatch")).length
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Management Dashboard</h1>
          <p className="text-sm text-muted-foreground">Daily AI performance intelligence for HR and managers.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/analyse">Analyse Report</Link>
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-5">
        {[
          ["Employees Analysed", source.length],
          ["Average Score", avgScore],
          ["Green / Yellow / Red", `${counts.green}/${counts.yellow}/${counts.red}`],
          ["Late Login", counts.late],
          ["Mismatch", counts.mismatch]
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{value}</CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Latest Analyses</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                {["Employee", "Date", "Login", "Logout", "Hours", "Productive", "Score", "Risk", "Notion", ""].map((head) => (
                  <th key={head} className="border-b px-3 py-2">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {source.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40">
                  <td className="px-3 py-3">{row.employee.fullName}</td>
                  <td className="px-3 py-3">{row.reportDate.toISOString().slice(0, 10)}</td>
                  <td className="px-3 py-3">{row.loginTime ?? "-"}</td>
                  <td className="px-3 py-3">{row.logoutTime ?? "-"}</td>
                  <td className="px-3 py-3">{row.totalHours}</td>
                  <td className="px-3 py-3">{row.productiveHours}</td>
                  <td className="px-3 py-3">{row.score}</td>
                  <td className="px-3 py-3"><RiskBadge risk={row.riskLevel} /></td>
                  <td className="px-3 py-3">{row.notionSyncStatus}</td>
                  <td className="px-3 py-3"><Button asChild size="sm" variant="outline"><Link href={`/dashboard/reports/${row.id}`}>View</Link></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
