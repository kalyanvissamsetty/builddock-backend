import type { Request, Response } from "express";
import { getBaseOriginDomain } from "./conditionalRules";

function cookieOptions(req: Request) {
    const isProd = process.env.NODE_ENV === "production";

    // Default: host-only cookie (no domain) is safest in dev
    const base: any = {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax" as const,
        path: "/",
    };

    if (!isProd) {
        return base;
    }

    // Production domain handling
    let domain = getBaseOriginDomain(req.headers.origin || req.headers.host);

    return {
        ...base,
        domain,
    } as const;
}

export function setAuthCookies(
    req: Request,
    res: Response,
    accessToken: string,
    refreshToken: string,
) {
    const opts = cookieOptions(req);

    res.cookie("timsstudio_access", accessToken, {
        ...opts,
        maxAge: 15 * 60 * 1000,
    });

    res.cookie("timsstudio_refresh", refreshToken, {
        ...opts,
        maxAge: 30 * 24 * 60 * 60 * 1000,
    });
}

export function clearAuthCookies(req: Request, res: Response) {
    const opts = cookieOptions(req);

    // Clear using same options used when setting
    res.clearCookie("timsstudio_access", opts);
    res.clearCookie("timsstudio_refresh", opts);

    // Extra fallback: clear without domain too (handles older cookies set differently)
    res.clearCookie("timsstudio_access", { path: "/" });
    res.clearCookie("timsstudio_refresh", { path: "/" });
}

function cloudFrontCookieOptions(req: Request) {
    const domain = getBaseOriginDomain(req.headers.origin || req.headers.host);
    const opts: any = {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
    };
    if (domain) opts.domain = domain;
    return opts;
}

export function clearCloudFrontCookies(req: Request, res: Response) {
    const opts = cloudFrontCookieOptions(req);
    res.clearCookie("CloudFront-Policy", opts);
    res.clearCookie("CloudFront-Signature", opts);
    res.clearCookie("CloudFront-Key-Pair-Id", opts);

    // fallback (domain mismatch safety)
    res.clearCookie("CloudFront-Policy", { path: "/" });
    res.clearCookie("CloudFront-Signature", { path: "/" });
    res.clearCookie("CloudFront-Key-Pair-Id", { path: "/" });
}