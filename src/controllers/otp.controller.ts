import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { generateAndSendOtp } from "../services/otp.service";
import { setAuthCookies } from "../utils/cookies";
import { signAccessToken, signRefreshToken } from "../utils/jwt";
import crypto from "crypto";
import { getAppName, getBaseFrontEndURL } from "../utils/conditionalRules";
function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
export async function verifyOtp(req: Request, res: Response) {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const now = new Date();

  // Lock check
  if (user.otpLockedUntil && user.otpLockedUntil > now) {
    return res.status(403).json({ message: "Too many failed attempts. Try later." });
  }

  // Expiry check
  if (!user.otpExpiresAt || user.otpExpiresAt < now) {
    return res.status(400).json({ message: "OTP expired" });
  }

  // OTP mismatch
  if (user.otpCode !== String(otp).trim()) {
    const attempts = user.otpAttempts + 1;

    const updateData: any = { otpAttempts: attempts };
    if (attempts >= 5) {
      updateData.otpLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    // IMPORTANT: Do not accept invites on invalid OTP
    return res.status(400).json({ message: "Invalid OTP" });
  }

  // OTP success: clear OTP fields
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      otpCode: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      otpLockedUntil: null,
      otpResendAfter: null,
    },
  });

  // If there is a pending invite, accept it and apply role (ADMIN blocked already at invite time)
  const invite = await prisma.userInvite.findFirst({
    where: {
      email: normalizedEmail,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (invite) {
    await prisma.userInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });

    // Apply invited role
    await prisma.user.update({
      where: { id: user.id },
      data: { role: invite.role },
    });
  }

  // Re-fetch user so we sign JWT with correct final role
  const finalUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, role: true },
  });

  const accessToken = signAccessToken(finalUser!.id, finalUser!.role);
  const refreshToken = signRefreshToken(finalUser!.id, finalUser!.role);

  await prisma.refreshToken.create({
    data: {
      userId: finalUser!.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Your helper signature seems to be setAuthCookies(req, res, ...)
  setAuthCookies(req, res, accessToken, refreshToken);

  return res.json({ message: "Logged in" });
}

export async function resendOtp(req: Request, res: Response) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email required" });
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || user.isEmailVerified) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const now = new Date();

  if (user.otpResendAfter && user.otpResendAfter > now) {
    return res.status(400).json({
      message: "Please wait before requesting another OTP",
    });
  }

  // Send email again here
  const appUrl = getBaseFrontEndURL(req.headers.origin);
  const loginOtpLink = `${appUrl}/verifyotp?email=${encodeURIComponent(email)}&reason=otp-login`;

  await generateAndSendOtp(user.id, user.email, {
    purpose: "LOGIN",
    loginOtpLink,
    appName: getAppName(req.headers.origin),
  });

  return res.json({ message: "OTP sent successfully" });
}
function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function getEmailDomain(email: string) {
  const parts = email.split("@");
  if (parts.length !== 2) return "";
  return parts[1];
}
export async function requestOtp(req: Request, res: Response) {
  const email = normalizeEmail(req.body?.email);

  if (!email || !email.includes("@")) {
    return res.status(400).json({ message: "Valid email is required" });
  }

  const domain = getEmailDomain(email);
  if (!domain) return res.status(400).json({ message: "Invalid email domain" });

  const allowed = await prisma.allowedEmailDomain.findUnique({ where: { domain } });
  if (!allowed) {
    return res.status(403).json({ message: "Email domain not allowed" });
  }

  // IMPORTANT: Do not create user here
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(404).json({
      message: "No account found for this email. Please sign up or contact admin.",
      code: "ACCOUNT_NOT_FOUND",
      redirectTo: `/signup?email=${encodeURIComponent(email)}`,
    });
  }

  const appUrl = getBaseFrontEndURL(req.headers.origin);
  const loginOtpLink = `${appUrl}/verifyotp?email=${encodeURIComponent(email)}&reason=otp-login`;

  await generateAndSendOtp(user.id, user.email, {
    purpose: "LOGIN",
    appName: getAppName(req.headers.origin),
    loginOtpLink,
  });

  return res.status(204).send();
}