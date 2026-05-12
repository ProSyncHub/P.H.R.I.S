import { Client } from "@notionhq/client";
import { prisma } from "@/lib/prisma";
import type { DailyAnalysis, Employee } from "@prisma/client";

const notionIdPattern = /^[a-f0-9]{32}$/i;

function cleanNotionId(value?: string | null) {
  if (!value) return "";
  const compact = value.replace(/-/g, "");
  const match = compact.match(/[a-f0-9]{32}/i);
  return match?.[0] ?? "";
}

function getNotionConfig() {
  return {
    dailyReportsDatabaseId: cleanNotionId(process.env.NOTION_DAILY_REPORTS_DATABASE_ID),
    employeeMasterDatabaseId: cleanNotionId(process.env.NOTION_EMPLOYEE_MASTER_DATABASE_ID)
  };
}

function hasRequiredNotionConfig() {
  const config = getNotionConfig();
  return Boolean(process.env.NOTION_API_KEY && notionIdPattern.test(config.dailyReportsDatabaseId));
}

function notion() {
  if (!process.env.NOTION_API_KEY) {
    throw new Error("NOTION_API_KEY is not configured.");
  }
  return new Client({ auth: process.env.NOTION_API_KEY });
}

export async function findEmployeeInNotion(employee: Employee) {
  const employeePageId = cleanNotionId(employee.notionEmployeeReference);
  if (employeePageId) return employeePageId;
  const databaseId = getNotionConfig().employeeMasterDatabaseId;
  if (!databaseId) return undefined;

  const result = await notion().databases.query({
    database_id: databaseId,
    filter: {
      property: "Email",
      email: { equals: employee.email }
    }
  });

  return result.results[0]?.id;
}

export async function createDailyReportPage(analysis: DailyAnalysis, employee: Employee, employeePageId?: string) {
  const databaseId = getNotionConfig().dailyReportsDatabaseId;
  if (!databaseId) throw new Error("NOTION_DAILY_REPORTS_DATABASE_ID is not configured.");

  const page = await notion().pages.create({
    parent: { database_id: databaseId },
    properties: {
      Name: { title: [{ text: { content: `${employee.fullName} - ${analysis.reportDate.toISOString().slice(0, 10)}` } }] },
      Employee: employeePageId ? { relation: [{ id: employeePageId }] } : { rich_text: [{ text: { content: employee.fullName } }] },
      Score: { number: analysis.score },
      Risk: { select: { name: analysis.riskLevel } },
      Status: { select: { name: "Analysed" } },
      Date: { date: { start: analysis.reportDate.toISOString() } }
    } as any,
    children: [
      {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: analysis.managerSummary.slice(0, 1800) } }] }
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: analysis.recommendation.slice(0, 1800) } }] }
      }
    ]
  });

  return page.id;
}

export async function updateEmployeeMasterRecord(employeePageId: string, analysis: DailyAnalysis) {
  await notion().pages.update({
    page_id: employeePageId,
    properties: {
      "Latest Score": { number: analysis.score },
      "Latest Risk": { select: { name: analysis.riskLevel } },
      "Last Analysed": { date: { start: analysis.reportDate.toISOString() } }
    } as any
  });
}

export async function syncAnalysisToNotion(analysisId: string) {
  const analysis = await prisma.dailyAnalysis.findUnique({
    where: { id: analysisId },
    include: { employee: true }
  });
  if (!analysis) throw new Error("Analysis not found.");

  if (!hasRequiredNotionConfig()) {
    await prisma.notionSyncLog.create({
      data: {
        dailyAnalysisId: analysis.id,
        status: "PENDING",
        message: "Notion sync skipped: configure NOTION_API_KEY and NOTION_DAILY_REPORTS_DATABASE_ID with a raw Notion database ID."
      }
    });
    return { status: "PENDING", message: "Notion sync not configured." };
  }

  try {
    const employeePageId = await findEmployeeInNotion(analysis.employee);
    const notionPageId = await createDailyReportPage(analysis, analysis.employee, employeePageId);
    if (employeePageId) await updateEmployeeMasterRecord(employeePageId, analysis);

    await prisma.dailyAnalysis.update({
      where: { id: analysis.id },
      data: { notionSyncStatus: "SYNCED", notionPageId }
    });
    await prisma.notionSyncLog.create({
      data: { dailyAnalysisId: analysis.id, status: "SYNCED", message: "Synced to Notion.", notionPageId }
    });
    return { status: "SYNCED", notionPageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Notion sync error.";
    await prisma.dailyAnalysis.update({
      where: { id: analysis.id },
      data: { notionSyncStatus: "RETRY_REQUIRED" }
    });
    await prisma.notionSyncLog.create({
      data: { dailyAnalysisId: analysis.id, status: "FAILED", message }
    });
    return { status: "FAILED", message };
  }
}
