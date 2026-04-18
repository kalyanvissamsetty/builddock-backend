import prisma from "../lib/prisma";
import { constructAndSendMail } from "./resend.email.service"
import { generateOTP } from "../utils/otp";
import { Role } from "../generated/prisma/enums";
export type OtpPurpose = "LOGIN" | "INVITE";

export type OtpEmailContext = {
  purpose?: OtpPurpose;
  projectName?: string;
  loginOtpLink?: string; // used for invite/login convenience
  roleLabel?: Role;    // used for invite
};


export async function generateOtpAndUpdateUser(email: string, role:Role, createdById: number) {
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) 
  {
    //as user not present create user
      const newUser = await prisma.user.create({
        data: {
          email,
          isEmailVerified: true,
          role,
          name: email.split("@")[0],
          otpCode: otp,
          otpExpiresAt: expiresAt,
          otpAttempts: 0,
          otpLockedUntil: null,
        },
      });
      //first time - so create invite
    const invite = await prisma.userInvite.create({
      data: {
        email,
        role,
        domain: email.split("@")[1],
        status: "PENDING",
        expiresAt,
        createdById,
      } as any,
    });
  } 
  else 
  {
      await prisma.user.update({
        where: { email },
        data: {
          isEmailVerified: true,
          otpCode: otp,
          otpExpiresAt: expiresAt,
          otpAttempts: 0,
          otpLockedUntil: null,
        },
      });

    const existingInvite = await prisma.userInvite.findUnique(
      { where: { email } }
    );

      if (existingInvite) {
        await prisma.userInvite.update({
          where: {
            email,
          },
          data: {
            expiresAt,
            status: "PENDING",
            createdById,
          },
        });
      }
      else{
        const invite = await prisma.userInvite.create({
          data: {
            email,
            role,
            domain: email.split("@")[1],
            status: "PENDING",
            expiresAt,
            createdById,
          } as any,
        });
      }
  }

  return otp
}
export async function generateAndSendOtp(
  email: string,
  ctx: OtpEmailContext = {},
): Promise<Boolean> {

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await prisma.user.update({
    where: { email },
    data: {
      otpCode: otp,
      otpExpiresAt: expiresAt,
      otpAttempts: 0,
      otpLockedUntil: null,
    },
  });
  
  return await constructAndSendMail(email, otp, {
    purpose: ctx.purpose ?? "LOGIN",
    projectName: ctx.projectName ?? "PG&E Advanced Substation",
    loginOtpLink: ctx.loginOtpLink,
    roleLabel: ctx.roleLabel,
  });
}