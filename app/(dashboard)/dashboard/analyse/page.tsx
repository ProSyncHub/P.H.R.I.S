import { prisma } from "@/lib/prisma";
import { AnalyseForm } from "./analyse-form";

export const dynamic = "force-dynamic";

export default async function AnalysePage() {
  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, employeeId: true, department: true }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analyse Report</h1>
        <p className="text-sm text-muted-foreground">Upload Time Champ reports, paste EOD, and generate a structured HR intelligence report.</p>
      </div>
      <AnalyseForm employees={employees} />
    </div>
  );
}
