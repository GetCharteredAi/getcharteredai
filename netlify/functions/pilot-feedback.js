// netlify/functions/pilot-feedback.js
// Receives the pilot feedback form submission and emails results to the team.
// POST { token, feedback: { q1, q2, q3, q4, testimonialConsent } }

const crypto = require('crypto');

const PILOT_EXPIRES_AT = new Date('2026-11-14T23:59:59Z').getTime();

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function verifyPilotToken(token, jwtSecret) {
  if (!token) throw new Error('missing');
  const parts = token.split('.');
  if (parts.length !== 2) throw new Error('malformed');
  const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  if (payload.purpose !== 'mock-pilot') throw new Error('wrong-purpose');
  // Allow feedback submission even after expiry — candidate may submit after 7 Nov
  const expected = crypto.createHmac('sha256', jwtSecret).update(parts[0]).digest('base64url');
  if (parts[1] !== expected) throw new Error('invalid');
  return payload;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { token: pilotToken, feedback } = body;

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };

  let payload;
  try {
    payload = verifyPilotToken(pilotToken, jwtSecret);
  } catch {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid access link' }) };
  }

  if (!feedback) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No feedback provided' }) };

  const { q1, q2, q3, q4 } = feedback;
  const submittedAt = new Date().toISOString();
  const name = payload.candidateName || payload.email || 'Pilot candidate';

  if (process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Get Chartered AI <info@getcharteredai.com>',
          to: ['info@getcharteredai.com'],
          subject: `APC Mock Pilot — feedback from ${name}`,
          html: `
            <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 20px">
              <h2 style="color:#0f172a;font-size:18px">Pilot feedback — ${name}</h2>
              <p style="color:#64748b;font-size:13px">Submitted: ${submittedAt}</p>
              <table style="width:100%;border-collapse:collapse;margin-top:20px">
                <tr>
                  <td style="padding:12px 0;border-top:1px solid #e2e8f0;vertical-align:top;width:220px">
                    <strong style="font-size:13px;color:#334155">1. What was most useful?</strong>
                  </td>
                  <td style="padding:12px 0 12px 16px;border-top:1px solid #e2e8f0;font-size:13px;color:#1e293b;line-height:1.6">
                    ${(q1 || '—').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-top:1px solid #e2e8f0;vertical-align:top">
                    <strong style="font-size:13px;color:#334155">2. What felt unclear or less useful?</strong>
                  </td>
                  <td style="padding:12px 0 12px 16px;border-top:1px solid #e2e8f0;font-size:13px;color:#1e293b;line-height:1.6">
                    ${(q2 || '—').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-top:1px solid #e2e8f0;vertical-align:top">
                    <strong style="font-size:13px;color:#334155">3. Did it help you identify a useful focus?</strong>
                  </td>
                  <td style="padding:12px 0 12px 16px;border-top:1px solid #e2e8f0;font-size:13px;color:#1e293b">
                    ${q3 || '—'}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-top:1px solid #e2e8f0;vertical-align:top">
                    <strong style="font-size:13px;color:#334155">4. Willing to share a testimonial?</strong>
                  </td>
                  <td style="padding:12px 0 12px 16px;border-top:1px solid #e2e8f0;font-size:13px;color:#1e293b">
                    ${q4 || '—'}
                  </td>
                </tr>
              </table>
            </div>
          `,
          text: `Pilot feedback from ${name} (${submittedAt})\n\n1. What was most useful?\n${q1 || '—'}\n\n2. What felt unclear or less useful?\n${q2 || '—'}\n\n3. Did it help identify a focus?\n${q3 || '—'}\n\n4. Willing to share a testimonial?\n${q4 || '—'}`
        })
      });
    } catch (err) {
      console.error('[pilot-feedback] email error:', err.message);
    }
  }

  console.log(`[pilot-feedback] received from ${name}`);
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
};
