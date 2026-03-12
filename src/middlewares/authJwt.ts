import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";
import prisma from "../lib/prisma";

export type AuthedRequest = Request & {
    user?: { id: number; role: string };
};

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    const token = req.cookies?.timsstudio_access;
    if (!token) return res.status(401).json({ message: "Unauthorized, Invalid Token" });

    try {
        const payload = verifyAccessToken(token);
        req.user = { id: Number(payload.sub), role: payload.role };
        next();
    } catch {
        return res.status(401).json({ message: "Unauthorized, Token verification failed" });
    }
}

// export function requireRole(roles: string[]) {
//     return (req: AuthedRequest, res: Response, next: NextFunction) => {
//         if (!req.user) return res.status(401).json({ message: "Unauthorized" });
//         if (!roles.includes(req.user.role)) return res.status(403).json({ message: "User role not found" });
//         next();
//     };
// }

export function requireRole(roles: string[]) {
    return async (req: AuthedRequest, res: Response, next: NextFunction) => {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const userId = req.user.id; // adjust field name if yours differs

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });

        if (!user) return res.status(401).json({ message: "Unauthorized" });

        if (!roles.includes(user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        // keep req.user.role in sync for downstream handlers if they use it
        req.user.role = user.role;

        next();
    };
}