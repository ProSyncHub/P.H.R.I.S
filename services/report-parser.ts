import { parse as parseCsv } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { sanitizeCell } from "@/lib/security";
import type { ActivitySummary, LoginLogoutSummary, ParsedActivityRow } from "@/types/analysis";

const irrelevantSignals = ["youtube", "instagram", "facebook", "netflix", "primevideo", "hotstar", "shopping", "flipkart"];
const workSignals = ["vscode", "visual studio", "replit", "github", "notion", "figma", "sheets", "docs", "slack", "teams", "gmail"];

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getValue(row: Record<string, unknown>, candidates: string[]) {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [normalizeKey(key), value]));
  for (const candidate of candidates) {
    const value = normalized.get(normalizeKey(candidate));
    if (value !== undefined) return sanitizeCell(value);
  }
  return "";
}

function durationToMinutes(value: unknown) {
  const text = sanitizeCell(value).toLowerCase();
  if (!text) return 0;
  const timeParts = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeParts) {
    const first = Number(timeParts[1]);
    const second = Number(timeParts[2]);
    const third = Number(timeParts[3] ?? 0);
    return third ? first * 60 + second + third / 60 : first * 60 + second;
  }
  const hours = Number(text.match(/(\d+(?:\.\d+)?)\s*h/)?.[1] ?? 0);
  const minutes = Number(text.match(/(\d+(?:\.\d+)?)\s*m/)?.[1] ?? 0);
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  return Math.round(hours * 60 + minutes);
}

function parseClock(value?: string) {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  const match = normalized.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/);
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3];
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

async function rowsFromFile(buffer: ArrayBuffer, fileName: string): Promise<Record<string, unknown>[]> {
  const bytes = Buffer.from(buffer);
  if (fileName.toLowerCase().endsWith(".csv")) {
    return parseCsv(bytes, { columns: true, skip_empty_lines: true, bom: true, trim: true });
  }
  const workbook = XLSX.read(bytes, { type: "buffer", cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

export async function parseDetailedActivityReport(buffer: ArrayBuffer, fileName: string): Promise<ActivitySummary> {
  const rows = await rowsFromFile(buffer, fileName);
  const parsedRows: ParsedActivityRow[] = rows.map((row) => {
    const appName = getValue(row, ["App Name", "Application", "App", "Window Title"]);
    const website = getValue(row, ["Website", "Domain", "URL Host", "Site"]);
    const url = getValue(row, ["URL", "Urls", "Link"]);
    const category = getValue(row, ["Productivity", "Category", "Productivity Category"]);
    const durationMinutes = durationToMinutes(getValue(row, ["Duration", "Time Spent", "Total Time", "Active Time"]));
    const idleMinutes = durationToMinutes(getValue(row, ["Idle", "Idle Time", "Inactive Time"]));

    return {
      employeeName: getValue(row, ["Employee", "Employee Name", "Name"]),
      date: getValue(row, ["Date", "Activity Date"]),
      appName,
      website,
      url,
      startTime: getValue(row, ["Start Time", "From"]),
      endTime: getValue(row, ["End Time", "To"]),
      durationMinutes,
      idleMinutes,
      category
    };
  });

  const appTotals = new Map<string, number>();
  const websiteTotals = new Map<string, number>();
  let productive = 0;
  let unproductive = 0;
  let idle = 0;

  for (const row of parsedRows) {
    const label = `${row.appName ?? ""} ${row.website ?? ""} ${row.url ?? ""}`.toLowerCase();
    const minutes = row.durationMinutes;
    idle += row.idleMinutes;
    if (row.appName) appTotals.set(row.appName, (appTotals.get(row.appName) ?? 0) + minutes);
    if (row.website) websiteTotals.set(row.website, (websiteTotals.get(row.website) ?? 0) + minutes);
    if (irrelevantSignals.some((signal) => label.includes(signal)) || row.category?.toLowerCase().includes("unproductive")) {
      unproductive += minutes;
    } else if (workSignals.some((signal) => label.includes(signal)) || row.category?.toLowerCase().includes("productive")) {
      productive += minutes;
    }
  }

  const top = (map: Map<string, number>) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, minutes]) => ({ name, minutes: Math.round(minutes) }));

  const irrelevantUsage = [...appTotals.entries(), ...websiteTotals.entries()]
    .filter(([name]) => irrelevantSignals.some((signal) => name.toLowerCase().includes(signal)))
    .map(([name, minutes]) => ({ name, minutes: Math.round(minutes), reason: "Non-work usage signal" }))
    .slice(0, 10);

  return {
    employeeName: parsedRows.find((row) => row.employeeName)?.employeeName,
    date: parsedRows.find((row) => row.date)?.date,
    totalProductiveMinutes: Math.round(productive),
    totalIdleMinutes: Math.round(idle),
    totalUnproductiveMinutes: Math.round(unproductive),
    mostUsedApps: top(appTotals),
    mostVisitedWebsites: top(websiteTotals),
    workRelatedUsage: [...new Set(parsedRows.filter((row) => workSignals.some((s) => `${row.appName} ${row.website}`.toLowerCase().includes(s))).map((row) => row.appName || row.website || ""))].filter(Boolean),
    irrelevantUsage,
    suspiciousTimeGaps: parsedRows.length === 0 ? ["No activity rows parsed from report."] : [],
    activityPatterns: [`Parsed ${parsedRows.length} activity rows`, `Detected ${Math.round(productive)} productive minutes and ${Math.round(unproductive)} unproductive minutes.`],
    rows: parsedRows.slice(0, 500)
  };
}

export async function parseLoginLogoutReport(buffer: ArrayBuffer, fileName: string, reportDate: Date): Promise<LoginLogoutSummary> {
  const rows = await rowsFromFile(buffer, fileName);
  const row = rows[0] ?? {};
  const loginTime = getValue(row, ["Login", "Login Time", "First Login", "Clock In"]);
  const logoutTime = getValue(row, ["Logout", "Logout Time", "Last Logout", "Clock Out"]);
  const totalTrackedMinutes =
    durationToMinutes(getValue(row, ["Total", "Total Time", "Tracked Time", "Work Hours"])) ||
    Math.max(0, (parseClock(logoutTime) ?? 0) - (parseClock(loginTime) ?? 0));

  const day = reportDate.getDay();
  const expectedLogin = day === 6 ? 9 * 60 + 30 : 10 * 60;
  const expectedLogout = day === 6 ? 17 * 60 : 18 * 60 + 30;
  const actualLogin = parseClock(loginTime);
  const actualLogout = parseClock(logoutTime);
  const lateLogin = actualLogin !== undefined ? actualLogin > expectedLogin + 5 : true;
  const earlyLogout = actualLogout !== undefined ? actualLogout < expectedLogout - 5 : true;
  const missingLogout = !logoutTime;

  return {
    employeeName: getValue(row, ["Employee", "Employee Name", "Name"]),
    date: getValue(row, ["Date"]),
    loginTime,
    logoutTime,
    totalTrackedMinutes: Math.round(totalTrackedMinutes),
    attendanceStatus: missingLogout ? "Missing Logout" : lateLogin || earlyLogout ? "Needs Review" : "Present",
    lateLogin,
    earlyLogout,
    missingLogout,
    disciplineSummary: missingLogout
      ? "Logout data is missing."
      : lateLogin || earlyLogout
        ? "Attendance discipline issue detected against configured office timings."
        : "Attendance aligns with configured office timings."
  };
}
