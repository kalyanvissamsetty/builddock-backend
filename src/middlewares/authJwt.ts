import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";

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

export function requireRole(roles: string[]) {
    return (req: AuthedRequest, res: Response, next: NextFunction) => {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });
        if (!roles.includes(req.user.role)) return res.status(404).json({ message: "User role not found" });
        next();
    };
}