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

const sendOtpEmail = async (toEmail, code) => {
  if (!process.env.BREVO_API_KEY) {
    throw new Error("Email service not configured (missing BREVO_API_KEY)");
  }

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
      subject: `${code} is your RestroSethu verification code`,
      htmlContent: otpEmailHtml(code),
      textContent: `Your RestroSethu verification code is ${code}. It expires in 10 minutes. Never share this code with anyone.`,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Email send failed (${res.status})`);
  }
};

module.exports = { sendOtpEmail };
