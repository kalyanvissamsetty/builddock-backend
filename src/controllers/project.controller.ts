import { error } from "node:console"
import { logger } from "../utils/logger";
import prisma from "../lib/prisma"
import { Request,Response } from "express"
import { Prisma } from "../generated/prisma/client";
import { deleteS3Prefix, S3PrefixDeleteError } from "../services/s3Upload.service";

export const getProjects = async(req:Request, res:Response)=>{
    const projects = await prisma.project.findMany({
        orderBy:{createdAt : "desc"}
    })
    res.json(projects)
}

export const createProject = async (req: Request, res: Response) => {
    try {
        const { name, slug } = req.body;

        if (!name || !slug) {
            return res.status(400).json({ message: "name or slug is missing" });
        }

        // Check if either name OR slug already exists
        const existing = await prisma.project.findFirst({
            where: {
                OR: [{ name }, { slug }],
            },
            select: { id: true, name: true, slug: true },
        });

        if (existing) {
            // Tell exactly what conflicts
            const conflicts: string[] = [];
            if (existing.name === name) conflicts.push("name");
            if (existing.slug === slug) conflicts.push("slug");

            return res.status(409).json({
                message: `Project ${conflicts.join(" and ")} already exists`,
                conflicts,
            });
        }

        const project = await prisma.project.create({
            data: { name, slug },
        });

        logger.info(`Project created: ${project.name} (${project.slug})`);
        return res.status(201).json(project);
    } catch (err) {
        // Optional: if you also have unique constraints in DB, handle Prisma unique error
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            return res.status(409).json({
                message: "Project with same unique field already exists",
                meta: err.meta,
            });
        }

        logger.error("Failed to create project");
        return res.status(500).json({ message: "Internal server error" });
    }
};

// GET /projects/:id/summary
export async function projectDeleteSummary(req: Request, res: Response) {
    const projectId = Number(req.params.id);
    if (!projectId) return res.status(400).json({ message: "Invalid Project Id" });

    const environments = await prisma.environment.count({
        where: { projectId },
    });

    const versions = await prisma.version.count({
        where: { environment: { projectId } },
    });

    res.json({ environments, versions });
}

// DELETE /projects/:id
export async function deleteProject(req: Request, res: Response) {
    const projectId = Number(req.params.id);
    if (!projectId) return res.status(400).json({ message: "Invalid project id" });

    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) return res.status(500).json({ message: "AWS_S3_BUCKET is not configured" });

    try {
        // 1) Gather versions so we know what to delete
        const versions = await prisma.version.findMany({
            where: { environment: { projectId } },
            select: { id: true, s3Path: true },
        });

        const versionIds = versions.map((v) => v.id);

        // 2) Delete S3 first, prefix-by-prefix
        for (const v of versions) {
            if (!v.s3Path) continue;
            await deleteS3Prefix(v.s3Path);
        }

        // 3) DB delete
        await prisma.$transaction(async (tx) => {
            if (versionIds.length > 0) {
                await tx.viewerBuildAccess.deleteMany({
                    where: { versionId: { in: versionIds } },
                });
            }

            await tx.version.deleteMany({
                where: { environment: { projectId } },
            });

            await tx.environment.deleteMany({
                where: { projectId },
            });

            await tx.project.delete({
                where: { id: projectId },
            });
        });

        return res.status(204).send();
    } catch (err: any) {
        logger.error("Delete project failed", {
            projectId,
            message: err?.message,
        });

        if (err instanceof S3PrefixDeleteError) {
            return res.status(403).json({
                message: "S3 delete failed",
                prefix: err.prefix,
                details: err.details,
            });
        }

        return res.status(500).json({ message: "Failed to delete project" });
    }
}