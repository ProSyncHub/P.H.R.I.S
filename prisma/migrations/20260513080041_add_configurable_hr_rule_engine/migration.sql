-- CreateEnum
CREATE TYPE "RuleScope" AS ENUM ('GLOBAL', 'DEPARTMENT');

-- CreateTable
CREATE TABLE "PerformanceRuleSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "RuleScope" NOT NULL DEFAULT 'GLOBAL',
    "department" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "workingDays" JSONB NOT NULL,
    "expectedLoginMinutes" INTEGER NOT NULL,
    "expectedLogoutMinutes" INTEGER NOT NULL,
    "gracePeriodMinutes" INTEGER NOT NULL,
    "minimumWorkingHours" DOUBLE PRECISION NOT NULL,
    "idealWorkingHours" DOUBLE PRECISION NOT NULL,
    "shortDayThresholdHours" DOUBLE PRECISION NOT NULL,
    "criticalShortDayThresholdHours" DOUBLE PRECISION NOT NULL,
    "productivePctGood" DOUBLE PRECISION NOT NULL,
    "productivePctWarning" DOUBLE PRECISION NOT NULL,
    "idlePctWarning" DOUBLE PRECISION NOT NULL,
    "idlePctCritical" DOUBLE PRECISION NOT NULL,
    "irrelevantUsageWarningMinutes" INTEGER NOT NULL,
    "irrelevantUsageCriticalMinutes" INTEGER NOT NULL,
    "eodScoreClear" INTEGER NOT NULL,
    "eodScoreAverage" INTEGER NOT NULL,
    "eodScoreVague" INTEGER NOT NULL,
    "eodScoreWeak" INTEGER NOT NULL,
    "timechampEodMatchGoodPct" DOUBLE PRECISION NOT NULL,
    "timechampEodMatchWarningPct" DOUBLE PRECISION NOT NULL,
    "riskGreenMin" INTEGER NOT NULL,
    "riskYellowMin" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleUsageRule" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "department" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "relevantApps" JSONB NOT NULL,
    "relevantWebsites" JSONB NOT NULL,
    "irrelevantApps" JSONB NOT NULL,
    "irrelevantWebsites" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleUsageRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerformanceRuleSet_scope_department_idx" ON "PerformanceRuleSet"("scope", "department");

-- CreateIndex
CREATE INDEX "PerformanceRuleSet_isActive_idx" ON "PerformanceRuleSet"("isActive");

-- CreateIndex
CREATE INDEX "RoleUsageRule_role_department_idx" ON "RoleUsageRule"("role", "department");

-- CreateIndex
CREATE INDEX "RoleUsageRule_isActive_idx" ON "RoleUsageRule"("isActive");
