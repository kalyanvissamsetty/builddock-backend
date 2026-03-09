import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { generateAndSendOtp } from "../services/otp.service"; // use your existing function
import { getAppName, getBaseFrontEndURL } from "../utils/conditionalRules";
import { Role } from "../generated/prisma/enums";

function normalizeEmail(email: string) {
    return String(email || "").trim().toLowerCase();
}

function getEmailDomain(email: string) {
    const parts = email.split("@");
    if (parts.length !== 2) return "";
    return parts[1];
}

// GET /api/admin/invites
export async function listInvites(req: Request, res: Response) {
    const invites = await prisma.userInvite.findMany({
        orderBy: { createdAt: "desc" },
    });

    // optional: mark expired as EXPIRED on read (lightweight)
    const now = new Date();
    const expiredIds = invites
        .filter((i) => i.status === "PENDING" && i.expiresAt < now)
        .map((i) => i.id);

    if (expiredIds.length > 0) {
        await prisma.userInvite.updateMany({
            where: { id: { in: expiredIds } },
            data: { status: "EXPIRED" },
        });
    }

    const updated = await prisma.userInvite.findMany({
        orderBy: { createdAt: "desc" },
    });

    res.json(updated);
}

// POST /api/admin/invites
// body: { email, name? }
const ALLOWED_INVITE_ROLES:Role[] = ["VIEWER", "DEV", "QA","MANAGER"] as const;

export async function createInvite(req: Request, res: Response) {
    const email = normalizeEmail(req.body?.email);
    const name = req.body?.name ? String(req.body.name).trim() : null;
    const role = String(req.body?.role || "VIEWER").toUpperCase();

    if (!email || !email.includes("@")) {
        return res.status(400).json({ message: "Valid email is required" });
    }

    if (!ALLOWED_INVITE_ROLES.includes(role as any)) {
        return res.status(400).json({ message: "Invalid role for invite" });
    }

    const domain = getEmailDomain(email);
    if (!domain) return res.status(400).json({ message: "Invalid email domain" });

    const allowed = await prisma.allowedEmailDomain.findUnique({
        where: { domain },
    });

    if (!allowed) {
        return res.status(403).json({ message: "Email domain not allowed" });
    }

    const existingPending = await prisma.userInvite.findFirst({
        where: { email, status: "PENDING", expiresAt: { gt: new Date() } },
    });

    if (existingPending) {
        return res.status(409).json({ message: "Invite already pending for this email" });
    }

    // Create or update user
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        user = await prisma.user.create({
            data: {
                email,
                name,
                role: role as any,
                isEmailVerified: true,
                passwordHash: null,
            },
        });
    } else {
        return res.status(409).json({
            message: "User already exists. Use Promote Users to change role or re-send OTP login.",
        });
    }

    //If invite already ACCEPTED -> block (extra safety)
    const acceptedInvite = await prisma.userInvite.findFirst({
        where: { email, status: "ACCEPTED" },
    });
    if (acceptedInvite) {
        return res.status(409).json({
            message: "User already onboarded. Invite is already accepted.",
        });
    }

    
    const invite = await prisma.userInvite.create({
        data: {
            email,
            name,
            domain,
            role: role as any,
            createdById: (req as any).user.id,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            status: "PENDING",
        },
    });

    // Send OTP now (invite email template should point to /login-otp?email=...)
    const appUrl = getBaseFrontEndURL(req.headers.origin);
    const loginOtpLink = `${appUrl}/verifyotp?email=${encodeURIComponent(email)}&reason=invite`;

    await generateAndSendOtp(user.id, user.email, {
        purpose: "INVITE",
        loginOtpLink,
        roleLabel: role, // VIEWER/DEV/QA
        appName: getAppName(req.headers.origin),
    });

    return res.status(201).json({
        message: "Invite sent to User Email",
        inviteId: invite.id,
        loginOtpLink,
    });
}

// POST /api/admin/invites/:id/resend
export async function resendInviteOtp(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid invite id" });

    const invite = await prisma.userInvite.findUnique({ where: { id } });
    if (!invite) return res.status(404).json({ message: "Invite not found" });

    if (invite.status !== "PENDING") {
        return res.status(400).json({ message: "Invite is not pending" });
    }

    if (invite.expiresAt < new Date()) {
        await prisma.userInvite.update({
            where: { id },
            data: { status: "EXPIRED" },
        });
        return res.status(400).json({ message: "Invite expired" });
    }

    const user = await prisma.user.findUnique({ where: { email: invite.email } });
    if (!user) return res.status(404).json({ message: "User not found for invite" });

    const appUrl = getBaseFrontEndURL(req.headers.origin);
    const loginOtpLink = `${appUrl}/verifyotp?email=${encodeURIComponent(user.email)}&reason=invite`;

    await generateAndSendOtp(user.id, user.email, {
        purpose: "INVITE",
        loginOtpLink,
        roleLabel: "DEV",
        appName: getAppName(req.headers.origin),
    });
    res.status(204).send();
}