import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { Prisma } from "../generated/prisma/client";
import { logger } from "../utils/logger";
import { deleteS3Prefix, S3PrefixDeleteError } from "../services/s3Upload.service";

export const getEnvironments = async(req:Request, res:Response)=>{
    const projectId = Number(req.params.projectId)

    if(isNaN(projectId)) return res.status(400).json({"message": "Invalid project ID"})

    const environments = await prisma.environment.findMany({
        where: {projectId},
        orderBy: {createdAt: "asc"}
    })
    res.json(environments)
}

export const createEnvironment = async (req: Request, res: Response) => {
    try {
        const projectId = Number(req.params.projectId);

        if (Number.isNaN(projectId)) {
            return res.status(400).json({ message: "Invalid project ID" });
        }

        const { name, slug } = req.body;

        if (!name || !slug) {
            return res.status(400).json({ message: "Name or slug is missing!" });
        }

        // Check if name OR slug already exists in this project
        const existing = await prisma.environment.findFirst({
            where: {
                projectId,
                OR: [{ name }, { slug }],
            },
            select: { id: true, name: true, slug: true },
        });

        if (existing) {
            const conflicts: string[] = [];
            if (existing.name === name) conflicts.push("name");
            if (existing.slug === slug) conflicts.push("slug");

            return res.status(409).json({
                message: `Environment ${conflicts.join(" and ")} already exists in this project`,
                conflicts,
            });
        }

        const environment = await prisma.environment.create({
            data: {
                name,
                slug,
                projectId,
            },
        });

        return res.status(201).json(environment);
    } catch (err) {
        // If you add unique constraints like @@unique([projectId, slug]) / @@unique([projectId, name])
        if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002"
        ) {
            return res.status(409).json({
                message: "Environment with same unique field already exists in this project",
                meta: err.meta,
            });
        }

        logger.error("Failed to create environment");
        return res.status(500).json({ message: "Internal server error" });
    }
};

// GET /environments/:envId/summary
export async function environmentDeleteSummary(req: Request, res: Response) {
    const envId = Number(req.params.envId);
    if (!envId) return res.status(400).json({ message: "Invalid environment id" });

    const versions = await prisma.version.count({
        where: { environmentId: envId },
    });

    res.json({ versions });
}

// DELETE /environments/:envId
export async function deleteEnvironment(req: Request, res: Response) {
    const envId = Number(req.params.envId);
    if (!envId) return res.status(400).json({ message: "Invalid environment id" });

    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) return res.status(500).json({ message: "AWS_S3_BUCKET is not configured" });

    try {
        const versions = await prisma.version.findMany({
            where: { environmentId: envId },
            select: { id: true, s3Path: true },
        });

        const versionIds = versions.map((v) => v.id);

        for (const v of versions) {
            if (!v.s3Path) continue;
            await deleteS3Prefix(v.s3Path);
        }

        await prisma.$transaction(async (tx) => {
            if (versionIds.length > 0) {
                await tx.viewerBuildAccess.deleteMany({
                    where: { versionId: { in: versionIds } },
                });
            }

            await tx.version.deleteMany({
                where: { environmentId: envId },
            });

            await tx.environment.delete({
                where: { id: envId },
            });
        });

        return res.status(204).send();
    } catch (err: any) {
        logger.error("Delete environment failed", {
            envId,
            message: err?.message,
        });

        if (err instanceof S3PrefixDeleteError) {
            return res.status(403).json({
                message: "S3 delete failed",
                prefix: err.prefix,
                details: err.details,
            });
        }

        return res.status(500).json({ message: "Failed to delete environment" });
    }
}