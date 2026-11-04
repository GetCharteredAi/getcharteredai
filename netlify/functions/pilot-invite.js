// netlify/functions/pilot-invite.js
// Admin-only: generate a time-limited pilot invite token, initialise credit state,
// and send the magic link by email.
// POST { adminKey, email, candidateName }
// Requires: P1_INTERNAL_SECRET, JWT_SECRET, RESEND_API_KEY

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const PILOT_PATHWAY    = 'Quantity Surveying and Construction';
const ASSESSMENT_DATE  = '14 November';
const COMPLETE_BY_DATE = '14 November';
const EXPIRES_AT = new Date('2026-11-14T23:59:59Z').getTime();

const INITIAL_CREDITS = {
  mockRemaining: 2,
  michaelRemaining: 18,
  tofyRemaining: 6,
  attempt1Started: false,
  attempt1Completed: false,
  attempt2Started: false,
  attempt2Completed: false,
  createdAt: 0  // set at generation time
};

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function tokenKey(token) {
  const sig = token.split('.')[1] || token;
  return crypto.createHash('sha256').update(sig).digest('hex');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { adminKey, email, candidateName, sendEmail } = body;

  const validKey = process.env.P1_INTERNAL_SECRET;
  if (!validKey || adminKey !== validKey) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorised' }) };
  }

  if (!email || !email.includes('@')) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required' }) };
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return { statusCode: 500, headers, body: JSON.stringify({ error: 'JWT_SECRET not configured' }) };

  const cleanEmail = email.toLowerCase().trim();
  const name = (candidateName || '').trim();

  const payload = {
    purpose: 'mock-pilot',
    pathway: PILOT_PATHWAY,
    assessmentDate: ASSESSMENT_DATE,
    completeBy: COMPLETE_BY_DATE,
    email: cleanEmail,
    candidateName: name,
    exp: EXPIRES_AT,
    iat: Date.now()
  };

  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
  const token = `${tokenData}.${sig}`;

  // Initialise credit state in Blobs
  try {
    const store = getStore({
      name: 'pilot-credits',
      siteID: process.env.SITE_ID || process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN,
    });
    const credits = { ...INITIAL_CREDITS, createdAt: Date.now() };
    await store.set(tokenKey(token), JSON.stringify(credits));
  } catch (err) {
    console.error('[pilot-invite] blobs write error:', err.message);
  }

  const link = `https://getcharteredai.com/apc-mock-pilot?token=${encodeURIComponent(token)}`;

  const skipEmail = sendEmail === false && process.env.NETLIFY_DEV === 'true';
  if (!skipEmail && process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Get Chartered AI <info@getcharteredai.com>',
          to: [cleanEmail],
          subject: 'APC Mock Interview Pilot — your practice session is ready',
          html: `
            <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
              <div style="background:#0D0F1C;border-radius:12px 12px 0 0;padding:28px;text-align:center">
                <p style="color:rgba(255,255,255,.45);font-size:11px;margin:0 0 6px;letter-spacing:.12em;text-transform:uppercase">APC Mock Interview Pilot</p>
                <h1 style="color:#fff;font-size:20px;margin:0;font-family:Georgia,serif">Get Chartered <span style="color:#2563EB">AI</span></h1>
              </div>
              <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
                <h2 style="font-size:18px;color:#0f172a;margin-bottom:8px">Hi ${name || 'there'},</h2>
                <p style="color:#334155;font-size:14px;line-height:1.7;margin-bottom:4px">
                  Your APC mock interview practice session is ready. This is a focused Quantity Surveying mock, designed to help you identify a small number of areas to practise before your assessment on 14 November.
                </p>
                <ul style="color:#334155;font-size:13px;line-height:1.9;margin:16px 0;padding-left:20px">
                  <li><strong>Pathway:</strong> Quantity Surveying</li>
                  <li><strong>Assessment date:</strong> 14 November</li>
                  <li><strong>Complete by:</strong> 14 November</li>
                  <li><strong>Time:</strong> approximately 45–60 minutes</li>
                </ul>
                <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;margin-bottom:20px">
                  <p style="font-size:12px;font-weight:700;color:#1d4ed8;margin:0 0 4px;letter-spacing:.05em;text-transform:uppercase">Your practice credits</p>
                  <p style="font-size:13px;color:#1e3a8a;margin:0;line-height:1.7">
                    2 mock interview attempts &nbsp;·&nbsp; 18 Michael practice credits &nbsp;·&nbsp; 6 Think on Your Feet challenges
                  </p>
                </div>
                <a href="${link}" style="display:block;background:#2563EB;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;text-align:center;margin-bottom:16px">
                  Start your mock interview →
                </a>
                <p style="font-size:12px;color:#94a3b8;margin:0;line-height:1.6">
                  This link is personal to you and expires on 14 November at 23:59. It does not predict your assessment outcome or replace guidance from your counsellor or supervisor.<br><br>
                  Questions? <a href="mailto:info@getcharteredai.com" style="color:#2563EB">info@getcharteredai.com</a>
                </p>
              </div>
            </div>
          `,
          text: `Hi ${name || 'there'},\n\nYour APC mock interview practice session is ready.\n\nPathway: Quantity Surveying\nAssessment date: 14 November\nComplete by: 14 November\nTime: approximately 45–60 minutes per mock\n\nYour practice credits: 2 mock interview attempts, 18 Michael practice credits, 6 Think on Your Feet challenges.\n\nStart here: ${link}\n\nThis link expires on 14 November at 23:59. This does not predict your assessment outcome or replace guidance from your counsellor or supervisor.\n\nQuestions? info@getcharteredai.com`
        })
      });
    } catch (err) {
      console.error('[pilot-invite] email error:', err.message);
    }
  }

  console.log(`[pilot-invite] invite generated for ${cleanEmail}`);
  return {
    statusCode: 200, headers,
    body: JSON.stringify({ success: true, link, email: cleanEmail })
  };
};
