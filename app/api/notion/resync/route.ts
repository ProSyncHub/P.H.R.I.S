import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { syncAnalysisToNotion } from "@/services/notion-sync";
import { z } from "zod";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { analysisId } = z.object({ analysisId: z.string() }).parse(await request.json());
  return NextResponse.json(await syncAnalysisToNotion(analysisId));
}
