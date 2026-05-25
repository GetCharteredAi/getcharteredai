// netlify/functions/send-welcome.js
// Sends welcome email via Resend (no npm needed)

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { email, plan } = body;
  if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };

  const planText = plan === 'monthly' ? 'Monthly Subscription (£39.90/month)' : 'Full Year Access — All 12 Modules (£383.04)';
  const planNote = plan === 'monthly'
    ? 'Module 1 is unlocked now. A new module unlocks each month. Your subscription automatically ends after module 12 is delivered.'
    : 'All 12 modules are unlocked immediately. You have 18 months full access — giving you plenty of time to study right up to your assessment date.';

  if (!process.env.RESEND_API_KEY) {
    console.log(`Welcome email would send to ${email} — RESEND_API_KEY not set`);
    return { statusCode: 200, headers, body: JSON.stringify({ sent: false, reason: 'No API key' }) };
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Get Chartered AI <info@getcharteredai.com>',
        to: [email],
        subject: 'Welcome to Get Chartered AI — Your account is ready 🎉',
        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
          <div style="background:#1d4ed8;border-radius:12px 12px 0 0;padding:28px;text-align:center">
            <h1 style="color:#fff;font-size:22px;margin:0">Get Chartered AI</h1>
            <p style="color:rgba(255,255,255,.65);font-size:12px;margin:6px 0 0;letter-spacing:.1em;text-transform:uppercase">Your Pathway to Chartership</p>
          </div>
          <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none">
            <h2 style="font-size:20px;color:#0f172a;margin:0 0 8px">Welcome — you're in! 🎉</h2>
            <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 20px">Your account is active and your modules are ready.</p>
            <div style="background:#eff6ff;border:1px solid #dbeafe;border-radius:8px;padding:16px;margin-bottom:20px">
              <p style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#2563EB;margin:0 0 4px">Your Plan</p>
              <p style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 6px">${planText}</p>
              <p style="font-size:13px;color:#64748b;margin:0">${planNote}</p>
            </div>
            <p style="font-size:14px;color:#64748b;margin:0 0 20px">Your login email: <strong style="color:#0f172a">${email}</strong></p>
            <a href="https://getcharteredai.com?login=1" style="display:inline-block;background:#2563EB;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Go to My Dashboard →</a>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin-top:16px">
              <p style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin:0 0 4px">Your login details</p>
              <p style="font-size:13px;color:#0f172a;margin:0">Email: <strong>${email}</strong><br>Use the password you set at checkout. Click the button above to go straight to your login page.</p>
            </div>
            <p style="font-size:13px;color:#64748b;margin:16px 0 0">Questions? <a href="mailto:info@getcharteredai.com" style="color:#2563EB">info@getcharteredai.com</a></p>
            <p style="font-size:14px;font-weight:600;color:#0f172a;margin:16px 0 0">Good luck — you've got this. 💪</p>
          </div>
          <div style="background:#f1f5f9;border-radius:0 0 12px 12px;padding:16px;text-align:center;border:1px solid #e2e8f0;border-top:none">
            <p style="font-size:12px;color:#94a3b8;margin:0">© 2025 Get Chartered AI · <a href="https://getcharteredai.com" style="color:#2563EB;text-decoration:none">getcharteredai.com</a></p>
          </div>
        </div>`,
        text: `Welcome to Get Chartered AI!\n\nYour plan: ${planText}\n${planNote}\n\nLogin: ${email}\nDashboard: https://getcharteredai.com\n\nQuestions? info@getcharteredai.com`
      })
    });
    const result = await r.json();
    return { statusCode: 200, headers, body: JSON.stringify({ sent: true, id: result.id }) };
  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ sent: false, error: err.message }) };
  }
};
