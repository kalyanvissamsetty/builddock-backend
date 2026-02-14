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
seedEmailDomains()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });