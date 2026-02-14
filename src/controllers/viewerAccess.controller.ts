import { Request, Response } from "express";
import prisma from "../lib/prisma";

// POST /api/admin/viewer-access
export async function assignViewerBuild(req: Request, res: Response) {
  const { userId, versionId } = req.body;
  console.log(req.body)
  if (!userId || !versionId) {
    return res.status(400).json({ message: "userId and versionId required" });
  }

  const access = await prisma.viewerBuildAccess.create({
    data: {
      userId,
      versionId,
    },
  });

  res.json(access);
}

// DELETE /api/admin/viewer-access
export async function removeViewerBuild(req: Request, res: Response) {
  const { userId, versionId } = req.body;

  if (!userId || !versionId) {
    return res.status(400).json({ message: "userId and versionId required" });
  }

  await prisma.viewerBuildAccess.delete({
    where: {
      userId_versionId: { userId, versionId },
    },
  });
                       
  res.json({ ok: true });
}

// GET /api/admin/viewer-access/:userId
export async function listViewerBuilds(req: Request, res: Response) {
  const userId = Number(req.params.userId);

  const builds = await prisma.viewerBuildAccess.findMany({
    where: { userId },
    include: {
      version: {
        include: {
          environment: {
            include: {
              project: true,
            },
          },
        },
      },
    },
  });

  res.json(builds);
}