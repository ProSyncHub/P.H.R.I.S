"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { subWeeks } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateWeeklyReportsForWeek } from "@/services/weekly-report";

export async function generateWeeklyReportsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const weekStartRaw = String(formData.get("weekStart") ?? "");
  const weekStart = weekStartRaw ? new Date(weekStartRaw) : subWeeks(new Date(), 1);
  const result = await generateWeeklyReportsForWeek(weekStart);

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: "WEEKLY_REPORTS_GENERATED",
      entity: "WeeklyAnalysis",
      metadata: result
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/weekly");
  void result;
}

export async function deleteWeeklyReportAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const weeklyReportId = String(formData.get("weeklyReportId") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "");

  if (!weeklyReportId) {
    throw new Error("Weekly report id is required.");
  }

  const report = await prisma.weeklyAnalysis.findUnique({
    where: { id: weeklyReportId },
    select: { id: true, employeeId: true, department: true, weekStart: true }
  });

  if (!report) {
    revalidatePath("/dashboard/weekly");
    if (redirectTo) redirect(redirectTo);
    return;
  }

  await prisma.weeklyAnalysis.delete({
    where: { id: weeklyReportId }
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: "WEEKLY_ANALYSIS_DELETED",
      entity: "WeeklyAnalysis",
      entityId: weeklyReportId,
      metadata: {
        employeeId: report.employeeId,
        department: report.department,
        weekStart: report.weekStart.toISOString()
      }
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/weekly");

  if (redirectTo) {
    redirect(redirectTo);
  }
}
