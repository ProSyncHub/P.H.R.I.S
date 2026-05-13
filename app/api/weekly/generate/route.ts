import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateWeeklyAnalysis, generateWeeklyReportsForWeek } from "@/services/weekly-report";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const weekStart = body.weekStart ?? new Date().toISOString();

    if (body.scope === "EMPLOYEE" || body.scope === "DEPARTMENT") {
      if (body.scope === "EMPLOYEE" && !body.employeeId) {
        return NextResponse.json({ error: "employeeId is required for employee scope." }, { status: 400 });
      }
      if (body.scope === "DEPARTMENT" && !body.department) {
        return NextResponse.json({ error: "department is required for department scope." }, { status: 400 });
      }

      const report = await generateWeeklyAnalysis({
        scope: body.scope,
        weekStart,
        employeeId: body.employeeId,
        department: body.department
      });
      return NextResponse.json({ weeklyAnalysisId: report.id, scope: report.scope });
    }

    const result = await generateWeeklyReportsForWeek(weekStart);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weekly generation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
