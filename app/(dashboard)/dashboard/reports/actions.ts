"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function deleteReportAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const reportId = String(formData.get("reportId") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "");

  if (!reportId) {
    throw new Error("Report id is required.");
  }

  const report = await prisma.dailyAnalysis.findUnique({
    where: { id: reportId },
    select: { id: true, employeeId: true, reportDate: true }
  });

  if (!report) {
    revalidatePath("/dashboard/reports");
    if (redirectTo) redirect(redirectTo);
    return;
  }

  await prisma.$transaction([
    prisma.uploadedReport.deleteMany({ where: { dailyAnalysisId: reportId } }),
    prisma.dailyAnalysis.delete({ where: { id: reportId } }),
    prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "ANALYSIS_DELETED",
        entity: "DailyAnalysis",
        entityId: reportId,
        metadata: {
          employeeId: report.employeeId,
          reportDate: report.reportDate.toISOString()
        }
      }
    })
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reports");

  if (redirectTo) {
    redirect(redirectTo);
  }
}
