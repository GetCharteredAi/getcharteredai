// netlify/functions/get-modules.js
// Phase 2: serves pathway-specific M11B module + pathwayOnly sections from M12/CR05.
// Data is loaded once at module level so warm invocations skip the require() parse.
const DATA = require('./modules-data.json');

const REVOKED_EMAILS = [
  'samperry991@gmail.com',
];

const PATHWAY_TO_MODULE_ID = {
  'Rural':                          20,
  'Taxation Allowances':            21,
  'Building Surveying':             22,
  'Quantity Surveying and Construction': 23,
  'Commercial Real Estate':         24,
  'Valuation':                      25,
  'Infrastructure':                 26,
  'Residential':                    27,
  'Project Management':             28,
  'Facility Management':            29,
  'Planning and Development':       30,
  'Property Finance and Investment':31,
  'Corporate Real Estate':          32,
  'Management Consultancy':         33,
  'Land and Resources':             34,
  'Building Control':               35,
};

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function verifyToken(token) {
  const jwtSecret = process.env.JWT_SECRET || 'gca-jwt-secret-2025-apc-platform-secure-x9k2m8z';
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

  const { token, pathway } = body;
  if (!token) return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorised' }) };

  const payload = verifyToken(token);
  if (!payload) return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorised' }) };

  if (REVOKED_EMAILS.includes(payload.email?.toLowerCase())) {
    console.log(`Blocked revoked account from get-modules: ${payload.email}`);
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorised' }) };
  }

  const moduleId = PATHWAY_TO_MODULE_ID[pathway];
  if (!moduleId) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Unknown pathway' }) };

  const m11bModule    = DATA.m11b.find(m => m.id === moduleId);
  const m12Sections   = DATA.m12PathwaySections.filter(s => s.pathwayOnly === pathway);
  const cr05Sections  = DATA.cr05PathwaySections.filter(s => s.pathwayOnly === pathway);

  console.log(`get-modules: ${payload.email} — pathway=${pathway} moduleId=${moduleId}`);
  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ m11bModule, m12Sections, cr05Sections })
  };
};
