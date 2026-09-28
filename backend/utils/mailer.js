// Sends transactional email via Brevo's HTTPS API instead of raw SMTP. Render (and many
// hosts) block or badly rate-limit outbound SMTP (ports 465/587), which made Gmail SMTP
// hang until connectionTimeout and then fail with "Connection timeout" on every send.
// Brevo's API runs over plain HTTPS (443), which is never blocked.
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const otpEmailHtml = (code) => `
<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background-color:#f4f1f2; font-family: 'Segoe UI', Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f1f2; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 460px; background-color:#ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 18px 45px rgba(132,9,30,0.14);">
            <tr>
              <td style="background: linear-gradient(135deg,#84091e,#b3132c); padding: 28px 32px; text-align:center;">
                <div style="font-size: 22px; font-weight: 800; color:#ffffff; letter-spacing: 0.5px;">RestroSethu</div>
                <div style="font-size: 12px; color:#ffe3e7; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">Delivery order verification</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                <p style="margin:0 0 6px; font-size: 15px; color:#0f172a; font-weight:700;">Verify your email</p>
                <p style="margin:0 0 24px; font-size: 14px; color:#64748b; line-height: 1.6;">
                  Enter this code on the RestroSethu order page to confirm it's really you before we send your food out for delivery.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="background-color:#fdf1f3; border: 1.5px dashed #84091e33; border-radius: 14px; padding: 20px;">
                      <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color:#84091e;">${code}</span>
                    </td>
                  </tr>
                </table>
                <p style="margin: 20px 0 0; font-size: 12.5px; color:#94a3b8; line-height: 1.6;">
                  This code expires in <strong style="color:#84091e;">10 minutes</strong>. Never share it with anyone --
                  RestroSethu staff will never ask for your OTP over phone or chat.
                </p>
                <p style="margin: 16px 0 0; font-size: 12.5px; color:#94a3b8;">
                  Didn't request this? You can safely ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 18px 32px; background-color:#faf7f7; text-align:center;">
                <p style="margin:0; font-size: 11.5px; color:#a1a1aa;">&copy; ${new Date().getFullYear()} RestroSethu &middot; Automated message, please don't reply</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

const otpSubject = (code) => `${code} is your RestroSethu verification code`;
const otpText = (code) =>
  `Your RestroSethu verification code is ${code}. It expires in 10 minutes. Never share this code with anyone.`;

// --- 1. Gmail API over HTTPS -------------------------------------------------------
// Sends as the real gmail.com address through Google's own API on port 443, so it
// works on Render (which blocks SMTP) and lands instantly -- unlike Brevo, which has
// to rewrite a gmail.com sender to its own brevosend.com address and queues it.
// Needs a one-time OAuth refresh token: run `npm run gmail:token`.
const hasGmailApi = () =>
  Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN);

let gmailAccessToken = { value: "", expiresAt: 0 };
const getGmailAccessToken = async () => {
  if (gmailAccessToken.value && Date.now() < gmailAccessToken.expiresAt - 60_000) return gmailAccessToken.value;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gmail token refresh failed: ${body.error_description || body.error || res.status}`);

  gmailAccessToken = { value: body.access_token, expiresAt: Date.now() + Number(body.expires_in || 3600) * 1000 };
  return gmailAccessToken.value;
};

const b64 = (value) => Buffer.from(value, "utf8").toString("base64");
const encodeHeader = (value) => `=?UTF-8?B?${b64(value)}?=`;

const buildMime = ({ from, to, subject, html, text }) => {
  const boundary = `rs_${Date.now().toString(36)}`;
  return [
    `From: ${encodeHeader("RestroSethu")} <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64(text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64(html),
    `--${boundary}--`,
  ].join("\r\n");
};

const sendViaGmailApi = async (toEmail, code) => {
  const accessToken = await getGmailAccessToken();
  const raw = Buffer.from(
    buildMime({ from: process.env.EMAIL_USER, to: toEmail, subject: otpSubject(code), html: otpEmailHtml(code), text: otpText(code) })
  ).toString("base64url");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Gmail API send failed: ${body.error?.message || res.status}`);
  }
};

// --- 2. Gmail SMTP with an App Password (local dev only; Render blocks SMTP) -------
let gmailTransport = null;
const sendViaGmailSmtp = async (toEmail, code) => {
  if (!gmailTransport) {
    const nodemailer = require("nodemailer");
    gmailTransport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD.replace(/\s+/g, "") },
      connectionTimeout: 10000,
    });
  }

  await gmailTransport.sendMail({
    from: `"RestroSethu" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: otpSubject(code),
    html: otpEmailHtml(code),
    text: otpText(code),
  });
};

// --- 3. Brevo HTTPS API (last-resort fallback; slow for a gmail.com sender) --------
const sendViaBrevo = async (toEmail, code) => {
  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "RestroSethu", email: process.env.EMAIL_USER },
      to: [{ email: toEmail }],
      subject: otpSubject(code),
      htmlContent: otpEmailHtml(code),
      textContent: otpText(code),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Email send failed (${res.status})`);
  }
};

// Tries each configured provider in order, falling through to the next on failure.
const sendOtpEmail = async (toEmail, code) => {
  const providers = [
    hasGmailApi() && process.env.EMAIL_USER && ["Gmail API", sendViaGmailApi],
    process.env.EMAIL_APP_PASSWORD && process.env.EMAIL_USER && ["Gmail SMTP", sendViaGmailSmtp],
    process.env.BREVO_API_KEY && ["Brevo", sendViaBrevo],
  ].filter(Boolean);

  if (providers.length === 0) {
    throw new Error("Email service not configured (set GMAIL_* or BREVO_API_KEY)");
  }

  let lastError;
  for (const [name, send] of providers) {
    try {
      return await send(toEmail, code);
    } catch (error) {
      lastError = error;
      console.error(`${name} failed:`, error.message);
    }
  }
  throw lastError;
};

module.exports = { sendOtpEmail };
