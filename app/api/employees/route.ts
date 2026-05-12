import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const employeeSchema = z.object({
  employeeId: z.string().min(2),
  fullName: z.string().min(2),
  email: z.string().email(),
  department: z.string().min(2),
  role: z.string().min(2),
  reportingManager: z.string().optional(),
  notionEmployeeReference: z.string().optional()
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = employeeSchema.parse(await request.json());
  const employee = await prisma.employee.create({ data: body });
  await prisma.auditLog.create({
    data: { actorId: session.user.id, action: "EMPLOYEE_CREATED", entity: "Employee", entityId: employee.id }
  });
  return NextResponse.json(employee);
}
