import OpenAI from "openai";
import { z } from "zod";
import type { RiskLevel } from "@prisma/client";
import { evaluatePerformanceWithRules } from "@/services/hr-rule-engine";
import type { ActivitySummary, FinalAnalysisJson, LoginLogoutSummary } from "@/types/analysis";

const aiEvidenceSchema = z.object({
  completed_tasks: z.array(z.string()),
  pending_tasks: z.array(z.string()),
  eod_quality: z.enum(["Clear", "Average", "Vague", "Weak/Suspicious"]),
  eod_summary: z.string(),
  mismatch_analysis: z.string(),
  irrelevant_usage_analysis: z.string(),
  flags: z.array(z.string())
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
    suspiciousTimeGaps: activity.suspiciousTimeGaps.slice(0, 8),
    activityPatterns: activity.activityPatterns.slice(0, 8),
    sampleRows: activity.rows.slice(0, 20).map((row) => ({
      appName: row.appName,
      website: row.website,
      url: row.url,
      durationMinutes: row.durationMinutes,
      idleMinutes: row.idleMinutes
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
              "You are P.H.R.I.S data extraction assistant. Extract only factual evidence from provided EOD and activity data. Do not score performance, do not infer beyond evidence, and keep strings concise."
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

function inferEodQuality(eodText: string): "Clear" | "Average" | "Vague" | "Weak/Suspicious" {
  const text = eodText.trim();
  if (text.length >= 600) return "Clear";
  if (text.length >= 300) return "Average";
  if (text.length >= 140) return "Vague";
  return "Weak/Suspicious";
}

function fallbackEvidence(eodText: string) {
  return {
    completed_tasks: [] as string[],
    pending_tasks: [] as string[],
    eod_quality: inferEodQuality(eodText),
    eod_summary: "EOD captured. AI evidence extraction fallback applied.",
    mismatch_analysis: "Mismatch analysis unavailable from AI response. Rule engine used measured thresholds only.",
    irrelevant_usage_analysis: "Irrelevant usage analysis driven by configured app and website thresholds.",
    flags: ["AI evidence extraction fallback used"]
  };
}

export function generateRiskLevel(score: number): RiskLevel {
  if (score >= 80) return "GREEN";
  if (score >= 55) return "YELLOW";
  return "RED";
}

export async function generateFinalReport(input: {
  employeeName: string;
  employeeDepartment: string;
  employeeRole: string;
  reportDate: string;
  eodText: string;
  activity: ActivitySummary;
  attendance: LoginLogoutSummary;
}): Promise<FinalAnalysisJson> {
  const prompt = `Extract strict JSON with this schema:
{
  "completed_tasks": [],
  "pending_tasks": [],
  "eod_quality": "Clear|Average|Vague|Weak/Suspicious",
  "eod_summary": "",
  "mismatch_analysis": "",
  "irrelevant_usage_analysis": "",
  "flags": []
}

Rules:
- Extract only evidence-based items.
- Do not assign any score or risk level.
- Do not produce recommendations.

Employee: ${input.employeeName}
Department: ${input.employeeDepartment}
Role: ${input.employeeRole}
Date: ${input.reportDate}

Manual EOD:
${input.eodText}

Parsed activity:
${JSON.stringify(compactActivity(input.activity))}

Parsed login/logout:
${JSON.stringify(input.attendance)}`;

  let evidence = fallbackEvidence(input.eodText);
  try {
    const raw = await requestStrictJson(prompt);
    const parsed = aiEvidenceSchema.safeParse(raw);
    if (parsed.success) {
      evidence = parsed.data;
    }
  } catch {
    evidence = fallbackEvidence(input.eodText);
  }

  const evaluated = await evaluatePerformanceWithRules({
    employee: {
      id: "",
      fullName: input.employeeName,
      department: input.employeeDepartment,
      role: input.employeeRole
    },
    activity: input.activity,
    attendance: {
      loginTime: input.attendance.loginTime,
      logoutTime: input.attendance.logoutTime,
      totalTrackedMinutes: input.attendance.totalTrackedMinutes
    },
    completedTasks: evidence.completed_tasks,
    eodQuality: evidence.eod_quality
  });

  const deterministicFlags = [...new Set([...evidence.flags, ...evaluated.flags])].slice(0, 12);

  return {
    completed_tasks: evidence.completed_tasks,
    pending_tasks: evidence.pending_tasks,
    eod_quality: evidence.eod_quality,
    eod_summary: evidence.eod_summary,
    mismatch_analysis: evidence.mismatch_analysis,
    irrelevant_usage_analysis: evidence.irrelevant_usage_analysis,
    flags: deterministicFlags,
    score_breakdown: evaluated.scoreBreakdown,
    final_score: evaluated.finalScore,
    risk_level: evaluated.riskLevel,
    manager_summary: evaluated.managerSummary,
    recommended_action: evaluated.recommendation,
    rule_evaluation: {
      passed: evaluated.ruleEvaluation.passed,
      violated: evaluated.ruleEvaluation.violated,
      all: evaluated.ruleEvaluation.all,
      context: evaluated.context,
      metrics: evaluated.metrics
    }
  };
}
