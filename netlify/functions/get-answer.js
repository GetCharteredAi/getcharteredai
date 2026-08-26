// netlify/functions/get-answer.js
// Returns protected answer fields for a single question after token verification.
// The bulk get-questions.js response strips these fields; they are only served here,
// one question at a time, on explicit reveal.
const DATA = require('./questions-data.json');

const REVOKED_EMAILS = [
  'samperry991@gmail.com',
];

const VALID_PATHWAYS = new Set([
  'Rural',
  'Taxation Allowances',
  'Building Surveying',
  'Quantity Surveying and Construction',
  'Commercial Real Estate',
  'Valuation',
  'Infrastructure',
  'Residential',
  'Project Management',
  'Facility Management',
  'Planning and Development',
  'Property Finance and Investment',
  'Corporate Real Estate',
  'Management Consultancy',
  'Land and Resources',
  'Building Control',
]);

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function verifyToken(token) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET not configured');
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return null;
  const tokenData = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const crypto = require('crypto');
  const hmacSig = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
  const legacySig = Buffer.from(`${tokenData}.${jwtSecret}`).toString('base64').slice(0, 32);
  if (sig !== hmacSig && sig !== legacySig) return null;
  try {
    const payload = JSON.parse(Buffer.from(tokenData, 'base64').toString('utf8'));
    if (payload.expires && Date.now() > payload.expires) return null;
    return payload;
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { token, pathway, questionIndex } = body;
  if (!token) return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorised' }) };

  const payload = verifyToken(token);
  if (!payload) return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorised' }) };

  if (REVOKED_EMAILS.includes(payload.email?.toLowerCase())) {
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorised' }) };
  }

  if (!pathway || !VALID_PATHWAYS.has(pathway)) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Unknown pathway' }) };
  }

  const questions = DATA[pathway];
  if (!questions) {
    return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'No question bank for this pathway' }) };
  }

  const idx = parseInt(questionIndex, 10);
  if (isNaN(idx) || idx < 0 || idx >= questions.length) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid question index' }) };
  }

  const q = questions[idx];
  const { pass, high, referral, referralWhy, challenge, keyPoints } = q;

  console.log(`get-answer: ${payload.email} — pathway=${pathway} idx=${idx}`);
  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ pass, high, referral, referralWhy, challenge, keyPoints })
  };
};
