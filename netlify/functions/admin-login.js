exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const { email, password, plan } = JSON.parse(event.body);

    if (email !== 'test@getcharteredai.com' || password !== 'testing911') {
      return { statusCode: 401, body: JSON.stringify({ success: false, error: 'Unauthorised' }) };
    }

    const validPlans = ['annual', 'monthly', 'sprint', 'referred', 'year-one', 'apprentice'];
    const resolvedPlan = validPlans.includes(plan) ? plan : 'annual';

    const activatedAt = Date.now();
    const payload = {
      email: 'test@getcharteredai.com',
      plan: resolvedPlan,
      activatedAt,
      expires: activatedAt + 365 * 24 * 60 * 60 * 1000
    };

    const jwtSecret = process.env.JWT_SECRET || 'gca-jwt-secret-2025-apc-platform-secure-x9k2m8z';
    const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
    const crypto = require('crypto');
    const signature = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
    const token = `${tokenData}.${signature}`;

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, token, email: payload.email, plan: resolvedPlan, activatedAt })
    };
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: e.message }) };
  }
};
