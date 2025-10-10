// app/api/notify-doctor-approved/route.ts
export const runtime = "nodejs"; // Nodemailer requires Node runtime (not Edge)

import nodemailer from "nodemailer";

type Payload = {
  to: string;     // doctor's email
  name?: string;  // doctor's name (optional)
};

export async function POST(req: Request) {
  try {
    const { to, name }: Payload = await req.json();

    if (!to) {
      return Response.json({ ok: false, error: "Missing 'to' email" }, { status: 400 });
    }

    // Build transporter
    // Quick-start: Gmail service
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const appName = process.env.APP_NAME || "SmartCare Connect";
    const appUrl = process.env.APP_URL || "https://example.com";
    const from = process.env.EMAIL_FROM || "no-reply@smartcare.app";

    const subject = `Your ${appName} account has been approved`;
    const safeName = name || "Doctor";

    const text = `Hello Dr. ${safeName},

Your account has been approved. You can now log in and start using ${appName}.

Login: ${appUrl}/login

If you have any questions, just reply to this email.

— ${appName} Team`;

    const html = `
      <div style="font-family:Arial, sans-serif; line-height:1.5; color:#111">
        <h2>${appName} — Account Approved</h2>
        <p>Hello Dr. <b>${safeName}</b>,</p>
        <p>Your account has been <b>approved</b>. You can now log in and start using ${appName}.</p>
        <p>
          <a href="${appUrl}/login" 
             style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">
            Go to Login
          </a>
        </p>
        <p style="margin-top:16px">If you have any questions, just reply to this email.</p>
        <p>— ${appName} Team</p>
      </div>
    `;

    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Email send error:", err);
    return Response.json({ ok: false, error: "Failed to send email" }, { status: 500 });
  }
}
