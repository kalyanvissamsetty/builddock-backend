import prisma from "../lib/prisma";

export async function isEmailDomainAllowed(email: string) {
  const domain = email.split("@")[1];
  if (!domain) return false;

  const allowed = await prisma.allowedEmailDomain.findUnique({
    where: { domain },
  });

  return Boolean(allowed);
}
