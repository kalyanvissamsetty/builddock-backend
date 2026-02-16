import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { generateAndSendOtp } from "../services/otp.service";

export async function verifyOtp(req: Request, res: Response) {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP required" });
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid request" });
  }

  if (user.isEmailVerified) {
    return res.status(400).json({ message: "Already verified" });
  }

  const now = new Date();

  // Check lock
  if (user.otpLockedUntil && user.otpLockedUntil > now) {
    return res.status(403).json({
      message: "Too many failed attempts. Try later.",
    });
  }

  // Check expiry
  if (!user.otpExpiresAt || user.otpExpiresAt < now) {
    return res.status(400).json({ message: "OTP expired" });
  }

  // Check OTP match
  if (user.otpCode !== otp) {
    const attempts = user.otpAttempts + 1;

    const updateData: any = {
      otpAttempts: attempts,
    };

    if (attempts >= 5) {
      updateData.otpLockedUntil = new Date(
        Date.now() + 15 * 60 * 1000, // lock 15 minutes
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return res.status(400).json({ message: "Invalid OTP" });
  }

  // Success
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
  req.session.userId = user.id;
  return res.json({ message: "Email verified successfully" });
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
  await generateAndSendOtp(user.id, user.email);

  return res.json({ message: "OTP sent successfully" });
}