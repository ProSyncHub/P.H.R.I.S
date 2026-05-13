import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function createEmployee(formData: FormData) {
  "use server";
  await prisma.employee.create({
    data: {
      employeeId: String(formData.get("employeeId")),
      fullName: String(formData.get("fullName")),
      email: String(formData.get("email")),
      department: String(formData.get("department")),
      role: String(formData.get("role")),
      reportingManager: String(formData.get("reportingManager") || ""),
      notionEmployeeReference: String(formData.get("notionEmployeeReference") || "")
    }
  });
}

export default async function EmployeesPage() {
  const employees = await prisma.employee.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Employee Master</h1>
        <p className="text-sm text-muted-foreground">Role-ready employee archive with Notion references.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Add Employee</CardTitle></CardHeader>
        <CardContent>
          <form action={createEmployee} className="grid gap-3 md:grid-cols-4">
            <Input name="employeeId" placeholder="Employee ID" required />
            <Input name="fullName" placeholder="Full name" required />
            <Input name="email" type="email" placeholder="Email" required />
            <Input name="department" placeholder="Department" required />
            <Input name="role" placeholder="Role" required />
            <Input name="reportingManager" placeholder="Reporting manager" />
            <Input name="notionEmployeeReference" placeholder="Notion employee page ID" />
            <Button>Add Employee</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Employees</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>{["ID", "Name", "Email", "Department", "Role", "Manager", "Status"].map((h) => <th key={h} className="border-b px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="hover:bg-muted/40">
                  <td className="px-3 py-3">{employee.employeeId}</td>
                  <td className="px-3 py-3">{employee.fullName}</td>
                  <td className="px-3 py-3">{employee.email}</td>
                  <td className="px-3 py-3">{employee.department}</td>
                  <td className="px-3 py-3">{employee.role}</td>
                  <td className="px-3 py-3">{employee.reportingManager ?? "-"}</td>
                  <td className="px-3 py-3">{employee.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
