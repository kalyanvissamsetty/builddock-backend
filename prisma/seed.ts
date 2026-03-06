import { Role } from "../src/generated/prisma/client";
import prisma from "../src/lib/prisma";
import { hashPassword } from "../src/utils/password";


async function main() {
  const adminEmail = "admin@tims.group";
  const adminPassword = "Admin@123"; // change after first login

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log("Admin user already exists");
    return;
  }

  const passwordHash = await hashPassword(adminPassword);

  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      role: Role.ADMIN,
      isEmailVerified: true,
    },
  });

  console.log("Admin user created");
}
async function seedEmailDomains() {
  const domains = [
    "gmail.com",
    // Add more domains here later
    // "example.com",
  ];

  for (const domain of domains) {
    await prisma.allowedEmailDomain.upsert({
      where: { domain },
      update: {},
      create: { domain },
    });
  }

  console.log("Allowed email domains seeded successfully");
}
export async function seed() {
  console.log("Running destructive seed for BuildDock");

  // Safety check
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed is blocked in production environment");
  }

  // Delete assignments first to avoid foreign key issues
  const assignments = await prisma.viewerBuildAccess.deleteMany();
  console.log("Deleted assignments:", assignments.count);

  // Delete versions
  const versions = await prisma.version.deleteMany();
  console.log("Deleted versions:", versions.count);

  // Delete environments
  const environments = await prisma.environment.deleteMany();
  console.log("Deleted environments:", environments.count);

  // Delete projects
  const projects = await prisma.project.deleteMany();
  console.log("Deleted projects:", projects.count);

  // Delete only viewer users
  const viewers = await prisma.user.deleteMany({
    where: {
      role: "VIEWER"
    }
  });
  console.log("Deleted viewer users:", viewers.count);

  console.log("Database cleanup completed");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
