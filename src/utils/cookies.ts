import type { Response } from "express";

function cookieOptions() {
    const isProd = process.env.NODE_ENV === "production";

    const sameSite = (process.env.COOKIE_SAMESITE ?? "lax") as "lax" | "strict" | "none";
    const domain = process.env.COOKIE_DOMAIN || undefined;

    return {
        httpOnly: true,
        secure : isProd,
        sameSite,
        domain,
        path: "/",
    } as const;
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const opts = cookieOptions();
    res.cookie("timsstudio_access", accessToken, { ...opts, maxAge: 15 * 60 * 1000 });
    res.cookie("timsstudio_refresh", refreshToken, { ...opts, maxAge: 30 * 24 * 60 * 60 * 1000 });
}

export function clearAuthCookies(res: Response) {
    const opts = cookieOptions();
    res.clearCookie("timsstudio_access", opts);
    res.clearCookie("timsstudio_refresh", opts);
}