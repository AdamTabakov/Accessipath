import { config } from "../config.js";

export interface VerificationEmailResult {
  delivered: boolean;
  /** Only present when no Resend key is configured (development fallback). */
  devCode?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sends the email verification code. When RESEND_API_KEY is not configured
 * (local development), the code is logged and returned so the flow can be
 * tested end-to-end. The code is never returned to the client in production.
 */
export async function sendVerificationEmail(input: {
  to: string;
  name: string;
  code: string;
}): Promise<VerificationEmailResult> {
  const { to, name, code } = input;

  if (!config.resendApiKey) {
    console.log(`[mailer] dev fallback: verification code for ${to} is ${code}`);
    return { delivered: false, devCode: code };
  }

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1d1d1f;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Verify your AccessiPath email</h1>
      <p style="font-size: 15px; line-height: 1.5;">Hi ${escapeHtml(name)},</p>
      <p style="font-size: 15px; line-height: 1.5;">Your verification code is:</p>
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; margin: 16px 0; color: #0071e3;">${escapeHtml(code)}</p>
      <p style="font-size: 15px; line-height: 1.5;">
        Enter it on the AccessiPath verification page. This code expires in
        ${config.verificationCodeTtlMinutes} minutes. If you did not create an
        account, you can ignore this email.
      </p>
    </div>
  `;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.resendFrom,
        to: [to],
        subject: "Your AccessiPath verification code",
        html,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error(`[mailer] Resend error ${response.status}:`, detail.slice(0, 500));
      throw new Error("Verification email could not be sent.");
    }
    return { delivered: true };
  } finally {
    clearTimeout(timer);
  }
}