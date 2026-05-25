// netlify/functions/capture-grad-lead.js
// Captures graduate/apprenticeship lead and sends guide + rich admin follow-up prompt

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

  const { name, email, org, gradYear, pathway, guideType } = body;
  if (!name || !email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Name and email required' }) };

  const cleanEmail = email.toLowerCase().trim();
  const cleanName = name.trim();

  const guideUrl = guideType === 'assessment'
    ? 'https://getcharteredai.com/grad-assessment-guide.html'
    : guideType === 'apprenticeship'
    ? 'https://getcharteredai.com/apprentice-guide-info.html'
    : guideType === 'bs-interview'
    ? 'https://getcharteredai.com/grad-bs-guide.html'
    : guideType === 'qs-interview'
    ? 'https://getcharteredai.com/grad-qs-guide.html'
    : 'https://getcharteredai.com/grad-interview-guide.html';

  const guideTitle = guideType === 'assessment'
    ? 'Graduate Surveying — Assessment Day Prep'
    : guideType === 'apprenticeship'
    ? 'The Chartered Surveyor Apprenticeship Route'
    : guideType === 'bs-interview'
    ? 'Building Surveying — First Interview Prep'
    : guideType === 'qs-interview'
    ? 'Quantity Surveying — First Interview Prep'
    : 'Graduate Surveying — First Interview Prep';

  const guideTypeLabel = guideType === 'assessment' ? 'Assessment Day'
    : guideType === 'apprenticeship' ? 'Apprenticeship Route'
    : 'First Interview';

  // Follow-up dates
  const now = new Date();
  const day3 = new Date(now.getTime() + 3*24*60*60*1000).toDateString();
  const day10 = new Date(now.getTime() + 10*24*60*60*1000).toDateString();

  // Follow-up copy tailored by guide type
  const followUp3 = guideType === 'apprenticeship'
    ? `Hi ${cleanName},\n\nHope the apprenticeship guide was useful. One thing worth knowing that many applicants miss — firms often care more about commercial awareness and professional attitude than A-level grades. If you can speak confidently about what surveyors actually do and why you want to pursue chartership, you will stand out from most applicants.\n\nWe also have a free first interview prep guide if that is the next step for you:\nhttps://getcharteredai.com/grad-guide\n\n[Your name]\nGet Chartered AI`
    : guideType === 'assessment'
    ? `Hi ${cleanName},\n\nHope the assessment day guide was useful. One thing that catches a lot of candidates out — the group exercise is not about being the most impressive person in the room. It is about being the most professional. The candidates who bring quieter people in and help the group reach a conclusion consistently score better than those who dominate.\n\nGood luck with the day.\n\n[Your name]\nGet Chartered AI`
    : `Hi ${cleanName},\n\nHope the interview guide was useful. One thing worth preparing specifically — firms always ask "why this firm?" and most candidates give a generic answer. Spend 10 minutes finding one specific thing about the firm — a recent project, a sector they focus on, something from their LinkedIn — and work it into your answer. It makes a real difference.\n\n[Your name]\nGet Chartered AI`;

  const followUp10 = guideType === 'apprenticeship'
    ? `Hi ${cleanName},\n\nJust checking in — if you are actively applying for surveying apprenticeships, it is worth applying widely rather than targeting only the well-known firms. Regional practices, housing associations and local authorities often have fewer applicants and excellent training programmes.\n\nOnce you land your role and your APC journey begins, Get Chartered AI is built to support exactly that journey.\n\nhttps://getcharteredai.com\n\n[Your name]\nGet Chartered AI`
    : `Hi ${cleanName},\n\nJust a quick note — once you land your graduate role, your APC preparation begins from day one. Many new graduates wish they had started building their competency evidence earlier.\n\nWhen that time comes, Get Chartered AI covers all 12 modules, all 11 mandatory competencies and all 22 RICS pathways — with an AI Tutor and 60-minute mock interview built in.\n\nhttps://getcharteredai.com\n\n[Your name]\nGet Chartered AI`;

  if (process.env.RESEND_API_KEY) {
    try {
      // 1. Send guide to lead
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Get Chartered AI <info@getcharteredai.com>',
          to: [cleanEmail],
          subject: `Your free guide — ${guideTitle}`,
          html: `
            <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
              <div style="background:#0a0f1e;border-radius:12px 12px 0 0;padding:28px;text-align:center">
                <h1 style="font-family:Georgia,serif;color:#fff;font-size:20px;margin:0">Get Chartered <span style="color:#f59e0b">AI</span></h1>
              </div>
              <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
                <h2 style="font-size:18px;color:#0f172a;margin-bottom:8px">Hi ${cleanName} — here is your free guide</h2>
                <p style="color:#64748b;font-size:14px;line-height:1.7;margin-bottom:20px">Your copy of <strong>${guideTitle}</strong> is ready.</p>
                <a href="${guideUrl}" style="display:block;background:#2563EB;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;text-align:center;margin-bottom:20px">View Your Free Guide →</a>
                <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px;margin-bottom:16px">
                  <p style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#d97706;margin:0 0 4px">Once you land the role</p>
                  <p style="font-size:13px;color:#78350f;margin:0;line-height:1.6">Your APC journey begins from day one. <a href="https://getcharteredai.com" style="color:#d97706;font-weight:600">Get Chartered AI →</a></p>
                </div>
                <p style="color:#94a3b8;font-size:12px">Follow us: <a href="https://www.linkedin.com/company/getcharteredai" style="color:#2563EB">LinkedIn</a> · <a href="https://www.instagram.com/getcharteredai" style="color:#2563EB">Instagram</a></p>
              </div>
            </div>`,
          text: `Hi ${cleanName},\n\nYour guide: ${guideUrl}\n\nOnce you land the role, your APC begins. Get Chartered AI: https://getcharteredai.com\n\ninfo@getcharteredai.com`
        })
      });

      // 2. Rich admin notification with follow-up copy
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Get Chartered AI <info@getcharteredai.com>',
          to: ['info@getcharteredai.com'],
          subject: `🆕 Grad Lead — ${cleanName} · ${guideTypeLabel} · ${pathway || 'pathway TBC'}`,
          html: `
            <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#0f172a;margin-bottom:4px">New Graduate Guide Download</h2>
              <table style="border-collapse:collapse;width:100%;margin-bottom:20px">
                <tr><td style="padding:6px 0;font-size:13px;color:#64748b;width:140px">Name</td><td style="padding:6px 0;font-size:13px;color:#0f172a;font-weight:600">${cleanName}</td></tr>
                <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Email</td><td style="padding:6px 0;font-size:13px"><a href="mailto:${cleanEmail}" style="color:#2563EB">${cleanEmail}</a></td></tr>
                <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Organisation</td><td style="padding:6px 0;font-size:13px;color:#0f172a">${org || '—'}</td></tr>
                <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Grad year</td><td style="padding:6px 0;font-size:13px;color:#0f172a">${gradYear || '—'}</td></tr>
                <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Pathway</td><td style="padding:6px 0;font-size:13px;color:#0f172a">${pathway || '—'}</td></tr>
                <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Guide</td><td style="padding:6px 0;font-size:13px;color:#0f172a">${guideTitle}</td></tr>
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
          text: `New grad lead: ${cleanName} | ${cleanEmail} | ${pathway} | ${guideTitle}\n\nFOLLOW UP on ${day3}:\n${followUp3}\n\n---\nFOLLOW UP on ${day10}:\n${followUp10}`
        })
      });

    } catch(err) { console.error('Email error:', err.message); }
  }

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
};
