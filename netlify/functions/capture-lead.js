// netlify/functions/capture-lead.js
// Captures APC guide lead, sends guide email, sends rich follow-up prompt to admin

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

  const { name, email, pathway, examDate } = body;
  if (!name || !email || !pathway || !examDate) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'All fields required' }) };
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanName = name.trim();
  const guideUrl = body.guideType === 'confidence-checklist'
    ? 'https://getcharteredai.com/confidence-checklist.pdf'
    : body.guideType === 'competency-checker'
    ? 'https://getcharteredai.com/competency-checker'
    : body.guideType === 'hot-topics'
    ? 'https://getcharteredai.com/hot-topics'
    : body.guideType === 'assocrics'
    ? 'https://getcharteredai.com/assocrics-guide'
    : body.guideType === 'guides-unlock'
    ? 'https://getcharteredai.com/guides'
    : body.guideType === 'referred-candidate'
    ? 'https://getcharteredai.com/referred-guide'
    : body.guideType === 'counsellor-guide'
    ? 'https://getcharteredai.com/counsellor-guide'
    : 'https://getcharteredai.com/apc-guide.html';

  // Determine urgency and product recommendation
  const veryUrgent = examDate === 'Within 4 weeks';
  const urgent = examDate === '1–3 months';
  const nearTerm = examDate === '3–6 months';
  const product = veryUrgent || urgent ? 'sprint' : 'full';
  const productUrl = veryUrgent || urgent ? 'https://getcharteredai.com/sprint' : 'https://getcharteredai.com/#pricing-sec';
  const productName = veryUrgent || urgent ? 'APC Sprint (£297)' : 'Full Programme (£39.90/month or £383/year)';

  // Follow-up dates
  const now = new Date();
  const day3 = new Date(now.getTime() + 3*24*60*60*1000).toDateString();
  const day10 = new Date(now.getTime() + 10*24*60*60*1000).toDateString();

  // Sprint nudge in guide email
  const sprintNudge = (veryUrgent || urgent)
    ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:20px 0">
        <p style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#d97706;margin:0 0 6px">Your assessment is approaching</p>
        <p style="font-size:13px;color:#78350f;margin:0;line-height:1.6">With ${examDate.toLowerCase()} until your assessment, the APC Sprint gives you instant access to revision, AI Tutor and a full 60-minute mock interview. <a href="https://getcharteredai.com/sprint" style="color:#d97706;font-weight:600">See the Sprint →</a></p>
      </div>`
    : '';

  // Follow-up email copy — Day 3
  const followUp3 = product === 'sprint'
    ? `Hi ${cleanName},\n\nHope the guide was useful. One thing that catches a lot of candidates out in their ${pathway} assessment — the panel will push hard on your case study decisions, not just your competency knowledge.\n\nIf you want to practise that pressure before the real thing, the APC Sprint includes a full 60-minute mock interview tailored to your pathway. Most candidates who use it say the first run is humbling — and the second is where confidence starts to build.\n\n${productUrl}\n\nGood luck with your preparation.\n\n[Your name]\nGet Chartered AI`
    : `Hi ${cleanName},\n\nHope the guide was useful. One thing worth knowing about the ${pathway} pathway — assessors consistently probe the same areas across candidates. For your pathway that usually means [insert pathway-specific tip].\n\nIf you want structured preparation that covers all 11 mandatory competencies plus your specific pathway questions, the Get Chartered AI full programme is built exactly for that.\n\n${productUrl}\n\nAny questions — just reply to this email.\n\n[Your name]\nGet Chartered AI`;

  // Follow-up email copy — Day 10
  const followUp10 = product === 'sprint'
    ? `Hi ${cleanName},\n\nJust checking in — your assessment must be getting close now.\n\nIf you have not had a chance to look at the APC Sprint yet, it is worth knowing that the mock interview and AI Tutor are available the moment you sign up. No setup, no waiting. Candidates typically get through the mock interview 2-3 times in the days before assessment.\n\n${productUrl}\n\nWishing you the best.\n\n[Your name]\nGet Chartered AI`
    : `Hi ${cleanName},\n\nJust a quick note — if you are starting to think seriously about APC preparation, the earlier you begin the better. The full Get Chartered AI programme unlocks one module a month, so candidates who start earlier have more time to absorb each competency properly.\n\nFirst month is just £39.90 and you can cancel any time.\n\n${productUrl}\n\n[Your name]\nGet Chartered AI`;

  if (process.env.RESEND_API_KEY) {
    try {
      // 1. Send guide to lead
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Get Chartered AI <info@getcharteredai.com>',
          to: [cleanEmail],
          subject: body.guideType === 'confidence-checklist'
            ? 'Your APC Confidence Checklist — free download'
            : 'Your free APC guide — What Assessors Are Actually Looking For',
          html: `
            <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
              <div style="background:#0a0f1e;border-radius:12px 12px 0 0;padding:28px;text-align:center">
                <h1 style="font-family:Georgia,serif;color:#fff;font-size:20px;margin:0">Get Chartered <span style="color:#f59e0b">AI</span></h1>
              </div>
              <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
                <h2 style="font-size:18px;color:#0f172a;margin-bottom:8px">Hi ${cleanName} — here is your free guide</h2>
                <p style="color:#64748b;font-size:14px;line-height:1.7;margin-bottom:20px">Your copy of <strong>The 11 Mandatory Competencies — What Assessors Are Actually Looking For</strong> is ready.</p>
                <a href="${guideUrl}" style="display:block;background:#2563EB;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;text-align:center;margin-bottom:16px">View &amp; Save Your Free Guide →</a>
                ${sprintNudge}
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-top:16px">
                  <p style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin:0 0 6px">Your details</p>
                  <p style="font-size:13px;color:#475569;margin:0">Pathway: <strong style="color:#0f172a">${pathway}</strong><br>Assessment: <strong style="color:#0f172a">${examDate}</strong></p>
                </div>
                <p style="color:#94a3b8;font-size:12px;margin-top:20px">Questions? <a href="mailto:info@getcharteredai.com" style="color:#2563EB">info@getcharteredai.com</a></p>
              </div>
            </div>`,
          text: `Hi ${cleanName},\n\nYour free APC guide: ${guideUrl}\n\nPathway: ${pathway}\nAssessment: ${examDate}\n\ninfo@getcharteredai.com`
        })
      });

      // 2. Send rich admin notification with ready-to-send follow-ups
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Get Chartered AI <info@getcharteredai.com>',
          to: ['info@getcharteredai.com'],
          subject: `🆕 Lead — ${cleanName} · ${pathway} · ${examDate}${veryUrgent ? ' ⚡ URGENT' : ''}`,
          html: `
            <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#0f172a;margin-bottom:4px">New APC Guide Download</h2>
              <table style="border-collapse:collapse;width:100%;margin-bottom:20px">
                <tr><td style="padding:6px 0;font-size:13px;color:#64748b;width:120px">Name</td><td style="padding:6px 0;font-size:13px;color:#0f172a;font-weight:600">${cleanName}</td></tr>
                <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Email</td><td style="padding:6px 0;font-size:13px;color:#0f172a"><a href="mailto:${cleanEmail}">${cleanEmail}</a></td></tr>
                <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Pathway</td><td style="padding:6px 0;font-size:13px;color:#0f172a">${pathway}</td></tr>
                <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Assessment</td><td style="padding:6px 0;font-size:13px;color:#0f172a;font-weight:600${veryUrgent ? ';color:#dc2626' : urgent ? ';color:#d97706' : ''}">${examDate}${veryUrgent ? ' ⚡' : ''}</td></tr>
                <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Recommend</td><td style="padding:6px 0;font-size:13px;color:#0f172a"><a href="${productUrl}" style="color:#2563EB;font-weight:600">${productName}</a></td></tr>
              </table>

              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:16px">
                <p style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#16a34a;margin:0 0 8px">📅 Send follow-up on ${day3} (3 days)</p>
                <p style="font-size:12px;color:#166534;margin:0 0 8px"><strong>To:</strong> ${cleanEmail}</p>
                <pre style="font-family:Inter,Arial,sans-serif;font-size:12px;color:#1e293b;background:#fff;padding:12px;border-radius:6px;border:1px solid #e2e8f0;white-space:pre-wrap;margin:0">${followUp3}</pre>
              </div>

              <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px">
                <p style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#1d4ed8;margin:0 0 8px">📅 Send follow-up on ${day10} (10 days)</p>
                <p style="font-size:12px;color:#1e3a8a;margin:0 0 8px"><strong>To:</strong> ${cleanEmail}</p>
                <pre style="font-family:Inter,Arial,sans-serif;font-size:12px;color:#1e293b;background:#fff;padding:12px;border-radius:6px;border:1px solid #e2e8f0;white-space:pre-wrap;margin:0">${followUp10}</pre>
              </div>
            </div>`,
          text: `New lead: ${cleanName} | ${cleanEmail} | ${pathway} | ${examDate}\n\nRecommend: ${productName}\n\nFOLLOW UP on ${day3}:\nTo: ${cleanEmail}\n\n${followUp3}\n\n---\nFOLLOW UP on ${day10}:\nTo: ${cleanEmail}\n\n${followUp10}`
        })
      });

    } catch(err) { console.error('Email error:', err.message); }
  }

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
};
