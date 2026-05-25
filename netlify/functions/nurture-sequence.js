// netlify/functions/nurture-sequence.js
// Sends email nurture sequence based on guide type and candidate stage
// Optional HTTP API for nurture emails. Day 3/10 follow-up is manual — see OPERATIONS.md

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = 'Angela at Get Chartered AI <info@getcharteredai.com>';

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) {
    console.log(`[NURTURE] Would send to ${to}: ${subject}`);
    return { sent: false };
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html })
  });
  return await r.json();
}

function emailWrapper(content) {
  return `<div style="font-family:'DM Sans',Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff">
    <div style="background:#0D0F1C;padding:24px 32px;border-radius:12px 12px 0 0">
      <span style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:#fff">Get Chartered <span style="color:#f59e0b">AI</span></span>
    </div>
    <div style="padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
      ${content}
    </div>
    <div style="padding:16px 32px;text-align:center">
      <p style="font-size:11px;color:#94a3b8;margin:0">Get Chartered AI · <a href="https://getcharteredai.com" style="color:#94a3b8">getcharteredai.com</a> · <a href="https://getcharteredai.com/guides" style="color:#94a3b8">Free Guides</a></p>
    </div>
  </div>`;
}

function getSequence(name, pathway, examDate, guideType) {
  const firstName = name.split(' ')[0];
  const urgent = ['Spring 2026 — sitting soon', 'Autumn 2026'].includes(examDate);
  const productUrl = urgent ? 'https://getcharteredai.com/sprint' : 'https://getcharteredai.com/#pricing-sec';
  const productName = urgent ? 'APC Sprint — £197' : 'Full Programme — from £39.90/month';
  const productPitch = urgent
    ? `With your assessment approaching, the APC Sprint gives you immediate access to all 11 mandatory competency revision sheets, a 60-minute AI-scored mock interview and Michael — your AI Tutor — available any time you need it.`
    : `The full Get Chartered AI programme gives you 12 structured modules across all 11 mandatory competencies, 861+ pathway questions and Michael — your AI Tutor — available 24 hours a day as your modules unlock.`;

  // Email 2 — Day 3: The insight email
  const email2 = {
    subject: `The one thing most ${pathway} APC candidates get wrong`,
    html: emailWrapper(`
      <p style="font-size:15px;color:#374151;line-height:1.7">Hi ${firstName},</p>
      <p style="font-size:15px;color:#374151;line-height:1.7">A quick thought, three days on from your guide download.</p>
      <p style="font-size:15px;color:#374151;line-height:1.7">The most common reason APC candidates are referred is not what most people think it is. It is not lack of technical knowledge. It is not insufficient experience. It is not even nerves on the day.</p>
      <p style="font-size:17px;font-weight:600;color:#0D0F1C;border-left:4px solid #f59e0b;padding-left:16px;margin:24px 0">It is writing — and speaking — about their work descriptively instead of evidentially.</p>
      <p style="font-size:15px;color:#374151;line-height:1.7">A candidate who says <em>"In my role I am responsible for client care and I understand the importance of clear communication"</em> has described their job. A candidate who says <em>"On a specific instruction, I identified that the client had not received the fee agreement in the required format. I prepared a revised letter of engagement, obtained their written confirmation and updated the file accordingly"</em> has evidenced Level 2 application.</p>
      <p style="font-size:15px;color:#374151;line-height:1.7">The difference is structural. Assessors can only score what you give them evidence of. Knowledge statements — however accurate — score nothing at Level 2.</p>
      <p style="font-size:15px;color:#374151;line-height:1.7">Every module in Get Chartered AI is built around that distinction — showing you what good looks like, not just what you need to know.</p>
      <a href="https://getcharteredai.com/why-candidates-are-referred" style="display:inline-block;background:#0D0F1C;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;margin-top:8px">Read: Why APC candidates are referred →</a>
      <p style="font-size:13px;color:#94a3b8;margin-top:24px">Angela<br>Get Chartered AI</p>
    `)
  };

  // Email 3 — Day 7: The self-reflection question
  const email3 = {
    subject: `A question worth sitting with before your next APC session`,
    html: emailWrapper(`
      <p style="font-size:15px;color:#374151;line-height:1.7">Hi ${firstName},</p>
      <p style="font-size:15px;color:#374151;line-height:1.7">One question. Answer it honestly, not as you wish it were true.</p>
      <p style="font-size:19px;font-weight:700;color:#0D0F1C;background:#eff6ff;border-radius:10px;padding:20px 24px;margin:24px 0;line-height:1.4">If your assessor asked you right now to evidence your Level 2 for Client Care — could you give a specific situation, name the RICS principle engaged, describe the judgement you made, the action you took and the outcome?</p>
      <p style="font-size:15px;color:#374151;line-height:1.7">Not a general description of your approach. A specific, real, documented professional situation.</p>
      <p style="font-size:15px;color:#374151;line-height:1.7">Most candidates — when they answer honestly — realise they have work to do on at least three of the eleven mandatory competencies. That is not a failure of ability. It is a preparation gap. And preparation gaps are fixable.</p>
      <p style="font-size:15px;color:#374151;line-height:1.7">The Get Chartered AI APC Assessors' Briefing covers the nine topics most likely to be probed in the autumn 2026 window — free to read, no registration required.</p>
      <a href="https://getcharteredai.com/hot-topics" style="display:inline-block;background:#0D0F1C;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;margin-top:8px">Read the APC Assessors' Briefing →</a>
      <p style="font-size:13px;color:#94a3b8;margin-top:24px">Angela<br>Get Chartered AI</p>
    `)
  };

  // Email 4 — Day 12: The offer
  const email4 = {
    subject: urgent
      ? `Your assessment is approaching — one specific suggestion`
      : `When you are ready — here is where to start`,
    html: emailWrapper(`
      <p style="font-size:15px;color:#374151;line-height:1.7">Hi ${firstName},</p>
      <p style="font-size:15px;color:#374151;line-height:1.7">${urgent
        ? `With ${examDate.toLowerCase()} to go, this is not the time for a general revision plan. It is the time for focused, high-impact preparation on the areas where candidates most commonly fall short.`
        : `At ${examDate.toLowerCase()}, you have time to prepare properly. The candidates who pass first time are not necessarily the most knowledgeable — they are the most structured in how they demonstrate what they know.`
      }</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin:24px 0">
        <p style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#2563EB;margin:0 0 8px">What I would suggest</p>
        <p style="font-size:15px;font-weight:700;color:#0D0F1C;margin:0 0 8px">${productName}</p>
        <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 16px">${productPitch}</p>
        <a href="${productUrl}" style="display:inline-block;background:#f59e0b;color:#0D0F1C;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">View the programme →</a>
      </div>
      <p style="font-size:14px;color:#6b7280;line-height:1.6">No pressure. If the timing is not right, the free guides are always there. But if you are serious about passing ${urgent ? 'this window' : 'first time'}, this is the most structured way to prepare.</p>
      <p style="font-size:13px;color:#94a3b8;margin-top:24px">Angela<br>Get Chartered AI</p>
    `)
  };

  return [email2, email3, email4];
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { email, name, pathway, examDate, guideType, emailIndex } = body;
  if (!email || !name || !emailIndex) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const sequence = getSequence(name, pathway || 'surveying', examDate || 'Not yet scheduled', guideType);
  const idx = parseInt(emailIndex) - 1;

  if (idx < 0 || idx >= sequence.length) {
    return { statusCode: 200, headers, body: JSON.stringify({ sent: false, reason: 'Index out of range' }) };
  }

  const emailToSend = sequence[idx];

  try {
    const result = await sendEmail(email, emailToSend.subject, emailToSend.html);
    console.log(`[NURTURE] Email ${emailIndex} sent to ${email}: ${emailToSend.subject}`);
    return { statusCode: 200, headers, body: JSON.stringify({ sent: true, subject: emailToSend.subject }) };
  } catch (err) {
    console.error('[NURTURE] Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Send failed' }) };
  }
};
