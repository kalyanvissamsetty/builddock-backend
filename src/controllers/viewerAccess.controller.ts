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


type BulkStatus =
  | "ASSIGNED"
  | "ALREADY_ASSIGNED"
  | "USER_NOT_FOUND"
  | "NOT_VIEWER"
  | "INVALID_USER_ID";

export async function bulkAssignViewerAccess(req: Request, res: Response) {
  const versionId = Number(req.body?.versionId);
  const userIdsRaw = req.body?.userIds;

  if (!versionId || Number.isNaN(versionId)) {
    return res.status(400).json({ message: "Invalid versionId" });
  }

  if (!Array.isArray(userIdsRaw)) {
    return res.status(400).json({ message: "userIds must be an array" });
  }

  const requestedUserIds = userIdsRaw.map((x: any) => Number(x));
  if (requestedUserIds.length === 0) {
    return res.status(400).json({ message: "userIds cannot be empty" });
  }

  // Remove NaN + duplicates
  const cleanIds = Array.from(
    new Set(requestedUserIds.filter((n) => Number.isFinite(n) && n > 0)),
  );

  // Confirm version exists
  const version = await prisma.version.findUnique({ where: { id: versionId } });
  if (!version) {
    return res.status(404).json({ message: "Version not found" });
  }

  // Load users
  const users = await prisma.user.findMany({
    where: { id: { in: cleanIds } },
    select: { id: true, email: true, name: true, role: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  // Existing access rows
  const existing = await prisma.viewerBuildAccess.findMany({
    where: { versionId, userId: { in: cleanIds } },
    select: { userId: true },
  });
  const alreadySet = new Set(existing.map((e) => e.userId));

  // Build per-user result list in the order of request
  const results: Array<{
    userId: number;
    email: string | null;
    name: string | null;
    status: BulkStatus;
  }> = [];

  const toCreate: Array<{ userId: number; versionId: number }> = [];

  for (const raw of requestedUserIds) {
    const uid = Number(raw);

    if (!Number.isFinite(uid) || uid <= 0) {
      results.push({ userId: uid, email: null, name: null, status: "INVALID_USER_ID" });
      continue;
    }

    const u = userMap.get(uid);
    if (!u) {
      results.push({ userId: uid, email: null, name: null, status: "USER_NOT_FOUND" });
      continue;
    }

    if (u.role !== "VIEWER") {
      results.push({ userId: uid, email: u.email, name: u.name ?? null, status: "NOT_VIEWER" });
      continue;
    }

    if (alreadySet.has(uid)) {
      results.push({ userId: uid, email: u.email, name: u.name ?? null, status: "ALREADY_ASSIGNED" });
      continue;
    }

    // eligible
    results.push({ userId: uid, email: u.email, name: u.name ?? null, status: "ASSIGNED" });
    toCreate.push({ userId: uid, versionId });
    alreadySet.add(uid);
  }

  // Insert new access rows
  if (toCreate.length > 0) {
    await prisma.viewerBuildAccess.createMany({
      data: toCreate,
      skipDuplicates: true, // safety
    });
  }

  const summary = {
    requested: requestedUserIds.length,
    assigned: results.filter((r) => r.status === "ASSIGNED").length,
    alreadyAssigned: results.filter((r) => r.status === "ALREADY_ASSIGNED").length,
    invalidUsers: results.filter((r) => r.status === "USER_NOT_FOUND" || r.status === "INVALID_USER_ID").length,
    notViewer: results.filter((r) => r.status === "NOT_VIEWER").length,
  };

  return res.json({ summary, results });
}