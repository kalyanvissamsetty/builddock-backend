import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { Prisma } from "../generated/prisma/client";

// POST /api/admin/viewer-access
export async function assignViewerBuild(req: Request, res: Response) {
  const { userId, versionId } = req.body;

  if (!userId || !versionId) {
    return res.status(400).json({
      error: "BAD_REQUEST",
      message: "userId and versionId required",
    });
  }

  try {
    const access = await prisma.viewerBuildAccess.create({
      data: { userId, versionId },
    });

    return res.status(201).json({
      assigned: true,
      data: access,
    });

  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Already assigned
      if (error.code === "P2002") {
        const existing = await prisma.viewerBuildAccess.findUnique({
          where: {
            userId_versionId: { userId, versionId },
          },
        });

        return res.status(200).json({
          assigned: false,
          message: "Version already assigned to user",
          data: existing,
        });
      }
    }

    console.error("assignViewerBuild failed:", error);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to assign build",
    });
  }
}

// DELETE /api/admin/viewer-access
export async function removeViewerBuild(req: Request, res: Response) {
  const { userId, versionId } = req.body;

  if (!userId || !versionId) {
    return res.status(400).json({
      error: "BAD_REQUEST",
      message: "userId and versionId required",
    });
  }

  try {
    await prisma.viewerBuildAccess.delete({
      where: {
        userId_versionId: { userId, versionId },
      },
    });

    return res.json({
      removed: true,
    });

  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      // Already removed / never existed
      return res.status(200).json({
        removed: false,
        message: "Access already removed",
      });
    }

    console.error("removeViewerBuild failed:", error);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to remove access",
    });
  }
}

// GET /api/admin/viewer-access/:userId
export async function listViewerBuilds(req: Request, res: Response) {
  const userId = Number(req.params.userId);

  if (Number.isNaN(userId)) {
    return res.status(400).json({
      error: "BAD_REQUEST",
      message: "Invalid userId",
    });
  }

  try {
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

    return res.json(builds);

  } catch (error) {
    console.error("listViewerBuilds failed:", error);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to fetch viewer builds",
    });
  }
}