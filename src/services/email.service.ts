import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY as string,
  },
});

export async function sendOtpEmail(to: string, otp: string) {
  const command = new SendEmailCommand({
    Source: process.env.SES_FROM_EMAIL as string,
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: {
        Data: "Your BuildDock Verification Code",
      },
      Body: {
        Html: {
          Data: `
            <div style="font-family: Arial, sans-serif;">
              <h2>Verify Your Account</h2>
              <p>Your OTP code is:</p>
              <h1 style="letter-spacing: 4px;">${otp}</h1>
              <p>This code will expire in 10 minutes.</p>
            </div>
          `,
        },
      },
    },
  });

  await ses.send(command);
}
