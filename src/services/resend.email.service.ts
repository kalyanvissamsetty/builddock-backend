import { Resend } from 'resend';
import { getGraphClient, runWithConcurrency, withGraphRetry } from './outlookGraph';
import { generateOtpAndUpdateUser, OtpEmailContext } from './otp.service';
import { Role } from '../generated/prisma/enums';
import { getAppropriateRole, getBaseFrontEndURL } from '../utils/conditionalRules';

const resend = new Resend(process.env.RESEND_API_KEY as string);


function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderBaseTemplate(params: {
  title: string;
  otp: string;
  primaryActionLabel?: string;
  primaryActionUrl?: string;
  extraLines?: string[];
  appName: string;
}) {
  const title = escapeHtml(params.title);
  const otp = escapeHtml(params.otp);

  const primaryActionLabel = params.primaryActionLabel
    ? escapeHtml(params.primaryActionLabel)
    : "";
  const primaryActionUrl = params.primaryActionUrl
    ? escapeHtml(params.primaryActionUrl)
    : "";

  const extraLines = params.extraLines ?? [];

  const extraHtml = extraLines
    .map((l) => `<p style="margin: 0 0 10px 0; color: #374151; font-size: 14px;">${escapeHtml(l)}</p>`)
    .join("");

  const buttonHtml =
    primaryActionUrl && primaryActionLabel
      ? `
        <div style="margin: 18px 0;">
          <a href="${primaryActionUrl}"
             style="
               display: inline-block;
               padding: 10px 14px;
               background: #111827;
               color: #ffffff;
               text-decoration: none;
               border-radius: 8px;
               font-size: 14px;
               font-weight: 600;">
            ${primaryActionLabel}
          </a>
        </div>
        <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 12px;">
          If the button does not work, copy and paste this link:
        </p>
        <p style="margin: 6px 0 0 0; color: #111827; font-size: 12px; word-break: break-all;">
          ${primaryActionUrl}
        </p>
      `
      : "";

  return `
  <div style="font-family: Arial, sans-serif; background: #f9fafb; padding: 24px;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      <div style="padding: 18px 20px; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0; font-size: 18px; color: #111827;">${title}</h2>
      </div>

      <div style="padding: 20px;">
        ${extraHtml}

        <p style="margin: 0 0 10px 0; color: #374151; font-size: 14px;">Your OTP code is:</p>

        <div style="display: inline-block; padding: 14px 16px; border-radius: 10px; border: 1px dashed #d1d5db; background: #f9fafb;">
          <span style="font-size: 24px; letter-spacing: 6px; font-weight: 700; color: #111827;">${otp}</span>
        </div>

        <p style="margin: 14px 0 0 0; color: #6b7280; font-size: 13px;">
          This code will expire in 15 minutes.
        </p>

        ${buttonHtml}

        <p style="margin: 18px 0 0 0; color: #6b7280; font-size: 12px; line-height: 1.5;">
          If you did not request this, you can ignore this email.
        </p>
      </div>

      <div style="padding: 14px 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
        <p style="margin: 0;">Thanks,</p>
        <p style="margin: 4px 0 0 0;">Mosaic Team</p>
      </div>
    </div>
  </div>
  `;
}
function getInviteEmailTemplate(ctx: OtpEmailContext, otp: string) {
  const subject = `You have been invited to access ${ctx.projectName}`
  const roleLine = ctx.roleLabel ? `Role: ${getAppropriateRole(ctx.roleLabel)}` : undefined;

  const html = renderBaseTemplate({
    title: `You have been invited to access ${ctx.projectName}`,
    otp,
    primaryActionLabel: ctx.loginOtpLink ? "Accept invite and sign in" : undefined,
    primaryActionUrl: ctx.loginOtpLink,
    extraLines: [
      roleLine ? roleLine : "",
      "Use the OTP below to sign in.",
    ].filter(Boolean),
    appName: ctx.projectName ? ctx.projectName : "PG&E Advanced Substation",
  });

  return { subject, html }
}

export async function sendBulkInvites(emails: string[], ctx: OtpEmailContext, createdById: number) {
  const results = await runWithConcurrency(emails, 3, async (email) => {
    //generate invite link
    const appUrl = getBaseFrontEndURL("mosaic");
    const loginOtpLink = `${appUrl}/verifyotp?email=${encodeURIComponent(email)}&reason=invite`;

    // generate otp & update tables
    const otp = await generateOtpAndUpdateUser(email,ctx.roleLabel as Role,createdById)
    // construct email
    const { subject, html } = getInviteEmailTemplate({...ctx,loginOtpLink}, otp)

    // send email
    const r = await sendMosaicMail({ to: email, subject, html });

    return { email, ...r };
  });

  return {
    requested: emails.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
export async function constructAndSendMail(to: string, otp: string, ctx: OtpEmailContext) {
  const appName = ctx.projectName ?? "PG&E Advanced Substation";

  // Choose subject and body content by purpose
  let subject = "";
  let html = "";

  if (ctx.purpose === "LOGIN") {
    subject = `Your ${appName} login code`;
    html = renderBaseTemplate({
      title: "Sign in to your account",
      otp,
      primaryActionLabel: ctx.loginOtpLink ? "Open login page" : undefined,
      primaryActionUrl: ctx.loginOtpLink,
      appName,
    });
  }

  if (ctx.purpose === "INVITE") {
    const { subject: s, html: h } = getInviteEmailTemplate(ctx, otp)
    subject = s
    html = h
  }
  const response = await sendMosaicMail({
    to,
    subject,
    html
  });
  return response.ok;
}

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

const sendTIMSMail = async ({ to, subject, html }: SendEmailParams): Promise<boolean> => {
  try {
    const { data, error } = await resend.emails.send({
      from: `TIMS Studio <${process.env.SES_FROM_EMAIL as string}>`,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("sendEmail error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("sendEmail error:", error);
    return false;
  }
};


export async function sendMosaicMail({ to, subject, html }: SendEmailParams) {
  const { MOSAIC_SENDER_EMAIL } = process.env;
  if (!MOSAIC_SENDER_EMAIL) throw new Error("Missing MOSAIC_SENDER_EMAIL");

  const client = getGraphClient();

  try {
    await withGraphRetry(() =>
      client.api(`/users/${encodeURIComponent(MOSAIC_SENDER_EMAIL)}/sendMail`).post({
        message: {
          subject,
          body: { contentType: "HTML", content: html },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      }),
    );

    return { ok: true as const };
  } catch (err: any) {
    const status = err?.statusCode || err?.status;
    const msg =
      err?.body?.error?.message ||
      err?.message ||
      "Graph sendMail failed";
    return { ok: false as const, status, message: msg };
  }
}
