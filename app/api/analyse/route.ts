import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { assertAllowedUpload, analysisUploadSchema } from "@/lib/security";
import { hoursFromMinutes } from "@/lib/utils";
import { generateFinalReport } from "@/services/openai-analysis";
import { syncAnalysisToNotion } from "@/services/notion-sync";
import { parseDetailedActivityReport, parseLoginLogoutReport } from "@/services/report-parser";

function compactActivityForStorage<T extends { rows?: unknown[] }>(summary: T) {
  return { ...summary, rows: summary.rows?.slice(0, 100) };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limiter = rateLimit(`analyse:${session.user.id}`);
  if (!limiter.allowed) return NextResponse.json({ error: "Too many analysis requests. Please retry shortly." }, { status: 429 });

  try {
    const formData = await request.formData();
    const validated = analysisUploadSchema.parse({
      employeeId: formData.get("employeeId"),
      reportDate: formData.get("reportDate"),
      eodText: formData.get("eodText")
    });

    const detailedFile = formData.get("detailedActivityReport");
    const loginFile = formData.get("loginLogoutReport");
    if (!(detailedFile instanceof File) || !(loginFile instanceof File)) {
      return NextResponse.json({ error: "Both Time Champ reports are required." }, { status: 400 });
    }

    assertAllowedUpload(detailedFile);
    assertAllowedUpload(loginFile);

    const employee = await prisma.employee.findUnique({ where: { id: validated.employeeId } });
    if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

    const reportDate = new Date(validated.reportDate);
    const [activity, attendance] = await Promise.all([
      parseDetailedActivityReport(await detailedFile.arrayBuffer(), detailedFile.name),
      parseLoginLogoutReport(await loginFile.arrayBuffer(), loginFile.name, reportDate)
    ]);

    const finalReport = await generateFinalReport({
      employeeName: employee.fullName,
      employeeDepartment: employee.department,
      employeeRole: employee.role,
      reportDate: validated.reportDate,
      eodText: validated.eodText,
      activity,
      attendance
    });

    const analysis = await prisma.dailyAnalysis.create({
      data: {
        employeeId: employee.id,
        reportDate,
        loginTime: attendance.loginTime,
        logoutTime: attendance.logoutTime,
        totalHours: hoursFromMinutes(attendance.totalTrackedMinutes),
        productiveHours: hoursFromMinutes(activity.totalProductiveMinutes),
        unproductiveTime: hoursFromMinutes(activity.totalUnproductiveMinutes),
        idleTime: hoursFromMinutes(activity.totalIdleMinutes),
        eodRawText: validated.eodText,
        eodSummary: finalReport.eod_summary,
        activitySummaryJson: compactActivityForStorage(activity) as any,
        loginLogoutSummaryJson: attendance as any,
        eodAnalysisJson: {
          completed_tasks: finalReport.completed_tasks,
          pending_tasks: finalReport.pending_tasks,
          eod_quality: finalReport.eod_quality,
          rule_evaluation: finalReport.rule_evaluation
        },
        mismatchAnalysis: finalReport.mismatch_analysis,
        score: finalReport.final_score,
        riskLevel: finalReport.risk_level,
        flagsJson: finalReport.flags,
        managerSummary: finalReport.manager_summary,
        recommendation: finalReport.recommended_action,
        uploadedReports: {
          create: [
            {
              employeeId: employee.id,
              reportType: "DETAILED_ACTIVITY",
              fileName: detailedFile.name,
              mimeType: detailedFile.type || "application/octet-stream",
              fileSize: detailedFile.size,
              parsedJson: compactActivityForStorage(activity) as any
            },
            {
              employeeId: employee.id,
              reportType: "LOGIN_LOGOUT",
              fileName: loginFile.name,
              mimeType: loginFile.type || "application/octet-stream",
              fileSize: loginFile.size,
              parsedJson: attendance as any
            }
          ]
        },
        analysisFlags: {
          create: finalReport.flags.map((flag) => ({
            type: flag,
            severity: finalReport.risk_level === "RED" ? "High" : finalReport.risk_level === "YELLOW" ? "Medium" : "Low",
            message: flag
          }))
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "ANALYSIS_CREATED",
        entity: "DailyAnalysis",
        entityId: analysis.id,
        metadata: { employeeId: employee.id, reportDate: validated.reportDate }
      }
    });

    const sync = await syncAnalysisToNotion(analysis.id);
    return NextResponse.json({ analysisId: analysis.id, notionSync: sync });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
