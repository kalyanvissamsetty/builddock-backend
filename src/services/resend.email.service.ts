import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY as string);
type SendOtpCtx = {
    purpose: "VERIFY_EMAIL" | "LOGIN" | "INVITE";
    appName?: string;
    loginOtpLink?: string; // optional, good for LOGIN/INVITE
    roleLabel?: string; // for INVITE
};

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
    subtitle?: string;
    otp: string;
    primaryActionLabel?: string;
    primaryActionUrl?: string;
    extraLines?: string[];
    appName: string;
}) {
    const title = escapeHtml(params.title);
    const subtitle = params.subtitle ? escapeHtml(params.subtitle) : "";
    const otp = escapeHtml(params.otp);
    const appName = escapeHtml(params.appName);

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
        ${subtitle
            ? `<p style="margin: 8px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.4;">${subtitle}</p>`
            : ""
        }
      </div>

      <div style="padding: 20px;">
        ${extraHtml}

        <p style="margin: 0 0 10px 0; color: #374151; font-size: 14px;">Your OTP code is:</p>

        <div style="display: inline-block; padding: 14px 16px; border-radius: 10px; border: 1px dashed #d1d5db; background: #f9fafb;">
          <span style="font-size: 24px; letter-spacing: 6px; font-weight: 700; color: #111827;">${otp}</span>
        </div>

        <p style="margin: 14px 0 0 0; color: #6b7280; font-size: 13px;">
          This code will expire in 10 minutes.
        </p>

        ${buttonHtml}

        <p style="margin: 18px 0 0 0; color: #6b7280; font-size: 12px; line-height: 1.5;">
          If you did not request this, you can ignore this email.
        </p>
      </div>

      <div style="padding: 14px 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
        <p style="margin: 0;">Thanks,</p>
        <p style="margin: 4px 0 0 0;">${appName} Team</p>
      </div>
    </div>
  </div>
  `;
}

export async function sendOtpEmail(to: string, otp: string, ctx: SendOtpCtx) {
    const appName = ctx.appName ?? "Mosaic WebGL Viewer";

    // Choose subject and body content by purpose
    let subject = "";
    let html = "";

    if (ctx.purpose === "VERIFY_EMAIL") {
        subject = `Confirm your ${appName} account`;
        html = renderBaseTemplate({
            title: "Confirm your account",
            subtitle: `Thank you for joining ${appName}. Use this code to complete your registration.`,
            otp,
            appName,
        });
    }

    if (ctx.purpose === "LOGIN") {
        subject = `Your ${appName} login code`;
        html = renderBaseTemplate({
            title: "Sign in to your account",
            subtitle: `Use this code to sign in to ${appName}.`,
            otp,
            primaryActionLabel: ctx.loginOtpLink ? "Open login page" : undefined,
            primaryActionUrl: ctx.loginOtpLink,
            appName,
        });
    }

    if (ctx.purpose === "INVITE") {
        subject = `You have been invited to ${appName}`;
        const roleLine = ctx.roleLabel ? `Role: ${ctx.roleLabel}` : undefined;

        html = renderBaseTemplate({
            title: "You have been invited",
            subtitle: `You have been invited to access ${appName}.`,
            otp,
            primaryActionLabel: ctx.loginOtpLink ? "Accept invite and sign in" : undefined,
            primaryActionUrl: ctx.loginOtpLink,
            extraLines: [
                roleLine ? roleLine : "",
                "Use the OTP below to sign in.",
            ].filter(Boolean),
            appName,
        });
    }

    try {
        const data = await resend.emails.send({
            from: `TIMS Studio <${process.env.SES_FROM_EMAIL as string}>`,
            to: [to],
            subject,
            html,
        });

        return data;
    } catch (error) {
        console.error("sendOtpEmail error", error);
        throw error;
    }
}