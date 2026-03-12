import prisma from "../lib/prisma";
import {  sendOtpEmail } from "./resend.email.service"
import { generateOTP } from "../utils/otp";
type OtpPurpose = "INVITED_NO_PASSWORD"| "VERIFY_EMAIL" | "LOGIN" | "INVITE";

type OtpEmailContext = {
  purpose?: OtpPurpose;
  appName?: string;
  loginOtpLink?: string; // used for invite/login convenience
  roleLabel?: string;    // used for invite
};

export async function generateAndSendOtp(
  userId: number,
  email: string,
  ctx: OtpEmailContext = {},
):Promise<Boolean> {
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: {
      otpCode: otp,
      otpExpiresAt: expiresAt,
      otpAttempts: 0,
      otpLockedUntil: null,
    },
  });

  return await sendOtpEmail(email, otp, {
    purpose: ctx.purpose ?? "VERIFY_EMAIL", // default keeps old behavior
    appName: ctx.appName ?? "Mosaic WebGL Viewer",
    loginOtpLink: ctx.loginOtpLink,
    roleLabel: ctx.roleLabel,
  });
}