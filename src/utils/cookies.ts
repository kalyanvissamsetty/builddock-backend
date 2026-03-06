import type { Request, Response } from "express";

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
    let domain = process.env.COOKIE_DOMAIN;

    const host = req.headers.host || "";
    if (host.includes("themosaiccompany")) domain = ".themosaiccompany.com";
    else domain = ".timsstudio.tech";

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