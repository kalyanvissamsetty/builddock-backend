import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { Role } from "../generated/prisma/enums";

export async function requireBuildAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const projectSlug = String(req.params.projectSlug);
  const envSlug = String(req.params.envSlug);
  const versionName = String(req.params.versionName);
  const userId = req.user!.id;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Admin, Manager, Developer bypass
  if (user.role === Role.ADMIN || user.role === Role.DEV || user.role == Role.MANAGER) {
    return next();
  }

  // Find project
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
  });

  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  // Find environment
  const environment = await prisma.environment.findFirst({
    where: {
      slug: envSlug,
      projectId: project.id,
    },
  });

  if (!environment) {
    return res.status(404).json({ message: "Environment not found" });
  }

  // Find version
  const version = await prisma.version.findFirst({
    where: {
      name: versionName,
      environmentId: environment.id,
    },
  });

  if (!version) {
    return res.status(404).json({ message: "Version not found" });
  }

  // Viewer access check
  const access = await prisma.viewerBuildAccess.findUnique({
    where: {
      userId_versionId: {
        userId: user.id,
        versionId: version.id,
      },
    },
  });

  if (!access) {
    return res.status(403).json({ message: "Access denied" });
  }

  // Attach version to request so controller doesn't refetch
  (req as any).resolvedVersion = version;

  next();
}
