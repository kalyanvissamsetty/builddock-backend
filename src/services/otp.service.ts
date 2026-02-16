import prisma from "../lib/prisma";
import { sendOtpEmail } from "./email.service";
import { generateOTP } from "../utils/otp";

export async function generateAndSendOtp(userId: number, email: string) {
  const otp = generateOTP();

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
