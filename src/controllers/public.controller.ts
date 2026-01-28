import { Request, Response } from "express";
import prisma from "../lib/prisma";

export const redirectToActiveVersion = async (req: Request, res: Response) => {
  const projectSlug = String(req.params.projectSlug);
    const envSlug = String(req.params.envSlug)
  // 1. Find project
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
  });

  if (!project) {
    return res.status(404).send("Project not found");
  }

  // 2. Find environment
  const environment = await prisma.environment.findFirst({
    where: {
      slug: envSlug,
      projectId: project.id,
    },
  });

  if (!environment) {
    return res.status(404).send("Environment not found");
  }

  // 3. Find active version
  const activeVersion = await prisma.version.findFirst({
    where: {
      environmentId: environment.id,
      isActive: true,
    },
  });

  if (!activeVersion) {
    return res.status(404).send("No active version");
  }

  // 4. Build static URL
  const staticBaseUrl = process.env.STATIC_BASE_URL;

  const redirectUrl = `${staticBaseUrl}${activeVersion.s3Path}/index.html`;
  console.log("redirect - "+ redirectUrl)
  // 5. Redirect
  return res.redirect(302, redirectUrl);
};
