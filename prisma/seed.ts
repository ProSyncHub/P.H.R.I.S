import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedAdminEmail, seedAdminPassword } from "../lib/env";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(seedAdminPassword, 12);

  await prisma.user.upsert({
    where: { email: seedAdminEmail },
    update: {},
    create: {
      name: "P.H.R.I.S Admin",
      email: seedAdminEmail,
      passwordHash,
      role: "ADMIN"
    }
  });

  await prisma.employee.upsert({
    where: { employeeId: "EMP-001" },
    update: {},
    create: {
      employeeId: "EMP-001",
      fullName: "Sample Employee",
      email: "employee@prosync.local",
      department: "Operations",
      role: "Executive",
      reportingManager: "Admin"
    }
  });

  const globalRule = await prisma.performanceRuleSet.findFirst({
    where: { scope: "GLOBAL", isActive: true },
    orderBy: { updatedAt: "desc" }
  });

  if (!globalRule) {
    await prisma.performanceRuleSet.create({
      data: {
        name: "Default Global HR Rules",
        scope: "GLOBAL",
        isActive: true,
        workingDays: [1, 2, 3, 4, 5, 6],
        expectedLoginMinutes: 10 * 60,
        expectedLogoutMinutes: 18 * 60 + 30,
        gracePeriodMinutes: 5,
        minimumWorkingHours: 8,
        idealWorkingHours: 8.5,
        shortDayThresholdHours: 7.5,
        criticalShortDayThresholdHours: 6.5,
        productivePctGood: 70,
        productivePctWarning: 55,
        idlePctWarning: 20,
        idlePctCritical: 30,
        irrelevantUsageWarningMinutes: 45,
        irrelevantUsageCriticalMinutes: 90,
        eodScoreClear: 15,
        eodScoreAverage: 10,
        eodScoreVague: 6,
        eodScoreWeak: 3,
        timechampEodMatchGoodPct: 75,
        timechampEodMatchWarningPct: 50,
        riskGreenMin: 80,
        riskYellowMin: 55
      }
    });
  }

  const defaultRoleRule = await prisma.roleUsageRule.findFirst({
    where: { role: "Executive", department: null },
    orderBy: { updatedAt: "desc" }
  });

  if (!defaultRoleRule) {
    await prisma.roleUsageRule.create({
      data: {
        role: "Executive",
        department: null,
        isActive: true,
        relevantApps: ["vscode", "notion", "figma", "excel", "sheets", "gmail"],
        relevantWebsites: ["github.com", "notion.so", "figma.com", "docs.google.com"],
        irrelevantApps: ["youtube", "instagram", "facebook", "netflix"],
        irrelevantWebsites: ["youtube.com", "instagram.com", "facebook.com", "netflix.com"]
      }
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
