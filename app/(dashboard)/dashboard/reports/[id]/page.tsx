import { notFound } from "next/navigation";
import { BarChart3, CheckCircle2, Clock3, FileText, Gauge, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge } from "@/components/risk-badge";
import { PrintButton } from "@/components/print-button";
import { DeleteReportButton } from "@/components/delete-report-button";
import type { ActivitySummary, ParsedActivityRow } from "@/types/analysis";

export const dynamic = "force-dynamic";

type TaskEvidence = {
  task: string;
  evidenceMinutes: number;
  evidence: string[];
  status: "Verified" | "Partial" | "Needs Evidence";
};

async function resendToNotion(formData: FormData) {
  "use server";
  const { syncAnalysisToNotion } = await import("@/services/notion-sync");
  await syncAnalysisToNotion(String(formData.get("analysisId")));
}

function formatHours(hours: number) {
  const minutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function formatMinutes(minutes: number) {
  return formatHours(minutes / 60);
}

function expectedMinutesForDate(date: Date) {
  const day = date.getDay();
  if (day === 0) return 0;
  return day === 6 ? 6 * 60 + 45 : 8 * 60 + 30;
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function topLabels(items: { name: string; minutes: number }[], count = 4) {
  return items
    .filter((item) => item.name)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, count)
    .map((item) => item.name);
}

function tokenize(text: string) {
  const stopWords = new Set(["and", "the", "for", "with", "from", "this", "that", "been", "also", "into", "were", "was", "are"]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3 && !stopWords.has(token));
}

function rowLabel(row: ParsedActivityRow) {
  return [row.appName, row.website, row.url].filter(Boolean).join(" - ");
}

function buildTaskEvidence(tasks: string[], rows: ParsedActivityRow[]): TaskEvidence[] {
  return tasks.slice(0, 8).map((task) => {
    const tokens = tokenize(task);
    const scored = rows
      .map((row) => {
        const label = rowLabel(row);
        const normalized = label.toLowerCase();
        const matches = tokens.filter((token) => normalized.includes(token)).length;
        return { row, label, matches };
      })
      .filter((item) => item.matches > 0 && item.label)
      .sort((a, b) => b.matches - a.matches || b.row.durationMinutes - a.row.durationMinutes)
      .slice(0, 6);

    const evidenceMinutes = scored.reduce((sum, item) => sum + item.row.durationMinutes, 0);
    const status = evidenceMinutes >= 60 ? "Verified" : evidenceMinutes > 0 ? "Partial" : "Needs Evidence";

    return {
      task,
      evidenceMinutes,
      evidence: [...new Set(scored.map((item) => item.label))].slice(0, 3),
      status
    };
  });
}

function statusClasses(status: TaskEvidence["status"]) {
  if (status === "Verified") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (status === "Partial") return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  return "border-red-400/30 bg-red-400/10 text-red-200";
}

function categoryRows(activity: ActivitySummary, totalMinutes: number) {
  const coreMinutes = activity.totalProductiveMinutes;
  const offTaskMinutes = activity.totalUnproductiveMinutes;
  const neutralMinutes = Math.max(0, totalMinutes - coreMinutes - offTaskMinutes);
  const topWork = topLabels([...activity.mostUsedApps, ...activity.mostVisitedWebsites], 4);
  const topOffTask = activity.irrelevantUsage.slice(0, 4).map((item) => item.name);

  return [
    {
      label: "Core Work",
      minutes: coreMinutes,
      platforms: topWork,
      status: offTaskMinutes > totalMinutes * 0.1 ? "Partial" : "Logged"
    },
    {
      label: "Off-Task",
      minutes: offTaskMinutes,
      platforms: topOffTask.length ? topOffTask : ["No major off-task signal"],
      status: offTaskMinutes > 0 ? "Review" : "Clear"
    },
    {
      label: "Away / Neutral",
      minutes: neutralMinutes,
      platforms: activity.totalIdleMinutes > 0 ? ["Idle or uncategorized time"] : ["No major neutral signal"],
      status: neutralMinutes > totalMinutes * 0.15 ? "Review" : "Clear"
    }
  ];
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await prisma.dailyAnalysis.findUnique({
    where: { id },
    include: { employee: true, uploadedReports: true, analysisFlags: true, notionSyncLogs: { orderBy: { createdAt: "desc" } } }
  });
  if (!report) notFound();

  const eod = report.eodAnalysisJson as any;
  const activity = report.activitySummaryJson as ActivitySummary;
  const completedTasks = Array.isArray(eod.completed_tasks) ? eod.completed_tasks : [];
  const pendingTasks = Array.isArray(eod.pending_tasks) ? eod.pending_tasks : [];
  const totalSystemMinutes = Math.round((report.productiveHours + report.unproductiveTime + report.idleTime) * 60);
  const expectedMinutes = expectedMinutesForDate(report.reportDate);
  const shortfallMinutes = Math.max(0, expectedMinutes - totalSystemMinutes);
  const coverage = expectedMinutes ? percent(totalSystemMinutes, expectedMinutes) : 100;
  const productiveMinutes = Math.round(report.productiveHours * 60);
  const unproductiveMinutes = Math.round(report.unproductiveTime * 60);
  const idleMinutes = Math.round(report.idleTime * 60);
  const taskEvidence = buildTaskEvidence(completedTasks, activity.rows ?? []);
  const matchedEvidenceMinutes = taskEvidence.reduce((sum, task) => sum + task.evidenceMinutes, 0);
  const alignment = totalSystemMinutes ? Math.min(100, percent(matchedEvidenceMinutes, totalSystemMinutes)) : 0;
  const unloggedGapMinutes = Math.max(0, totalSystemMinutes - matchedEvidenceMinutes);
  const primaryFocus = categoryRows(activity, totalSystemMinutes).sort((a, b) => b.minutes - a.minutes)[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium uppercase text-primary">
            <FileText className="h-3.5 w-3.5" />
            HR Performance Analyzer
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{report.employee.fullName}</h1>
            <p className="text-sm text-muted-foreground">
              Daily performance report · Generated {report.createdAt.toLocaleString()} · {report.reportDate.toISOString().slice(0, 10)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <form action={resendToNotion}>
            <input type="hidden" name="analysisId" value={report.id} />
            <Button variant="outline">Resend to Notion</Button>
          </form>
          <PrintButton />
          <DeleteReportButton reportId={report.id} redirectTo="/dashboard/reports" />
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={Clock3} label="Total System Time" value={formatMinutes(totalSystemMinutes)} note="Tracked active, idle, and off-task time" />
        <MetricCard icon={Gauge} label="Expected" value={formatMinutes(expectedMinutes)} note="Configured daily schedule target" />
        <MetricCard icon={BarChart3} label="Coverage" value={`${coverage}%`} note={coverage >= 100 ? "Met target" : "Below target"} />
        <MetricCard icon={TriangleAlert} label="Shortfall" value={formatMinutes(shortfallMinutes)} note={shortfallMinutes ? "Needs explanation" : "No shortfall"} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>1. Time Coverage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Productivity split: {formatMinutes(productiveMinutes)} productive · {formatMinutes(unproductiveMinutes)} unproductive · {formatMinutes(idleMinutes)} idle/neutral
          </div>
          <div className="grid h-3 overflow-hidden rounded-full bg-muted md:grid-cols-[var(--productive)_var(--unproductive)_var(--idle)]" style={{
            "--productive": `${Math.max(1, percent(productiveMinutes, totalSystemMinutes))}fr`,
            "--unproductive": `${Math.max(1, percent(unproductiveMinutes, totalSystemMinutes))}fr`,
            "--idle": `${Math.max(1, percent(idleMinutes, totalSystemMinutes))}fr`
          } as React.CSSProperties}>
            <div className="bg-emerald-400" />
            <div className="bg-red-400" />
            <div className="bg-slate-400" />
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 bg-emerald-400" />Productive {percent(productiveMinutes, totalSystemMinutes)}%</span>
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 bg-red-400" />Unproductive {percent(unproductiveMinutes, totalSystemMinutes)}%</span>
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 bg-slate-400" />Idle/Neutral {percent(idleMinutes, totalSystemMinutes)}%</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Work Time By Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-3 pr-3">Category</th>
                  <th className="px-3 py-3">Total Time</th>
                  <th className="px-3 py-3">% of Tracked</th>
                  <th className="px-3 py-3">Top Platforms</th>
                  <th className="py-3 pl-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categoryRows(activity, totalSystemMinutes).map((row) => (
                  <tr key={row.label}>
                    <td className="py-3 pr-3 font-medium">{row.label}</td>
                    <td className="px-3 py-3">{formatMinutes(row.minutes)}</td>
                    <td className="px-3 py-3">{percent(row.minutes, totalSystemMinutes)}%</td>
                    <td className="px-3 py-3 text-muted-foreground">{row.platforms.join(" · ")}</td>
                    <td className="py-3 pl-3">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. EOD + System Alignment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <section className="grid gap-4 md:grid-cols-4">
            <MetricCard icon={FileText} label="EOD Tasks" value={String(completedTasks.length)} note={`${pendingTasks.length} pending`} />
            <MetricCard icon={Clock3} label="Evidence Time" value={formatMinutes(matchedEvidenceMinutes)} note="Matched app/URL evidence" />
            <MetricCard icon={Gauge} label="Alignment" value={`${alignment}%`} note={alignment >= 75 ? "Strong match" : "Needs review"} />
            <MetricCard icon={TriangleAlert} label="Unmatched Gap" value={formatMinutes(unloggedGapMinutes)} note="System time not tied to EOD tasks" />
          </section>

          {unloggedGapMinutes > 60 && (
            <div className="rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
              {formatMinutes(unloggedGapMinutes)} of system time is not clearly explained by the EOD task evidence. Review task detail, app names, and manual notes before final judgment.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-3 pr-3">Task from EOD</th>
                  <th className="px-3 py-3">Evidence Time</th>
                  <th className="px-3 py-3">App / URL Evidence</th>
                  <th className="py-3 pl-3">Gap Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {taskEvidence.map((task) => (
                  <tr key={task.task}>
                    <td className="max-w-[340px] py-3 pr-3 align-top">{task.task}</td>
                    <td className="px-3 py-3 align-top">{formatMinutes(task.evidenceMinutes)}</td>
                    <td className="px-3 py-3 align-top text-muted-foreground">{task.evidence.length ? task.evidence.join(" · ") : "No direct app or URL match found"}</td>
                    <td className="py-3 pl-3 align-top">
                      <span className={cn("inline-flex rounded-md border px-2 py-1 text-xs font-medium", statusClasses(task.status))}>{task.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Performance Verdict</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Primary Focus</p>
              <p className="mt-1 text-lg font-semibold">{primaryFocus.label}</p>
              <p className="text-sm text-muted-foreground">{formatMinutes(primaryFocus.minutes)} · {percent(primaryFocus.minutes, totalSystemMinutes)}% of tracked time</p>
            </div>
            <div className="flex items-center gap-3">
              <RiskBadge risk={report.riskLevel} />
              <span className="text-sm text-muted-foreground">{report.score}/100 final score</span>
            </div>
            <p className="text-sm text-muted-foreground">{report.managerSummary}</p>
            <p className="text-sm">{report.recommendation}</p>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Top Goal Areas</p>
              <div className="mt-3 space-y-3">
                {taskEvidence.slice(0, 3).map((task, index) => (
                  <div key={task.task} className="flex gap-3 rounded-md border bg-muted/30 p-3 text-sm">
                    <span className="text-muted-foreground">{index + 1}.</span>
                    <div className="flex-1">
                      <p>{task.task}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{task.status} · {formatMinutes(task.evidenceMinutes)} evidence time</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Key Signals</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />Coverage at {coverage}% against expected time.</li>
                <li className="flex gap-2"><TriangleAlert className="mt-0.5 h-4 w-4 text-amber-300" />EOD alignment at {alignment}% based on direct app/URL evidence.</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />Off-task usage at {percent(unproductiveMinutes, totalSystemMinutes)}% ({formatMinutes(unproductiveMinutes)}).</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Mismatch Analysis</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{report.mismatchAnalysis}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Flags</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {report.analysisFlags.length ? report.analysisFlags.map((flag) => <div key={flag.id} className="rounded-md border p-2">{flag.severity}: {flag.message}</div>) : "No flags recorded."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Uploaded Files</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {report.uploadedReports.map((file) => <div key={file.id}>{file.reportType}: {file.fileName}</div>)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Notion Sync Logs</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {report.notionSyncLogs.length ? report.notionSyncLogs.map((log) => <div key={log.id} className="rounded-md border p-3">{log.status}: {log.message}</div>) : "No sync attempts yet."}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, note }: { icon: typeof Clock3; label: string; value: string; note: string }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}
