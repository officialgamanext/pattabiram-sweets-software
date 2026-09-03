import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = Number(process.env.SMTP_PORT) || 465;
const smtpUser = process.env.SMTP_USER || 'pattabiramasweets@gmail.com';
// Clean app password (remove spaces if any)
const smtpPass = (process.env.SMTP_PASS || 'nptu qtsd cdcu ddpr').replace(/\s+/g, '');
const alertEmail = process.env.ALERT_EMAIL || 'sureshdivya2015@zohomail.in';

export const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

export interface PackingUnitTransferEmailParams {
  otp: string;
  orderCode: string;
  targetType: 'order' | 'item';
  itemName?: string;
  currentUnitName?: string;
  requestedBy?: string;
}

export async function sendPackingUnitTransferOtpEmail({
  otp,
  orderCode,
  targetType,
  itemName,
  currentUnitName,
  requestedBy = 'Packing Portal Manager',
}: PackingUnitTransferEmailParams) {
  const scopeDescription =
    targetType === 'item' && itemName
      ? `Item: ${itemName}`
      : `Full Order (${orderCode})`;

  const formattedDate = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Packing Unit Transfer Authorization</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" max-width="580" cellspacing="0" cellpadding="0" border="0" style="max-width: 580px; width: 100%; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #02626D 0%, #014149 100%); padding: 32px 28px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: rgba(255,255,255,0.15); padding: 6px 16px; border-radius: 50px; font-size: 11px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">
                      Pattabiram Sweets
                    </div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.3px; line-height: 1.3;">
                      Packing Unit Transfer Request
                    </h1>
                    <p style="margin: 6px 0 0 0; color: #ccfbf1; font-size: 13px; font-weight: 500;">
                      Security Verification & Authorization
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <p style="margin: 0 0 18px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                Hello Administrator,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                A request has been initiated to transfer <strong>${scopeDescription}</strong> to a different packing unit in the Pattabiram Sweets management system.
              </p>

              <!-- OTP Highlight Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #f8fafc; border: 2px dashed #02626D; border-radius: 16px; margin: 24px 0;">
                <tr>
                  <td align="center" style="padding: 24px 16px;">
                    <span style="display: block; font-size: 11px; font-weight: 800; color: #02626D; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">
                      Your One-Time Authorization Code (OTP)
                    </span>
                    <div style="font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #02626D; font-family: 'Courier New', Courier, monospace; background: #ffffff; padding: 10px 24px; border-radius: 10px; display: inline-block; border: 1px solid #cbd5e1; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
                      ${otp}
                    </div>
                    <span style="display: block; font-size: 12px; font-weight: 600; color: #e11d48; margin-top: 10px;">
                      ⏳ Valid for 5 minutes only
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Request Details Table -->
              <div style="background-color: #f8fafc; border-radius: 14px; padding: 18px 20px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
                <h3 style="margin: 0 0 14px 0; font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">
                  Transfer Request Details
                </h3>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="6" border="0" style="font-size: 13px;">
                  <tr>
                    <td style="color: #64748b; font-weight: 600; width: 40%;">Order Code:</td>
                    <td style="color: #02626D; font-weight: 800; font-family: monospace;">${orderCode}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b; font-weight: 600;">Transfer Scope:</td>
                    <td style="color: #1e293b; font-weight: 700;">${targetType === 'item' ? 'Single Item' : 'Entire Order'}</td>
                  </tr>
                  ${
                    itemName
                      ? `
                  <tr>
                    <td style="color: #64748b; font-weight: 600;">Item Name:</td>
                    <td style="color: #1e293b; font-weight: 700;">${itemName}</td>
                  </tr>
                  `
                      : ''
                  }
                  ${
                    currentUnitName
                      ? `
                  <tr>
                    <td style="color: #64748b; font-weight: 600;">Current Unit:</td>
                    <td style="color: #1e293b; font-weight: 600;">${currentUnitName}</td>
                  </tr>
                  `
                      : ''
                  }
                  <tr>
                    <td style="color: #64748b; font-weight: 600;">Initiated By:</td>
                    <td style="color: #1e293b; font-weight: 600;">${requestedBy}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b; font-weight: 600;">Timestamp:</td>
                    <td style="color: #1e293b; font-weight: 600;">${formattedDate}</td>
                  </tr>
                </table>
              </div>

              <!-- Security Notice Alert -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 8px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #92400e;">
                      <strong>Security Note:</strong> Do not share this OTP with anyone outside authorized personnel. Once verified, the order/item will instantly move to the destination packing unit and be removed from the previous unit.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                If you did not request this authorization, please review system audit logs or verify with the active store manager.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 500;">
                © ${new Date().getFullYear()} Pattabiram Sweets Management Software. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const info = await transporter.sendMail({
    from: `"Pattabiram Sweets" <${smtpUser}>`,
    to: alertEmail,
    subject: `🔐 [${otp}] Authorization Code: Switch Packing Unit for Order ${orderCode}`,
    html: htmlContent,
    text: `Pattabiram Sweets - Packing Unit Transfer Authorization\n\nYour OTP is: ${otp}\nOrder Code: ${orderCode}\nScope: ${scopeDescription}\nValid for 5 minutes.`,
  });

  return info;
}
