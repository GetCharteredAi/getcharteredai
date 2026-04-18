// netlify/functions/send-welcome.js
// Sends welcome email to new member after account activation
// Uses Netlify's built-in email sending via fetch to a transactional email service

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "https://getcharteredai.netlify.app",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid request" }),
    };
  }

  const { email, plan } = body;

  if (!email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Email required" }),
    };
  }

  const planText =
    plan === "monthly"
      ? "Monthly Subscription (£39.90/month)"
      : "Full Year Access — All 12 Modules (£383.04)";
  const planNote =
    plan === "monthly"
      ? "Your subscription renews automatically each month. You can cancel at any time by emailing us."
      : "You have 12 months full access from today. If you need more time at the end of your year, just get in touch and we will sort it.";

  // Email HTML content
  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to Get Chartered AI</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter',Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%">

          <!-- HEADER -->
          <tr>
            <td style="background:#1d4ed8;border-radius:16px 16px 0 0;padding:36px 40px;text-align:center">
              <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.02em">Get Chartered AI</h1>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.65);letter-spacing:0.08em;text-transform:uppercase">Your Pathway to Chartership</p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">

              <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 8px;letter-spacing:-0.02em">Welcome — you're in. 🎉</p>
              <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0 0 28px">Your account is active and all 12 modules are ready for you right now.</p>

              <!-- PLAN CONFIRMATION -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-radius:10px;border:1px solid #dbeafe;margin-bottom:28px">
                <tr>
                  <td style="padding:18px 20px">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#2563EB">Your Plan</p>
                    <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#0f172a">${planText}</p>
                    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6">${planNote}</p>
                  </td>
                </tr>
              </table>

              <!-- WHAT'S INCLUDED -->
              <p style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 14px">What's waiting for you:</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
                ${[
                  ["01", "Preparing for RICS APC Exams", "Foundation"],
                  [
                    "02",
                    "Ethics, Conduct & Professionalism",
                    "Level 3 — Mandatory",
                  ],
                  ["03", "Client Care", "Level 2 — Mandatory"],
                  ["04", "Communication & Negotiation", "Level 2 — Mandatory"],
                  ["05", "Health & Safety in Surveying", "Level 2 — Mandatory"],
                  [
                    "06",
                    "Accounting Principles & Procedures",
                    "Level 1 — Mandatory",
                  ],
                  ["07", "Business Planning", "Level 1 — Mandatory"],
                  [
                    "08",
                    "Conflict Avoidance & Dispute Resolution",
                    "Level 2 — Mandatory",
                  ],
                  ["09", "Data Management", "Level 1 — Mandatory"],
                  ["10", "Sustainability", "Level 1 — Mandatory"],
                  [
                    "11",
                    "Team-Working, Diversity & Inclusion",
                    "Level 2 — Mandatory",
                  ],
                  ["12", "Revision, Mock Tests & APC Simulation", "Capstone"],
                ]
                  .map(
                    ([num, title, level]) => `
                <tr>
                  <td style="padding:7px 0;border-bottom:1px solid #f1f5f9">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="32" style="vertical-align:middle">
                          <span style="display:inline-block;width:24px;height:24px;background:#eff6ff;border-radius:50%;text-align:center;line-height:24px;font-size:10px;font-weight:700;color:#2563EB">${num}</span>
                        </td>
                        <td style="vertical-align:middle;padding-left:8px">
                          <span style="font-size:13px;font-weight:600;color:#0f172a">${title}</span>
                          <span style="font-size:11px;color:#94a3b8;margin-left:8px">${level}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`,
                  )
                  .join("")}
              </table>

              <!-- CTA BUTTON -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
                <tr>
                  <td align="center">
                    <a href="https://getcharteredai.netlify.app" style="display:inline-block;background:#2563EB;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:9px;letter-spacing:0.02em">Go to My Dashboard →</a>
                  </td>
                </tr>
              </table>

              <!-- LOGIN REMINDER -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:24px">
                <tr>
                  <td style="padding:16px 20px">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#64748b">Your Login</p>
                    <p style="margin:0;font-size:14px;color:#0f172a"><strong>Email:</strong> ${email}</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#64748b">Use the password you set when activating your account.</p>
                  </td>
                </tr>
              </table>

              <p style="font-size:14px;color:#64748b;line-height:1.75;margin:0">
                If you have any questions at all, reply to this email or contact us at 
                <a href="mailto:contact@getcharteredai.com" style="color:#2563EB;text-decoration:none">contact@getcharteredai.com</a>.
                We're here to support you every step of the way.
              </p>

              <p style="font-size:15px;font-weight:600;color:#0f172a;margin:24px 0 0">Good luck — you've got this. 💪</p>
              <p style="font-size:14px;color:#64748b;margin:4px 0 0">The Get Chartered AI Team</p>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f1f5f9;border-radius:0 0 16px 16px;padding:20px 40px;border:1px solid #e2e8f0;border-top:none;text-align:center">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6">
                Get Chartered AI · <a href="https://getcharteredai.netlify.app" style="color:#2563EB;text-decoration:none">getcharteredai.netlify.app</a><br>
                <a href="mailto:contact@getcharteredai.com" style="color:#94a3b8;text-decoration:none">contact@getcharteredai.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Plain text fallback
  const emailText = `
Welcome to Get Chartered AI

Your account is active and all 12 modules are ready.

Your plan: ${planText}
${planNote}

Go to your dashboard: https://getcharteredai.netlify.app

Your login email: ${email}

If you have any questions, email us at contact@getcharteredai.com

Good luck — The Get Chartered AI Team
`;

  // Send via Resend (free tier: 3,000 emails/month)
  // Sign up free at resend.com — add RESEND_API_KEY to Netlify env vars
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    console.log(
      "RESEND_API_KEY not set — email not sent but activation succeeded",
    );
    console.log(`Would have sent welcome email to: ${email}`);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        sent: false,
        reason: "No email API key configured",
      }),
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Get Chartered AI <welcome@getcharteredai.com>",
        to: [email],
        subject: "Welcome to Get Chartered AI — Your account is ready 🎉",
        html: emailHtml,
        text: emailText,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`Welcome email sent to ${email}`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ sent: true, id: result.id }),
      };
    } else {
      console.error("Email send failed:", result);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ sent: false, error: result.message }),
      };
    }
  } catch (err) {
    console.error("Email error:", err);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ sent: false, error: err.message }),
    };
  }
};
