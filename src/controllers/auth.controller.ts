import { Request, Response } from "express";
import { logger } from "../utils/logger";
import prisma from "../lib/prisma";
import { hashPassword } from "../utils/password";
import { validatePassword } from "../utils/passwordRules";
import { verifyPassword } from "../utils/password";
import { generateAndSendOtp } from "../services/otp.service";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import crypto from "crypto";
import { clearAuthCookies,  clearCloudFrontCookies,  setAuthCookies } from "../utils/cookies";
import { AuthedRequest } from "../middlewares/authJwt";
import { isEmailDomainAllowed } from "../utils/emailDomain";
import { getAppName, getBaseFrontEndURL } from "../utils/conditionalRules";
function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
export async function signup(req: Request, res: Response) {
  logger.info(`Signup attempt for email: ${req.body.email}`);
  const { email, password, name } = req.body;
  // Basic validation
  if (!email || !password || !name) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  const normalizedName = name.trim();
  if (!name || name.trim().length < 2 || name.trim().length > 50) {
    return res.status(400).json({
      message: "Name must be between 2 and 50 characters",
    });
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ message: passwordError });
  }
  // Domain validation
  const allowed = await isEmailDomainAllowed(email);
  if (!allowed) {
    return res.status(403).json({
      message: "Email domain not allowed",
    });
  }
  const normalizedEmail = String(email).trim().toLowerCase();

  // Prevent duplicate accounts
  const existing = await prisma.user.findUnique({
    where: { email },
  });
  //user exists & has password but NOT verified -> resend OTP and return
  if (existing && !existing.isEmailVerified && existing.passwordHash) {
    // Optional: update name/password if you want, or keep as is
    const passwordHash = await hashPassword(password);

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: existing.name ? undefined : normalizedName,
        passwordHash,
      },
    });

    const appUrl = getBaseFrontEndURL(req.headers.origin || req.headers.host);
    const verifyLink = `${appUrl}/verifyotp?email=${encodeURIComponent(normalizedEmail)}&reason=not-verified`;

    // await generateAndSendOtp(normalizedEmail, {
    //   purpose: "VERIFY_EMAIL",
    //   loginOtpLink: verifyLink,
    // });

    return res.status(409).json({
      message: "Account exists but email is not verified. OTP sent again.",
      code: "EMAIL_NOT_VERIFIED",
      redirectTo: `/verifyotp?email=${encodeURIComponent(normalizedEmail)}&reason=not-verified`,
    });
  }
  if (existing && existing.isEmailVerified && !existing.passwordHash) {
    const invite = await prisma.userInvite.findFirst({
      where: {
        email: existing.email,
      },
    })
    if (invite) {
      const appUrl = getBaseFrontEndURL(req.headers.origin || req.headers.host);
      const verifyLink = `${appUrl}/verifyotp?email=${encodeURIComponent(existing.email)}&reason=invited-no-password`;

      // await generateAndSendOtp(existing.id, existing.email, {
      //   purpose: "INVITED_NO_PASSWORD",
      //   loginOtpLink: verifyLink,
      //   appName: getAppName(req.headers.origin || req.headers.host),
      // });

      return res.status(403).json({
        message: "You are Invited to join, Please Verify your Email",
        code: "EMAIL_NOT_VERIFIED",
        redirectTo: `/verifyotp?email=${encodeURIComponent(existing.email)}&reason=invited-no-password`,
      });
    }
    return res.status(409).json({
      message: "User already exists",
    });
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  //  Create user (NOT verified)
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: normalizedName,
      role: "VIEWER",
      isEmailVerified: false,
    },
  });

  logger.info(`User created: ${user.id}`);

  // await generateAndSendOtp(user.id, user.email, { purpose: "VERIFY_EMAIL", appName: getAppName(req.headers.origin || req.headers.host) });


  return res.status(201).json({
    message: "Account created. Please verify your email.",
  });
}



export async function login(req: Request, res: Response) {
    logger.info(`Login attempt for email: ${req.body.email}`);

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      code: "INVALID_INPUT",
      message: "Email and password are required",
    });
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return res
      .status(401)
      .json({ code: "INVALID_CREDENTIALS", message: "User Not Found" });
  }
  //this is invited user case (password won't present but email is verified)
  if (!user.passwordHash && user.isEmailVerified) {
    const invite = await prisma.userInvite.findFirst({
      where: {
        email: user.email,
      },
    })
    if(invite){
      const appUrl = getBaseFrontEndURL(req.headers.origin || req.headers.host);
      const verifyLink = `${appUrl}/verifyotp?email=${encodeURIComponent(user.email)}&reason=invited-no-password`;

      // await generateAndSendOtp(user.id, user.email, {
      //   purpose: "INVITED_NO_PASSWORD",
      //   loginOtpLink: verifyLink,
      //   appName: getAppName(req.headers.origin || req.headers.host),
      // });

      return res.status(403).json({
        message: "You are Invited to join, Please Verify your Email",
        code: "EMAIL_NOT_VERIFIED",
        redirectTo: `/verifyotp?email=${encodeURIComponent(user.email)}&reason=invited-no-password`,
      });
    }
    return res
      .status(401)
      .json({ code: "INVALID_CREDENTIALS", message: "User Not Found" });
  }

  if(!user.passwordHash){
    return res
      .status(401)
      .json({ code: "INVALID_CREDENTIALS", message: "User Not Found" });
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return res
      .status(401)
      .json({ code: "INVALID_CREDENTIALS", message: "Invalid credentials" });
  }
  if (!user.isEmailVerified) {
    const appUrl = getBaseFrontEndURL(req.headers.origin || req.headers.host);
    const verifyLink = `${appUrl}/verifyotp?email=${encodeURIComponent(user.email)}&reason=not-verified`;

    // await generateAndSendOtp(user.id, user.email, {
    //   purpose: "VERIFY_EMAIL",
    //   loginOtpLink: verifyLink,
    //   appName: getAppName(req.headers.origin || req.headers.host),
    // });

    return res.status(403).json({
      message: "Email not verified. OTP sent again.",
      code: "EMAIL_NOT_VERIFIED",
      redirectTo: `/verifyotp?email=${encodeURIComponent(user.email)}&reason=not-verified`,
    });
  }
  
  
  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id, user.role);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  setAuthCookies(req, res, accessToken, refreshToken);

  return res.json({
    message: "Login successful",
    role: user.role,
  });
}
export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.timsstudio_refresh;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    clearAuthCookies(req, res);
    return res.status(401).json({ message: "Unauthorized" });
  }

  const tokenHash = hashToken(token);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    clearAuthCookies(req, res);
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userId = Number(payload.sub);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    clearAuthCookies(req, res);
    return res.status(401).json({ message: "Unauthorized" });
  }

  // rotate refresh token (recommended)
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const newAccess = signAccessToken(user.id, user.role);
  const newRefresh = signRefreshToken(user.id, user.role);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(newRefresh),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  setAuthCookies(req, res, newAccess, newRefresh);
  return res.status(204).send();
}
export async function me(req: AuthedRequest, res: Response) {
  const userId = req.user!.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });

  return res.json(user);
}

export async function logout(req: Request, res: Response) {
  const token = req.cookies?.timsstudio_refresh;
  if (token) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  clearAuthCookies(req, res);
  clearCloudFrontCookies(req, res);
  return res.status(204).send();
}