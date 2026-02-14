import { Request, Response } from "express";
import prisma from "../lib/prisma";

export async function listMyBuilds(req: Request, res: Response) {
  const userId = req.session.userId!;

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