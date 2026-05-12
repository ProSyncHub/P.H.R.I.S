import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function NotionSyncPage() {
  const logs = await prisma.notionSyncLog.findMany({
    include: { dailyAnalysis: { include: { employee: true } } },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notion Sync Logs</h1>
        <p className="text-sm text-muted-foreground">Audit trail for report archive synchronization.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Latest Sync Events</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>{["Time", "Employee", "Status", "Message", "Page ID"].map((h) => <th key={h} className="border-b px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/40">
                  <td className="px-3 py-3">{log.createdAt.toISOString()}</td>
                  <td className="px-3 py-3">{log.dailyAnalysis.employee.fullName}</td>
                  <td className="px-3 py-3">{log.status}</td>
                  <td className="px-3 py-3">{log.message}</td>
                  <td className="px-3 py-3">{log.notionPageId ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
