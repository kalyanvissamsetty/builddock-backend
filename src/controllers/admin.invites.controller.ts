import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { generateAndSendOtp } from "../services/otp.service"; // use your existing function
import { getAppName, getBaseFrontEndURL } from "../utils/conditionalRules";
import { Role } from "../generated/prisma/enums";
import { sendBulkInvites } from "../services/resend.email.service";

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

const ALLOWED_INVITE_ROLES: Role[] = ["VIEWER", "DEV", "MANAGER"] as const;

function isValidEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function bulkInviteUsers(req: Request, res: Response) {
    const role:Role = (req.body?.role || "VIEWER") as Role;
    const emailsArr = Array.isArray(req.body?.emails) ? req.body.emails : null;

    const {versionId} = req.body;
    if(!versionId) return res.status(400).json({ message: "Version ID is required" });
    let emails: string[] = [];

    if (emailsArr) {
        emails = emailsArr.map((x: any) => String(x));
    }

    emails = emails.map(normalizeEmail);

    // Dedupe
    emails = Array.from(new Set(emails));

    // Validate count
    if (emails.length === 0) {
        return res.status(400).json({ message: "No emails provided" });
    }
    if (emails.length > 30) {
        return res.status(400).json({ message: "Max 30 emails at a time" });
    }

    // Validate role
    if (!ALLOWED_INVITE_ROLES.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
    }

    // Validate emails
    const invalidEmails = emails.filter((e) => !isValidEmail(e));
    if (invalidEmails.length > 0) {
        return res.status(400).json({
            message: "Some emails are invalid",
            invalidEmails,
        });
    }

    // Enforce allowed domain
    const domains = await prisma.allowedEmailDomain.findMany({ select: { domain: true } });
    const allowedSet = new Set(domains.map((d) => d.domain.toLowerCase()));

    const domainNotAllowed = emails.filter((e) => {
        const d = e.split("@")[1]?.toLowerCase();
        return !d || !allowedSet.has(d);
    });

    if (domainNotAllowed.length > 0) {
        return res.status(403).json({
            message: "Some emails are not in allowed domains",
            emails: domainNotAllowed,
        });
    }

    const createdById = (req as any).user.id;

    // For report
    const emailsToSend: string[] = [];

    for (const email of emails) {
        // If you want to avoid re-inviting accepted users:
        const existingAcceptedInvite = await prisma.userInvite.findFirst({
            where: {
                email,
                status: "ACCEPTED",
            },
            select: { id: true },
        });

        if (existingAcceptedInvite) {
            continue;
        }
        emailsToSend.push(email);
    }

    const result = await sendBulkInvites(emailsToSend, {
        purpose: "INVITE",
        projectName: "PG&E Advanced Substation",
        roleLabel: role as Role,
    }, createdById)

    const okEmails = result.results.filter((r) => r.ok).map((r) => r.email.toLowerCase());

    okEmails.forEach(async (email)=>{
        const userData = await prisma.user.findUnique({where:{email}})
        if(userData){
            try{
            await prisma.viewerBuildAccess.create({
                data:{
                    userId:userData.id,
                    versionId, 
                    createdAt: new Date(),
                }
            })}catch(err : any){
                console.log("err: ",err)
            }
        }
    })
    console.log("emails result: ",result);

    return res.json({
        result
    });
}
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
    if (user) {
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


    // Send OTP now (invite email template should point to /login-otp?email=...)
    const appUrl = getBaseFrontEndURL(req.headers.origin || req.headers.host);
    const loginOtpLink = `${appUrl}/verifyotp?email=${encodeURIComponent(email)}&reason=invite`;
    user = await prisma.user.create({
        data: {
            email,
            name,
            role: role as any,
            isEmailVerified: true,
            passwordHash: null,
        },
    });
    const emailResponse: Boolean = await generateAndSendOtp(user.email, {
        purpose: "INVITE",
        loginOtpLink,
        roleLabel: role as Role,
        projectName: getAppName(req.headers.origin || req.headers.host),
    });
    console.log("email response: " + emailResponse)
    if (!emailResponse) {
        await prisma.user.delete({
            where: { id: user.id },
        })
        return res.status(400).json({
            message: "Failed to send Invite email to user",
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

    return res.status(201).json({
        message: "Invite sent to User Email",
        inviteId: invite.id,
        loginOtpLink,
    });
}

