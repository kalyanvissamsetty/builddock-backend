import { Request, Response } from "express";
import prisma from "../lib/prisma";

export async function listMyBuilds(req: Request, res: Response) {
  const userId = req.user!.id;

  const builds = await prisma.viewerBuildAccess.findMany({
    where: { userId },
    include: {
      version: {
        include: {
          lastUploadedByUser: {
            select: { id: true, name: true, email: true },
          },
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


export async function getReleaseNotes(req: Request, res: Response) {
  const versionId = Number(req.params.versionId);
  if (!versionId) return res.status(400).json({ message: "Invalid versionId" });

  const userId = (req as any).user.id; // from JWT middleware

  const access = await prisma.viewerBuildAccess.findFirst({
    where: { userId, versionId },
  });

  if (!access) return res.status(403).json({ message: "Forbidden" });

  const version = await prisma.version.findUnique({
    where: { id: versionId },
    select: { id: true, releaseNotes: true, releaseNotesUpdatedAt: true },
  });

  return res.json(version);
}