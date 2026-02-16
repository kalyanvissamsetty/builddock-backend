import { Request, Response } from "express";
import { logger } from "../utils/logger";
import prisma from "../lib/prisma";
import { hashPassword } from "../utils/password";
import { isEmailDomainAllowed } from "../utils/emailDomain";
import { validatePassword } from "../utils/passwordRules";
import { verifyPassword } from "../utils/password";
import { generateAndSendOtp } from "../services/otp.service";
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

  // Prevent duplicate accounts
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
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

  await generateAndSendOtp(user.id, user.email);


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

  if (!user || !user.passwordHash) {
    return res
      .status(401)
      .json({ code: "INVALID_CREDENTIALS", message: "Invalid credentials" });
  }

  if (!user.isEmailVerified) {
    logger.warn(`Login failed: Email not verified for ${email}`);
    return res
      .status(403)
      .json({ code: "EMAIL_NOT_VERIFIED", message: "Email not verified" });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return res
      .status(401)
      .json({ code: "INVALID_CREDENTIALS", message: "Invalid credentials" });
  }

  // Store user id in session
  req.session.userId = user.id;

  return res.json({
    message: "Login successful",
    role: user.role,
  });
}

export async function me(req: Request, res: Response) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: { id: true, email: true, role: true, name:true },
  });

  return res.json(user);
}

