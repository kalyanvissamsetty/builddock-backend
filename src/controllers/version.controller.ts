import { Request,Response } from "express";
import prisma from "../lib/prisma";
import { invalidateCloudFront } from "../services/cloudfront.service";
import { logger } from "../utils/logger";
import { Prisma } from "../generated/prisma/client";
export const createVersion = async (req: Request, res: Response) => {
  try {
    const environmentId = Number(req.params.environmentId);

    if (Number.isNaN(environmentId)) {
      return res.status(400).json({ message: "Environment ID is invalid" });
    }

    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Version name is required" });
    }

    // Check if version name already exists in this environment
    const existing = await prisma.version.findFirst({
      where: {
        environmentId,
        name,
      },
      select: { id: true, name: true, environmentId: true },
    });

    if (existing) {
      return res.status(409).json({
        message: "Version name already exists in this environment",
        conflicts: ["name"],
      });
    }

    const version = await prisma.version.create({
      data: {
        name,
        environmentId,
        s3Path: "",
      },
    });

    return res.status(201).json(version);
  } catch (err) {
    // If you have a unique constraint like @@unique([environmentId, name])
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return res.status(409).json({
        message: "Version name already exists in this environment",
        meta: err.meta,
      });
    }

    logger.error("Failed to create version");
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getVersions = async (req:Request, res:Response)=>{
    const environmentId = Number(req.params.environmentId)

    if(isNaN(environmentId)) return res.status(400).json({"message": "Environment ID are Invalid"})

    const versions = await prisma.version.findMany({
        where: {environmentId},
        orderBy:{createdAt:"desc"}
    })

    res.json(versions)
}

export const activateVersion = async (req: Request, res: Response) => {
  const versionId = Number(req.params.versionId);

  if (Number.isNaN(versionId)) {
    return res.status(400).json({ message: "Invalid versionId" });
  }

  //  Fetch version
  const version = await prisma.version.findUnique({
    where: { id: versionId },
  });

  if (!version) {
    return res.status(404).json({ message: "Version not found" });
  }

  // Already active → early return (IMPORTANT)
  if (version.isActive) {
    return res.status(200).json({
      message: "Version is already active",
    });
  }

  //  Activate inside transaction
  await prisma.$transaction([
    prisma.version.updateMany({
      where: {
        environmentId: version.environmentId,
        isActive: true,
      },
      data: { isActive: false },
    }),
    prisma.version.update({
      where: { id: versionId },
      data: { isActive: true },
    }),
  ]);

  // Fetch env & project (needed for invalidation)
  const env = await prisma.environment.findUnique({
    where: { id: version.environmentId },
  });

  if (!env) {
    // Extremely rare, but safe guard
    return res.status(500).json({ message: "Environment not found" });
  }

  const project = await prisma.project.findUnique({
    where: { id: env.projectId },
  });

  if (!project) {
    return res.status(500).json({ message: "Project not found" });
  }
  if (!project?.slug || !env?.slug) {
    console.error("Invalid CloudFront invalidation path", {
      projectSlug: project?.slug,
      envSlug: env?.slug,
    });

    return res.status(200).json({
      message: "Version activated successfully (cache invalidation skipped)",
    });
  }
  console.log(`/${project.slug}/${env.slug}/*`)
  //  Invalidate CloudFront only when change happened
  await invalidateCloudFront([`/${project.slug}/${env.slug}/*`]);

  return res.status(200).json({
    message: "Version activated successfully",
  });
};
