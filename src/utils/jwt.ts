import jwt, { SignOptions } from "jsonwebtoken";

export type JwtPayload = {
    sub: string;       // userId
    role: string;
};

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL ?? "15m";
const REFRESH_TTL = process.env.REFRESH_TOKEN_TTL ?? "30d";

export function signAccessToken(userId: number, role: string) {
    const payload: JwtPayload = { sub: String(userId), role };
    return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL as SignOptions['expiresIn'] });
}

export function signRefreshToken(userId: number, role: string) {
    const payload: JwtPayload = { sub: String(userId), role };
    return jwt.sign(payload, REFRESH_SECRET, {
        expiresIn: REFRESH_TTL as SignOptions['expiresIn'],
    });
}

export function verifyAccessToken(token: string) {
    return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string) {
    return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
}