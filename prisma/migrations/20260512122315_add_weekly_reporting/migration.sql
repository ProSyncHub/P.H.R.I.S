-- CreateEnum
CREATE TYPE "WeeklyScope" AS ENUM ('EMPLOYEE', 'DEPARTMENT');

-- CreateTable
CREATE TABLE "WeeklyAnalysis" (
    "id" TEXT NOT NULL,
    "scope" "WeeklyScope" NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT,
    "department" TEXT,
    "dailyCount" INTEGER NOT NULL DEFAULT 0,
    "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productiveHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unproductiveTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "idleTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lowestScore" INTEGER NOT NULL DEFAULT 0,
    "highestScore" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "summaryJson" JSONB NOT NULL,
    "flagsJson" JSONB NOT NULL,
    "managerSummary" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "notionSyncStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "notionPageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyAnalysisSource" (
    "id" TEXT NOT NULL,
    "weeklyAnalysisId" TEXT NOT NULL,
    "dailyAnalysisId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyAnalysisSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyNotionSyncLog" (
    "id" TEXT NOT NULL,
    "weeklyAnalysisId" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "message" TEXT NOT NULL,
    "notionPageId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyNotionSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyAnalysis_weekStart_weekEnd_idx" ON "WeeklyAnalysis"("weekStart", "weekEnd");

-- CreateIndex
CREATE INDEX "WeeklyAnalysis_scope_idx" ON "WeeklyAnalysis"("scope");

-- CreateIndex
CREATE INDEX "WeeklyAnalysis_employeeId_idx" ON "WeeklyAnalysis"("employeeId");

-- CreateIndex
CREATE INDEX "WeeklyAnalysis_department_idx" ON "WeeklyAnalysis"("department");

-- CreateIndex
CREATE INDEX "WeeklyAnalysisSource_dailyAnalysisId_idx" ON "WeeklyAnalysisSource"("dailyAnalysisId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyAnalysisSource_weeklyAnalysisId_dailyAnalysisId_key" ON "WeeklyAnalysisSource"("weeklyAnalysisId", "dailyAnalysisId");

-- AddForeignKey
ALTER TABLE "WeeklyAnalysis" ADD CONSTRAINT "WeeklyAnalysis_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAnalysisSource" ADD CONSTRAINT "WeeklyAnalysisSource_weeklyAnalysisId_fkey" FOREIGN KEY ("weeklyAnalysisId") REFERENCES "WeeklyAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAnalysisSource" ADD CONSTRAINT "WeeklyAnalysisSource_dailyAnalysisId_fkey" FOREIGN KEY ("dailyAnalysisId") REFERENCES "DailyAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyNotionSyncLog" ADD CONSTRAINT "WeeklyNotionSyncLog_weeklyAnalysisId_fkey" FOREIGN KEY ("weeklyAnalysisId") REFERENCES "WeeklyAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
