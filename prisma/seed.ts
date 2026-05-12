import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin@12345", 12);

  await prisma.user.upsert({
    where: { email: "admin@prosync.local" },
    update: {},
    create: {
      name: "P.H.R.I.S Admin",
      email: "admin@prosync.local",
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
