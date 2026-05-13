import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureGlobalRuleSet, splitListInput } from "@/services/hr-rule-engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

function num(formData: FormData, key: string, fallback: number) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : fallback;
}

function str(formData: FormData, key: string, fallback = "") {
  const value = String(formData.get(key) ?? "").trim();
  return value || fallback;
}

function parseClockToMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function parseWorkingDays(value: string) {
  const parsed = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  return parsed.length ? [...new Set(parsed)] : [1, 2, 3, 4, 5, 6];
}

async function saveGlobalRuleSetAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const existing = await ensureGlobalRuleSet();
  const loginMinutes = parseClockToMinutes(str(formData, "expectedLoginTime", "10:00")) ?? 10 * 60;
  const logoutMinutes = parseClockToMinutes(str(formData, "expectedLogoutTime", "18:30")) ?? 18 * 60 + 30;
  const workingDays = parseWorkingDays(str(formData, "workingDays", "1,2,3,4,5,6"));

  await prisma.performanceRuleSet.update({
    where: { id: existing.id },
    data: {
      name: str(formData, "name", "Default Global HR Rules"),
      isActive: true,
      workingDays,
      expectedLoginMinutes: loginMinutes,
      expectedLogoutMinutes: logoutMinutes,
      gracePeriodMinutes: num(formData, "gracePeriodMinutes", 5),
      minimumWorkingHours: num(formData, "minimumWorkingHours", 8),
      idealWorkingHours: num(formData, "idealWorkingHours", 8.5),
      shortDayThresholdHours: num(formData, "shortDayThresholdHours", 7.5),
      criticalShortDayThresholdHours: num(formData, "criticalShortDayThresholdHours", 6.5),
      productivePctGood: num(formData, "productivePctGood", 70),
      productivePctWarning: num(formData, "productivePctWarning", 55),
      idlePctWarning: num(formData, "idlePctWarning", 20),
      idlePctCritical: num(formData, "idlePctCritical", 30),
      irrelevantUsageWarningMinutes: num(formData, "irrelevantUsageWarningMinutes", 45),
      irrelevantUsageCriticalMinutes: num(formData, "irrelevantUsageCriticalMinutes", 90),
      eodScoreClear: num(formData, "eodScoreClear", 15),
      eodScoreAverage: num(formData, "eodScoreAverage", 10),
      eodScoreVague: num(formData, "eodScoreVague", 6),
      eodScoreWeak: num(formData, "eodScoreWeak", 3),
      timechampEodMatchGoodPct: num(formData, "timechampEodMatchGoodPct", 75),
      timechampEodMatchWarningPct: num(formData, "timechampEodMatchWarningPct", 50),
      riskGreenMin: num(formData, "riskGreenMin", 80),
      riskYellowMin: num(formData, "riskYellowMin", 55)
    }
  });

  revalidatePath("/dashboard/settings");
}

async function saveDepartmentRuleSetAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const department = str(formData, "department");
  if (!department) throw new Error("Department is required.");

  const loginMinutes = parseClockToMinutes(str(formData, "expectedLoginTime", "10:00")) ?? 10 * 60;
  const logoutMinutes = parseClockToMinutes(str(formData, "expectedLogoutTime", "18:30")) ?? 18 * 60 + 30;
  const workingDays = parseWorkingDays(str(formData, "workingDays", "1,2,3,4,5,6"));
  const existing = await prisma.performanceRuleSet.findFirst({ where: { scope: "DEPARTMENT", department }, orderBy: { updatedAt: "desc" } });

  if (existing) {
    await prisma.performanceRuleSet.update({
      where: { id: existing.id },
      data: {
        name: str(formData, "name", `${department} HR Rules`),
        isActive: true,
        workingDays,
        expectedLoginMinutes: loginMinutes,
        expectedLogoutMinutes: logoutMinutes,
        gracePeriodMinutes: num(formData, "gracePeriodMinutes", 5),
        minimumWorkingHours: num(formData, "minimumWorkingHours", 8),
        idealWorkingHours: num(formData, "idealWorkingHours", 8.5),
        shortDayThresholdHours: num(formData, "shortDayThresholdHours", 7.5),
        criticalShortDayThresholdHours: num(formData, "criticalShortDayThresholdHours", 6.5),
        productivePctGood: num(formData, "productivePctGood", 70),
        productivePctWarning: num(formData, "productivePctWarning", 55),
        idlePctWarning: num(formData, "idlePctWarning", 20),
        idlePctCritical: num(formData, "idlePctCritical", 30),
        irrelevantUsageWarningMinutes: num(formData, "irrelevantUsageWarningMinutes", 45),
        irrelevantUsageCriticalMinutes: num(formData, "irrelevantUsageCriticalMinutes", 90),
        eodScoreClear: num(formData, "eodScoreClear", 15),
        eodScoreAverage: num(formData, "eodScoreAverage", 10),
        eodScoreVague: num(formData, "eodScoreVague", 6),
        eodScoreWeak: num(formData, "eodScoreWeak", 3),
        timechampEodMatchGoodPct: num(formData, "timechampEodMatchGoodPct", 75),
        timechampEodMatchWarningPct: num(formData, "timechampEodMatchWarningPct", 50),
        riskGreenMin: num(formData, "riskGreenMin", 80),
        riskYellowMin: num(formData, "riskYellowMin", 55)
      }
    });
  } else {
    await prisma.performanceRuleSet.create({
      data: {
        name: str(formData, "name", `${department} HR Rules`),
        scope: "DEPARTMENT",
        department,
        isActive: true,
        workingDays,
        expectedLoginMinutes: loginMinutes,
        expectedLogoutMinutes: logoutMinutes,
        gracePeriodMinutes: num(formData, "gracePeriodMinutes", 5),
        minimumWorkingHours: num(formData, "minimumWorkingHours", 8),
        idealWorkingHours: num(formData, "idealWorkingHours", 8.5),
        shortDayThresholdHours: num(formData, "shortDayThresholdHours", 7.5),
        criticalShortDayThresholdHours: num(formData, "criticalShortDayThresholdHours", 6.5),
        productivePctGood: num(formData, "productivePctGood", 70),
        productivePctWarning: num(formData, "productivePctWarning", 55),
        idlePctWarning: num(formData, "idlePctWarning", 20),
        idlePctCritical: num(formData, "idlePctCritical", 30),
        irrelevantUsageWarningMinutes: num(formData, "irrelevantUsageWarningMinutes", 45),
        irrelevantUsageCriticalMinutes: num(formData, "irrelevantUsageCriticalMinutes", 90),
        eodScoreClear: num(formData, "eodScoreClear", 15),
        eodScoreAverage: num(formData, "eodScoreAverage", 10),
        eodScoreVague: num(formData, "eodScoreVague", 6),
        eodScoreWeak: num(formData, "eodScoreWeak", 3),
        timechampEodMatchGoodPct: num(formData, "timechampEodMatchGoodPct", 75),
        timechampEodMatchWarningPct: num(formData, "timechampEodMatchWarningPct", 50),
        riskGreenMin: num(formData, "riskGreenMin", 80),
        riskYellowMin: num(formData, "riskYellowMin", 55)
      }
    });
  }

  revalidatePath("/dashboard/settings");
}

async function saveRoleUsageRuleAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const role = str(formData, "role");
  if (!role) throw new Error("Role is required.");
  const departmentRaw = str(formData, "department");
  const department = departmentRaw || null;

  const relevantApps = splitListInput(str(formData, "relevantApps"));
  const relevantWebsites = splitListInput(str(formData, "relevantWebsites"));
  const irrelevantApps = splitListInput(str(formData, "irrelevantApps"));
  const irrelevantWebsites = splitListInput(str(formData, "irrelevantWebsites"));

  const existing = await prisma.roleUsageRule.findFirst({
    where: {
      role,
      department
    }
  });

  if (existing) {
    await prisma.roleUsageRule.update({
      where: { id: existing.id },
      data: { isActive: true, relevantApps, relevantWebsites, irrelevantApps, irrelevantWebsites }
    });
  } else {
    await prisma.roleUsageRule.create({
      data: {
        role,
        department,
        isActive: true,
        relevantApps,
        relevantWebsites,
        irrelevantApps,
        irrelevantWebsites
      }
    });
  }

  revalidatePath("/dashboard/settings");
}

function toClock(minutes: number) {
  const hh = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const mm = (minutes % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function toCsvList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).join(", ") : "";
}

export default async function SettingsPage() {
  const [globalRuleSet, departmentRuleSets, roleUsageRules] = await Promise.all([
    ensureGlobalRuleSet(),
    prisma.performanceRuleSet.findMany({ where: { scope: "DEPARTMENT" }, orderBy: [{ department: "asc" }, { updatedAt: "desc" }] }),
    prisma.roleUsageRule.findMany({ orderBy: [{ role: "asc" }, { department: "asc" }] })
  ]);

  const env = [
    ["DATABASE_URL", Boolean(process.env.DATABASE_URL)],
    ["NEXTAUTH_SECRET", Boolean(process.env.NEXTAUTH_SECRET)],
    ["OPENAI_API_KEY", Boolean(process.env.OPENAI_API_KEY)],
    ["NOTION_API_KEY", Boolean(process.env.NOTION_API_KEY)],
    ["NOTION_DAILY_REPORTS_DATABASE_ID", Boolean(process.env.NOTION_DAILY_REPORTS_DATABASE_ID)],
    ["NOTION_EMPLOYEE_MASTER_DATABASE_ID", Boolean(process.env.NOTION_EMPLOYEE_MASTER_DATABASE_ID)]
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure strict HR performance rules and deployment readiness.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Global Performance Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveGlobalRuleSetAction} className="grid gap-3 md:grid-cols-4">
            <Input name="name" defaultValue={globalRuleSet.name} placeholder="Rule set name" required />
            <Input name="workingDays" defaultValue={Array.isArray(globalRuleSet.workingDays) ? globalRuleSet.workingDays.join(",") : "1,2,3,4,5,6"} placeholder="Working days: 1,2,3,4,5,6" />
            <Input name="expectedLoginTime" defaultValue={toClock(globalRuleSet.expectedLoginMinutes)} placeholder="Expected login HH:mm" />
            <Input name="expectedLogoutTime" defaultValue={toClock(globalRuleSet.expectedLogoutMinutes)} placeholder="Expected logout HH:mm" />
            <Input name="gracePeriodMinutes" type="number" step="1" defaultValue={globalRuleSet.gracePeriodMinutes} placeholder="Grace period minutes" />
            <Input name="minimumWorkingHours" type="number" step="0.1" defaultValue={globalRuleSet.minimumWorkingHours} placeholder="Minimum working hours" />
            <Input name="idealWorkingHours" type="number" step="0.1" defaultValue={globalRuleSet.idealWorkingHours} placeholder="Ideal working hours" />
            <Input name="shortDayThresholdHours" type="number" step="0.1" defaultValue={globalRuleSet.shortDayThresholdHours} placeholder="Short day threshold hours" />
            <Input name="criticalShortDayThresholdHours" type="number" step="0.1" defaultValue={globalRuleSet.criticalShortDayThresholdHours} placeholder="Critical short day threshold hours" />
            <Input name="productivePctGood" type="number" step="0.1" defaultValue={globalRuleSet.productivePctGood} placeholder="Productive % good threshold" />
            <Input name="productivePctWarning" type="number" step="0.1" defaultValue={globalRuleSet.productivePctWarning} placeholder="Productive % warning threshold" />
            <Input name="idlePctWarning" type="number" step="0.1" defaultValue={globalRuleSet.idlePctWarning} placeholder="Idle % warning threshold" />
            <Input name="idlePctCritical" type="number" step="0.1" defaultValue={globalRuleSet.idlePctCritical} placeholder="Idle % critical threshold" />
            <Input name="irrelevantUsageWarningMinutes" type="number" step="1" defaultValue={globalRuleSet.irrelevantUsageWarningMinutes} placeholder="Irrelevant usage warning minutes" />
            <Input name="irrelevantUsageCriticalMinutes" type="number" step="1" defaultValue={globalRuleSet.irrelevantUsageCriticalMinutes} placeholder="Irrelevant usage critical minutes" />
            <Input name="eodScoreClear" type="number" step="1" defaultValue={globalRuleSet.eodScoreClear} placeholder="EOD score Clear" />
            <Input name="eodScoreAverage" type="number" step="1" defaultValue={globalRuleSet.eodScoreAverage} placeholder="EOD score Average" />
            <Input name="eodScoreVague" type="number" step="1" defaultValue={globalRuleSet.eodScoreVague} placeholder="EOD score Vague" />
            <Input name="eodScoreWeak" type="number" step="1" defaultValue={globalRuleSet.eodScoreWeak} placeholder="EOD score Weak/Suspicious" />
            <Input name="timechampEodMatchGoodPct" type="number" step="0.1" defaultValue={globalRuleSet.timechampEodMatchGoodPct} placeholder="Match % good threshold" />
            <Input name="timechampEodMatchWarningPct" type="number" step="0.1" defaultValue={globalRuleSet.timechampEodMatchWarningPct} placeholder="Match % warning threshold" />
            <Input name="riskGreenMin" type="number" step="1" defaultValue={globalRuleSet.riskGreenMin} placeholder="Risk GREEN minimum score" />
            <Input name="riskYellowMin" type="number" step="1" defaultValue={globalRuleSet.riskYellowMin} placeholder="Risk YELLOW minimum score" />
            <div className="md:col-span-4">
              <Button type="submit">Save Global Rules</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Department-wise Performance Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={saveDepartmentRuleSetAction} className="grid gap-3 md:grid-cols-4">
            <Input name="department" placeholder="Department name (required)" required />
            <Input name="name" placeholder="Rule set name" />
            <Input name="workingDays" placeholder="Working days: 1,2,3,4,5,6" defaultValue="1,2,3,4,5,6" />
            <Input name="expectedLoginTime" placeholder="Expected login HH:mm" defaultValue="10:00" />
            <Input name="expectedLogoutTime" placeholder="Expected logout HH:mm" defaultValue="18:30" />
            <Input name="gracePeriodMinutes" type="number" step="1" placeholder="Grace period minutes" defaultValue={5} />
            <Input name="minimumWorkingHours" type="number" step="0.1" placeholder="Minimum working hours" defaultValue={8} />
            <Input name="idealWorkingHours" type="number" step="0.1" placeholder="Ideal working hours" defaultValue={8.5} />
            <Input name="shortDayThresholdHours" type="number" step="0.1" placeholder="Short day threshold hours" defaultValue={7.5} />
            <Input name="criticalShortDayThresholdHours" type="number" step="0.1" placeholder="Critical short day threshold hours" defaultValue={6.5} />
            <Input name="productivePctGood" type="number" step="0.1" placeholder="Productive % good threshold" defaultValue={70} />
            <Input name="productivePctWarning" type="number" step="0.1" placeholder="Productive % warning threshold" defaultValue={55} />
            <Input name="idlePctWarning" type="number" step="0.1" placeholder="Idle % warning threshold" defaultValue={20} />
            <Input name="idlePctCritical" type="number" step="0.1" placeholder="Idle % critical threshold" defaultValue={30} />
            <Input name="irrelevantUsageWarningMinutes" type="number" step="1" placeholder="Irrelevant usage warning minutes" defaultValue={45} />
            <Input name="irrelevantUsageCriticalMinutes" type="number" step="1" placeholder="Irrelevant usage critical minutes" defaultValue={90} />
            <Input name="eodScoreClear" type="number" step="1" placeholder="EOD score Clear" defaultValue={15} />
            <Input name="eodScoreAverage" type="number" step="1" placeholder="EOD score Average" defaultValue={10} />
            <Input name="eodScoreVague" type="number" step="1" placeholder="EOD score Vague" defaultValue={6} />
            <Input name="eodScoreWeak" type="number" step="1" placeholder="EOD score Weak/Suspicious" defaultValue={3} />
            <Input name="timechampEodMatchGoodPct" type="number" step="0.1" placeholder="Match % good threshold" defaultValue={75} />
            <Input name="timechampEodMatchWarningPct" type="number" step="0.1" placeholder="Match % warning threshold" defaultValue={50} />
            <Input name="riskGreenMin" type="number" step="1" placeholder="Risk GREEN minimum score" defaultValue={80} />
            <Input name="riskYellowMin" type="number" step="1" placeholder="Risk YELLOW minimum score" defaultValue={55} />
            <div className="md:col-span-4">
              <Button type="submit">Save Department Rule</Button>
            </div>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  {["Department", "Rule Set", "Login", "Logout", "Min Hrs", "Ideal Hrs", "Productive%", "Idle%", "Irrelevant mins"].map((head) => (
                    <th key={head} className="border-b px-3 py-2">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {departmentRuleSets.map((rule) => (
                  <tr key={rule.id} className="hover:bg-muted/40">
                    <td className="px-3 py-3">{rule.department}</td>
                    <td className="px-3 py-3">{rule.name}</td>
                    <td className="px-3 py-3">{toClock(rule.expectedLoginMinutes)}</td>
                    <td className="px-3 py-3">{toClock(rule.expectedLogoutMinutes)}</td>
                    <td className="px-3 py-3">{rule.minimumWorkingHours}</td>
                    <td className="px-3 py-3">{rule.idealWorkingHours}</td>
                    <td className="px-3 py-3">{rule.productivePctWarning} / {rule.productivePctGood}</td>
                    <td className="px-3 py-3">{rule.idlePctWarning} / {rule.idlePctCritical}</td>
                    <td className="px-3 py-3">{rule.irrelevantUsageWarningMinutes} / {rule.irrelevantUsageCriticalMinutes}</td>
                  </tr>
                ))}
                {!departmentRuleSets.length ? (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={9}>
                      No department-specific rules yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role-wise Relevant / Irrelevant Apps and Websites</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={saveRoleUsageRuleAction} className="grid gap-3 md:grid-cols-2">
            <Input name="role" placeholder="Role name (required)" required />
            <Input name="department" placeholder="Department (optional override)" />
            <Textarea name="relevantApps" placeholder="Relevant apps (comma/newline separated)" />
            <Textarea name="relevantWebsites" placeholder="Relevant websites (comma/newline separated)" />
            <Textarea name="irrelevantApps" placeholder="Irrelevant apps (comma/newline separated)" />
            <Textarea name="irrelevantWebsites" placeholder="Irrelevant websites (comma/newline separated)" />
            <div className="md:col-span-2">
              <Button type="submit">Save Role Usage Rule</Button>
            </div>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  {["Role", "Department", "Relevant Apps", "Relevant Websites", "Irrelevant Apps", "Irrelevant Websites"].map((head) => (
                    <th key={head} className="border-b px-3 py-2">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roleUsageRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-muted/40">
                    <td className="px-3 py-3">{rule.role}</td>
                    <td className="px-3 py-3">{rule.department ?? "All"}</td>
                    <td className="px-3 py-3">{toCsvList(rule.relevantApps)}</td>
                    <td className="px-3 py-3">{toCsvList(rule.relevantWebsites)}</td>
                    <td className="px-3 py-3">{toCsvList(rule.irrelevantApps)}</td>
                    <td className="px-3 py-3">{toCsvList(rule.irrelevantWebsites)}</td>
                  </tr>
                ))}
                {!roleUsageRules.length ? (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={6}>
                      No role usage rules yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Environment Status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {env.map(([name, configured]) => (
            <div key={String(name)} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>{name}</span>
              <span className={configured ? "text-emerald-300" : "text-amber-300"}>{configured ? "Configured" : "Missing"}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
