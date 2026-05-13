import { NextResponse } from "next/server";
import { subWeeks } from "date-fns";
import { generateWeeklyReportsForWeek } from "@/services/weekly-report";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const headerSecret = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

  if (!secret || headerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const weekStart = body.weekStart ?? subWeeks(new Date(), 1).toISOString();
    const result = await generateWeeklyReportsForWeek(weekStart);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weekly cron failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
