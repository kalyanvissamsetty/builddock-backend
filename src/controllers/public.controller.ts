import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { getBaseCDNURL } from "../utils/conditionalRules";
import { setCloudFrontCookiesAndRedirect } from "../services/signedcookies.service";

export const redirectToActiveVersion = async (req: Request, res: Response) => {
  const projectSlug = String(req.params.projectSlug);
  const envSlug = String(req.params.envSlug);
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
  
  return setCloudFrontCookiesAndRedirect(req, res, activeVersion.s3Path);
};

export async function openBuild(req: Request, res: Response) {
  const projectSlug = String(req.params.projectSlug);
  const envSlug = String(req.params.envSlug);
  const versionName = String(req.params.versionName);

  const s3Path = `${projectSlug}/${envSlug}/${versionName}`;

  return setCloudFrontCookiesAndRedirect(req, res, s3Path);
}