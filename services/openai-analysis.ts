import OpenAI from "openai";
import { z } from "zod";
import { calculateRuleScore } from "@/services/scoring";
import type { ActivitySummary, FinalAnalysisJson, LoginLogoutSummary } from "@/types/analysis";

const finalAnalysisSchema = z.object({
  completed_tasks: z.array(z.string()),
  pending_tasks: z.array(z.string()),
  eod_quality: z.enum(["Clear", "Average", "Vague", "Weak/Suspicious"]),
  eod_summary: z.string(),
  mismatch_analysis: z.string(),
  irrelevant_usage_analysis: z.string(),
  flags: z.array(z.string()),
  score_breakdown: z.object({
    attendance: z.number(),
    work_hours: z.number(),
    productive_activity: z.number(),
    eod_clarity: z.number(),
    timechamp_eod_match: z.number()
  }),
  final_score: z.number().min(0).max(100),
  risk_level: z.enum(["GREEN", "YELLOW", "RED"]),
  manager_summary: z.string(),
  recommended_action: z.string()
});

function client() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for AI analysis.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function compactActivity(activity: ActivitySummary) {
  return {
    employeeName: activity.employeeName,
    date: activity.date,
    totalProductiveMinutes: activity.totalProductiveMinutes,
    totalIdleMinutes: activity.totalIdleMinutes,
    totalUnproductiveMinutes: activity.totalUnproductiveMinutes,
    mostUsedApps: activity.mostUsedApps.slice(0, 8),
    mostVisitedWebsites: activity.mostVisitedWebsites.slice(0, 8),
    workRelatedUsage: activity.workRelatedUsage.slice(0, 12),
    irrelevantUsage: activity.irrelevantUsage.slice(0, 12),
    suspiciousTimeGaps: activity.suspiciousTimeGaps.slice(0, 8),
    activityPatterns: activity.activityPatterns.slice(0, 8),
    sampleRows: activity.rows.slice(0, 25).map((row) => ({
      appName: row.appName,
      website: row.website,
      url: row.url,
      startTime: row.startTime,
      endTime: row.endTime,
      durationMinutes: row.durationMinutes,
      idleMinutes: row.idleMinutes,
      category: row.category
    }))
  };
}

async function requestStrictJson(prompt: string, retries = 2) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const completion = await client().chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        temperature: 0.1,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are P.H.R.I.S, an enterprise HR performance intelligence engine. Return only strict JSON matching the requested schema. Be fair, evidence-based, and concise. Keep every string short."
          },
          { role: "user", content: prompt }
        ]
      });

      return JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function analyseEOD(eodText: string) {
  return requestStrictJson(`Analyze this manual end day report. Return JSON with completed_tasks, pending_tasks, eod_quality, eod_summary, blockers, and missing_details.\n\nEOD:\n${eodText}`);
}

export async function compareTimeChampActivity(eodText: string, activity: ActivitySummary, attendance: LoginLogoutSummary) {
  return requestStrictJson(`Compare this EOD with Time Champ parsed activity and attendance. Return mismatch_analysis, irrelevant_usage_analysis, flags, and match_penalty from 0 to 20.

EOD:
${eodText}

Activity JSON:
${JSON.stringify(compactActivity(activity))}

Attendance JSON:
${JSON.stringify(attendance)}`);
}

export async function generateManagerSummary(report: FinalAnalysisJson) {
  return requestStrictJson(`Create a concise manager summary and recommended action for this analysis. Return manager_summary and recommended_action.\n${JSON.stringify(report)}`);
}

export function generateRiskLevel(score: number) {
  if (score >= 80) return "GREEN";
  if (score >= 55) return "YELLOW";
  return "RED";
}

export async function generateFinalReport(input: {
  employeeName: string;
  reportDate: string;
  eodText: string;
  activity: ActivitySummary;
  attendance: LoginLogoutSummary;
}): Promise<FinalAnalysisJson> {
  const prompt = `Generate the final P.H.R.I.S daily employee performance report as strict JSON.

Required schema:
{
  "completed_tasks": [],
  "pending_tasks": [],
  "eod_quality": "Clear|Average|Vague|Weak/Suspicious",
  "eod_summary": "",
  "mismatch_analysis": "",
  "irrelevant_usage_analysis": "",
  "flags": [],
  "score_breakdown": {
    "attendance": 0,
    "work_hours": 0,
    "productive_activity": 0,
    "eod_clarity": 0,
    "timechamp_eod_match": 0
  },
  "final_score": 0,
  "risk_level": "GREEN|YELLOW|RED",
  "manager_summary": "",
  "recommended_action": ""
}

Scoring max values: attendance 20, work_hours 20, productive_activity 25, eod_clarity 15, timechamp_eod_match 20. Risk: GREEN 80-100, YELLOW 55-79, RED below 55.

Employee: ${input.employeeName}
Date: ${input.reportDate}

Manual EOD:
${input.eodText}

Parsed activity:
${JSON.stringify(compactActivity(input.activity))}

Parsed login/logout:
${JSON.stringify(input.attendance)}`;

  const raw = await requestStrictJson(prompt);
  const parsed = finalAnalysisSchema.safeParse(raw);

  if (parsed.success) {
    return parsed.data;
  }

  const fallback = calculateRuleScore(input.activity, input.attendance, String(raw.eod_quality ?? "Average"), 8);
  return finalAnalysisSchema.parse({
    completed_tasks: Array.isArray(raw.completed_tasks) ? raw.completed_tasks : [],
    pending_tasks: Array.isArray(raw.pending_tasks) ? raw.pending_tasks : [],
    eod_quality: ["Clear", "Average", "Vague", "Weak/Suspicious"].includes(raw.eod_quality) ? raw.eod_quality : "Average",
    eod_summary: String(raw.eod_summary ?? "EOD parsed, but AI response required normalization."),
    mismatch_analysis: String(raw.mismatch_analysis ?? "Mismatch analysis unavailable from normalized AI response."),
    irrelevant_usage_analysis: String(raw.irrelevant_usage_analysis ?? "Irrelevant usage analysis unavailable from normalized AI response."),
    flags: Array.isArray(raw.flags) ? raw.flags : ["Needs Review"],
    score_breakdown: fallback.score_breakdown,
    final_score: fallback.final_score,
    risk_level: fallback.risk_level,
    manager_summary: String(raw.manager_summary ?? "Manager review recommended."),
    recommended_action: String(raw.recommended_action ?? "Review parsed report and employee context before action.")
  });
}
