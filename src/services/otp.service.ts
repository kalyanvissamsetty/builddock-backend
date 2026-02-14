import prisma from "../lib/prisma";
import { sendOtpEmail } from "./email.service";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function generateAndSendOtp(userId: number, email: string) {
  const otp = generateOtp();

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await prisma.user.update({
    where: { id: userId },
    data: {
      otpCode: otp,
      otpExpiresAt: expiresAt,
      otpAttempts: 0,
      otpLockedUntil: null,
    },
  });

  //await sendOtpEmail(email, otp);
}
