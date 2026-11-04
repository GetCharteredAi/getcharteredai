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
          subject: 'Your APC Mock Interview Pilot is ready',
          html: `
            <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
              <div style="background:#0D0F1C;border-radius:12px 12px 0 0;padding:28px;text-align:center">
                <p style="color:rgba(255,255,255,.45);font-size:11px;margin:0 0 6px;letter-spacing:.12em;text-transform:uppercase">APC Mock Interview Pilot</p>
                <h1 style="color:#fff;font-size:20px;margin:0;font-family:Georgia,serif">Get Chartered <span style="color:#2563EB">AI</span></h1>
              </div>
              <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
                <h2 style="font-size:18px;color:#0f172a;margin-bottom:16px">Hi ${name || 'there'},</h2>
                <p style="color:#334155;font-size:14px;line-height:1.7;margin-bottom:16px">
                  Your private Quantity Surveying APC Mock Interview Pilot is ready.
                </p>
                <p style="color:#334155;font-size:14px;line-height:1.7;margin-bottom:20px">
                  You have access to two mock interviews until 23:59 on 14 November. Each takes around 45–60 minutes.
                </p>
                <p style="color:#334155;font-size:14px;line-height:1.7;margin-bottom:8px">This mock lets you practise:</p>
                <ol style="color:#334155;font-size:14px;line-height:1.9;margin:0 0 20px;padding-left:20px">
                  <li>What you would say.</li>
                  <li>How you structure your answer.</li>
                  <li>The examples and RICS references you use.</li>
                  <li>Whether your reasoning is clear.</li>
                  <li>How much you can cover in two to three minutes.</li>
                </ol>
                <p style="color:#334155;font-size:14px;line-height:1.7;margin-bottom:24px">
                  You will type your answers in this mock. Write each response as you would say it aloud in an APC interview.
                </p>
                <a href="${link}" style="display:block;background:#2563EB;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;text-align:center;margin-bottom:24px">
                  Enter your mock interview →
                </a>
                <p style="font-size:13px;color:#64748b;line-height:1.7;margin-bottom:20px">
                  This is a private practice environment. It will help you identify what to strengthen, but it does not predict your assessment outcome or replace advice from your counsellor or supervisor.
                </p>
                <p style="font-size:13px;color:#334155;line-height:1.6;margin:0">
                  Best,<br>
                  Angela<br>
                  <span style="color:#64748b">Get Chartered AI</span>
                </p>
              </div>
            </div>
          `,
          text: `Hi ${name || 'there'},\n\nYour private Quantity Surveying APC Mock Interview Pilot is ready.\n\nYou have access to two mock interviews until 23:59 on 14 November. Each takes around 45–60 minutes.\n\nThis mock lets you practise:\n1. What you would say.\n2. How you structure your answer.\n3. The examples and RICS references you use.\n4. Whether your reasoning is clear.\n5. How much you can cover in two to three minutes.\n\nYou will type your answers in this mock. Write each response as you would say it aloud in an APC interview.\n\nEnter your mock interview: ${link}\n\nThis is a private practice environment. It will help you identify what to strengthen, but it does not predict your assessment outcome or replace advice from your counsellor or supervisor.\n\nBest,\nAngela\nGet Chartered AI`
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
