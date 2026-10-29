// netlify/functions/capture-manager-capacity-check.js
// Captures Manager Capacity Check practical-summary requests and notifies admin

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

  const { name, email, company, people, priority, support, selectedStatements, resultSignal, selectedCount } = body;
  if (!name || !email || !company) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Name, email and company required' }) };
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanName  = name.trim();
  const cleanCo    = company.trim();

  const statementsHtml = Array.isArray(selectedStatements) && selectedStatements.length
    ? selectedStatements.map(s => `<li style="padding:6px 0;border-top:1px solid #e2e8f0;font-size:13px;color:#0f172a">${s}</li>`).join('')
    : '<li style="font-size:13px;color:#64748b">None selected</li>';

  const statementsText = Array.isArray(selectedStatements) && selectedStatements.length
    ? selectedStatements.map((s, i) => `  ${i + 1}. ${s}`).join('\n')
    : '  None selected';

  if (process.env.RESEND_API_KEY) {
    try {
      // Admin notification
      await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type':  'application/json'
        },
        body: JSON.stringify({
          from:    'Get Chartered AI <info@getcharteredai.com>',
          to:      ['info@getcharteredai.com'],
          subject: `Manager Capacity Check – Practical Summary Request`,
          html: `
            <div style="font-family:Inter,Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px">
              <h2 style="color:#0f172a;margin-bottom:4px;font-size:20px">Manager Capacity Check — Practical Summary Request</h2>
              <p style="font-size:13px;color:#64748b;margin-bottom:20px">Submitted via getcharteredai.com/manager-capacity-check</p>

              <table style="border-collapse:collapse;width:100%;margin-bottom:24px">
                <tr><td style="padding:7px 0;font-size:13px;color:#64748b;width:160px">Name</td><td style="padding:7px 0;font-size:13px;color:#0f172a;font-weight:600">${cleanName}</td></tr>
                <tr><td style="padding:7px 0;font-size:13px;color:#64748b">Email</td><td style="padding:7px 0;font-size:13px"><a href="mailto:${cleanEmail}" style="color:#2563EB">${cleanEmail}</a></td></tr>
                <tr><td style="padding:7px 0;font-size:13px;color:#64748b">Business</td><td style="padding:7px 0;font-size:13px;color:#0f172a">${cleanCo}</td></tr>
              </table>

              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px">
                <p style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#16a34a;margin:0 0 10px">Check Result</p>
                <p style="font-size:14px;font-weight:600;color:#14532d;margin:0 0 6px">Signal: ${resultSignal || '—'}</p>
                <p style="font-size:13px;color:#166534;margin:0">Statements selected: ${selectedCount || 0} of 7</p>
              </div>

              <div style="margin-bottom:20px">
                <p style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#475569;margin:0 0 8px">Selected Statements</p>
                <ul style="padding-left:0;margin:0;list-style:none">${statementsHtml}</ul>
              </div>

              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px">
                <p style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#475569;margin:0 0 10px">Follow-on Answers</p>
                <table style="border-collapse:collapse;width:100%">
                  <tr><td style="padding:5px 0;font-size:12px;color:#64748b;width:200px">Who are you developing?</td><td style="padding:5px 0;font-size:13px;color:#0f172a">${people || '—'}</td></tr>
                  <tr><td style="padding:5px 0;font-size:12px;color:#64748b">Priority next 12 months</td><td style="padding:5px 0;font-size:13px;color:#0f172a">${priority || '—'}</td></tr>
                  <tr><td style="padding:5px 0;font-size:12px;color:#64748b">Development support today</td><td style="padding:5px 0;font-size:13px;color:#0f172a">${support || '—'}</td></tr>
                </table>
              </div>
            </div>`,
          text: `Manager Capacity Check — Practical Summary Request\n\nName: ${cleanName}\nEmail: ${cleanEmail}\nBusiness: ${cleanCo}\n\nResult signal: ${resultSignal || '—'}\nStatements selected: ${selectedCount || 0} of 7\n\nSelected statements:\n${statementsText}\n\nFollow-on answers:\n  Who developing: ${people || '—'}\n  Priority: ${priority || '—'}\n  Support today: ${support || '—'}`
        })
      });

      // Confirmation to submitter
      await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type':  'application/json'
        },
        body: JSON.stringify({
          from:    'Get Chartered AI <info@getcharteredai.com>',
          to:      [cleanEmail],
          subject: 'Your Manager Capacity Check — practical summary',
          html: `
            <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
              <div style="background:#0d2a20;border-radius:12px 12px 0 0;padding:28px;text-align:center">
                <h1 style="font-family:Georgia,serif;color:#fff;font-size:20px;margin:0">Get Chartered <span style="color:#b99a56">AI</span></h1>
              </div>
              <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
                <h2 style="font-size:18px;color:#10291f;margin-bottom:8px">Hi ${cleanName} — thank you.</h2>
                <p style="color:#52655b;font-size:14px;line-height:1.7;margin-bottom:20px">We have received your Manager Capacity Check and the answers you have provided. We will draw on those to put together a practical summary for <strong>${cleanCo}</strong>.</p>
                <div style="background:#eaf1eb;border-left:3px solid #174b35;padding:14px 16px;margin-bottom:20px">
                  <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#2e806b;margin:0 0 4px">Your result</p>
                  <p style="font-size:14px;font-weight:600;color:#10291f;margin:0">${resultSignal || 'Pattern identified'}</p>
                </div>
                <p style="color:#52655b;font-size:13px;line-height:1.7;margin-bottom:0">If you have any questions in the meantime, reply to this email or contact <a href="mailto:info@getcharteredai.com" style="color:#2563EB">info@getcharteredai.com</a>.</p>
              </div>
            </div>`,
          text: `Hi ${cleanName},\n\nThank you for completing the Manager Capacity Check.\n\nYour result: ${resultSignal || '—'}\n\nWe will draw on your answers to prepare a practical summary for ${cleanCo}.\n\nAny questions: info@getcharteredai.com`
        })
      });

    } catch (err) {
      console.error('Email error:', err.message);
    }
  }

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
};
