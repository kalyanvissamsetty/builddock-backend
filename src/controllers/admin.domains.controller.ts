import { Request, Response } from "express";
import prisma from "../lib/prisma";

function normalizeDomain(input: string) {
    let d = String(input || "").trim().toLowerCase();
    d = d.replace(/^@/, "");
    d = d.replace(/^https?:\/\//, "");
    d = d.split("/")[0];
    return d;
}

function isValidDomain(d: string) {
    if (!d) return false;
    if (d.includes(" ")) return false;
    if (!d.includes(".")) return false;
    if (d.startsWith(".") || d.endsWith(".")) return false;
    return true;
}

export async function listAllowedDomains(req: Request, res: Response) {
    const domains = await prisma.allowedEmailDomain.findMany({
        orderBy: { createdAt: "asc" },
    });
    res.json(domains);
}

export async function addAllowedDomain(req: Request, res: Response) {
    const domain = normalizeDomain(req.body?.domain);

    if (!isValidDomain(domain)) {
        return res.status(400).json({ message: "Invalid domain" });
    }

    const created = await prisma.allowedEmailDomain.create({
        data: { domain },
    });

    res.status(201).json(created);
}

export async function deleteAllowedDomain(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const deleteUsers = String(req.query.deleteUsers || "false") === "true";

    const domainRow = await prisma.allowedEmailDomain.findUnique({ where: { id } });
    if (!domainRow) return res.status(404).json({ message: "Domain not found" });

    const domain = domainRow.domain;

    await prisma.$transaction(async (tx) => {
        if (deleteUsers) {
            // Only non-admin users of this domain
            const users = await tx.user.findMany({
                where: {
                    email: { endsWith: `@${domain}` },
                    role: { not: "ADMIN" },
                },
                select: { id: true },
            });

            const userIds = users.map((u) => u.id);

            if (userIds.length > 0) {
                await tx.refreshToken.deleteMany({
                    where: { userId: { in: userIds } },
                });

                await tx.viewerBuildAccess.deleteMany({
                    where: { userId: { in: userIds } },
                });

                // If you have other per-user tables, delete them here

                await tx.user.deleteMany({
                    where: { id: { in: userIds } },
                });
            }

            // Remove invites for this domain (safe)
            await tx.userInvite.deleteMany({ where: { domain } });
        }

        // Delete the domain row itself
        await tx.allowedEmailDomain.delete({ where: { id } });
    });

    return res.status(204).send();
}

export async function domainDeleteSummary(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const domainRow = await prisma.allowedEmailDomain.findUnique({ where: { id } });
    if (!domainRow) return res.status(404).json({ message: "Domain not found" });

    const domain = domainRow.domain;
    const userCount = await prisma.user.count({
        where: { email: { endsWith: `@${domain}` }, role: { not: "ADMIN" } },
    });

    const inviteCount = await prisma.userInvite.count({
        where: { domain },
    });

    return res.json({ userCount, inviteCount });
}