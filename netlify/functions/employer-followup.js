// netlify/functions/employer-followup.js
// Sends confirmation to employer + rich notification to Angela with full details

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = 'info@getcharteredai.com';
const FROM = 'Get Chartered AI <info@getcharteredai.com>';
const ANGELA = 'Angela at Get Chartered AI <info@getcharteredai.com>';

function wrap(content) {
  return `<div style="font-family:'DM Sans',Arial,sans-serif;max-width:580px;margin:0 auto;background:#fff">
    <div style="background:#0D0F1C;padding:20px 28px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center">
      <span style="font-family:Georgia,serif;font-size:17px;font-weight:700;color:#fff">Get Chartered <span style="color:#f59e0b">AI</span></span>
      <span style="font-size:11px;color:rgba(255,255,255,.4)">getcharteredai.com</span>
    </div>
    <div style="padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px">
      ${content}
    </div>
    <div style="padding:14px 28px;text-align:center">
      <p style="font-size:11px;color:#94a3b8;margin:0">Get Chartered AI &middot; <a href="https://getcharteredai.com" style="color:#94a3b8">getcharteredai.com</a> &middot; info@getcharteredai.com</p>
    </div>
  </div>`;
}

async function sendEmail(to, subject, html, text) {
  if (!RESEND_API_KEY) {
    console.log(`[EMPLOYER] Would send to ${to}: ${subject}`);
    return { sent: false };
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text })
  });
  return await r.json();
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { name, email, firm, cohortSize, message } = body;
  if (!email || !name) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };

  const cleanName = (name || '').trim();
  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanFirm = (firm || 'not provided').trim();
  const cleanCohort = (cohortSize || 'not specified').trim();
  const cleanMessage = (message || '').trim();
  const firstName = cleanName.split(' ')[0];

  // ── EMAIL 1: Confirmation to employer ─────────────────────────────────
  const confirmHtml = wrap(`
    <p style="font-size:15px;color:#374151;line-height:1.7">Hi ${firstName},</p>
    <p style="font-size:15px;color:#374151;line-height:1.7">Thank you for getting in touch. I will come back to you directly with details of how cohort access works — what candidates get, how it sits alongside your existing internal support and how pricing is structured for different cohort sizes.</p>
    <p style="font-size:15px;color:#374151;line-height:1.7">In the meantime, the document below may be useful:</p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:20px 0">
      <div>
        <div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#2563EB;margin-bottom:4px">Platform Overview</div>
        <div style="font-size:15px;font-weight:700;color:#0D0F1C;margin-bottom:4px">Employer Guide — Get Chartered AI</div>
        <p style="font-size:13px;color:#64748b;margin:0 0 10px;line-height:1.6">A two-page overview of what Get Chartered AI offers your firm, how cohort access works and what candidates get.</p>
        <a href="https://getcharteredai.com/employer-guide.pdf" style="font-size:13px;font-weight:700;color:#2563EB;text-decoration:none">Download PDF &rarr;</a>
      </div>
    </div>

    <p style="font-size:15px;color:#374151;line-height:1.7">I will be in touch shortly. Feel free to reply directly to this email with any questions in the meantime.</p>
    <p style="font-size:13px;color:#94a3b8;margin-top:24px;line-height:1.6">Angela<br>Founder, Get Chartered AI<br>info@getcharteredai.com</p>
  `);

  // ── EMAIL 2: Admin notification to Angela ──────────────────────────────
  const adminHtml = wrap(`
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;margin-bottom:20px">
      <div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#1d4ed8;margin-bottom:4px">New Employer Enquiry</div>
      <div style="font-size:16px;font-weight:700;color:#0D0F1C">${cleanName} — ${cleanFirm}</div>
    </div>

    <table style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:20px">
      <tr><td style="padding:8px 0;color:#64748b;width:120px;vertical-align:top">Name</td><td style="padding:8px 0;color:#1a1a2e;font-weight:600">${cleanName}</td></tr>
      <tr style="border-top:1px solid #f1f5f9"><td style="padding:8px 0;color:#64748b;vertical-align:top">Firm</td><td style="padding:8px 0;color:#1a1a2e;font-weight:600">${cleanFirm}</td></tr>
      <tr style="border-top:1px solid #f1f5f9"><td style="padding:8px 0;color:#64748b;vertical-align:top">Email</td><td style="padding:8px 0"><a href="mailto:${cleanEmail}" style="color:#2563EB;font-weight:600">${cleanEmail}</a></td></tr>
      <tr style="border-top:1px solid #f1f5f9"><td style="padding:8px 0;color:#64748b;vertical-align:top">Cohort size</td><td style="padding:8px 0;color:#1a1a2e;font-weight:600">${cleanCohort}</td></tr>
      ${cleanMessage ? `<tr style="border-top:1px solid #f1f5f9"><td style="padding:8px 0;color:#64748b;vertical-align:top">Message</td><td style="padding:8px 0;color:#374151;line-height:1.6">${cleanMessage}</td></tr>` : ''}
    </table>

    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px 18px;margin-bottom:20px">
      <div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#92400e;margin-bottom:8px">Suggested next reply</div>
      <p style="font-size:13px;color:#78350f;line-height:1.7;margin:0">Hi ${firstName},<br><br>
      Thank you for coming back to me. Based on a cohort of ${cleanCohort}, here is how access to Get Chartered AI works and how the pricing is structured...<br><br>
      [Add cohort pricing and specific details here]<br><br>
      Happy to answer any questions by email.<br><br>
      Kind regards,<br>Angela</p>
    </div>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px">
      <div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#166534;margin-bottom:8px">Attachments to include in your reply</div>
      <p style="font-size:13px;color:#166534;margin:0;line-height:1.7">
        &bull; <a href="https://getcharteredai.com/employer-guide.pdf" style="color:#166534">employer-guide.pdf</a>
      </p>
    </div>
  `);

  try {
    // Send confirmation to employer
    await sendEmail(
      cleanEmail,
      `Thank you for your enquiry — Get Chartered AI`,
      confirmHtml,
      `Hi ${firstName},\n\nThank you for getting in touch. I will come back to you directly with details of how cohort access works.\n\nIn the meantime, the Employer Guide may be useful: https://getcharteredai.com/employer-guide.pdf\n\nAngela\nFounder, Get Chartered AI`
    );

    // Notify Angela
    await sendEmail(
      ADMIN_EMAIL,
      `New employer enquiry — ${cleanName}, ${cleanFirm} (${cleanCohort})`,
      adminHtml,
      `New employer enquiry\n\nName: ${cleanName}\nFirm: ${cleanFirm}\nEmail: ${cleanEmail}\nCohort: ${cleanCohort}\nMessage: ${cleanMessage}\n\nConfirmation email sent to ${cleanEmail}.`
    );

    console.log(`[EMPLOYER] Enquiry from ${cleanName} at ${cleanFirm} — emails sent`);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('[EMPLOYER] Error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Email send failed' }) };
  }
};
