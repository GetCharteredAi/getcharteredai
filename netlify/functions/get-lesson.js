// netlify/functions/get-lesson.js
// Authenticated lesson delivery for all GCA programmes.
// Verifies JWT + plan entitlement before returning module content.

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const DATA = require('./lessons-data.json');

const REVOKED_EMAILS = [
  'samperry991@gmail.com',
];

// Pathway name → module ID map (mirrors get-modules.js)
const PATHWAY_TO_MODULE_ID = {
  'Rural':                               20,
  'Taxation Allowances':                 21,
  'Building Surveying':                  22,
  'Quantity Surveying and Construction': 23,
  'Commercial Real Estate':              24,
  'Valuation':                           25,
  'Infrastructure':                      26,
  'Residential':                         27,
  'Project Management':                  28,
  'Facility Management':                 29,
  'Planning and Development':            30,
  'Property Finance and Investment':     31,
  'Corporate Real Estate':               32,
  'Management Consultancy':              33,
  'Land and Resources':                  34,
  'Building Control':                    35,
};

// Referred programme module IDs — explicit set, not a range
const REFERRED_MODULE_IDS = new Set([12, 13, 14, 15, 16, 17, 18, 19, 36]);

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function verifyToken(token) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET not configured');
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return null;
  const tokenData = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const hmacSig = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
  const legacySig = Buffer.from(`${tokenData}.${jwtSecret}`).toString('base64').slice(0, 32);
  if (sig !== hmacSig && sig !== legacySig) return null;
  try {
    const payload = JSON.parse(Buffer.from(tokenData, 'base64').toString('utf8'));
    if (payload.expires && Date.now() > payload.expires) return null;
    return payload;
  } catch { return null; }
}

// Monthly time-based unlock count
function getMonthlyUnlockCount(activatedAt) {
  const elapsed = Date.now() - activatedAt;
  return Math.min(Math.floor(elapsed / (30 * 24 * 60 * 60 * 1000)) + 1, 12);
}

// ── Pathway lookup for tokens without a pathway field ────────────────────────
// Uses Blobs cache (24h TTL) to avoid per-request Stripe calls.
// Returns the pathway string, or null if not found.
async function lookupPathwayFromStripe(email) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return null;
  try {
    const custResp = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=5`,
      { headers: { 'Authorization': `Bearer ${stripeKey}` } }
    );
    if (!custResp.ok) return null;
    const custData = await custResp.json();
    if (!custData.data?.length) return null;

    for (const customer of custData.data) {
      // Check subscription metadata (monthly)
      const subResp = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${customer.id}&status=active&limit=1`,
        { headers: { 'Authorization': `Bearer ${stripeKey}` } }
      );
      if (subResp.ok) {
        const subData = await subResp.json();
        const pathway = subData.data?.[0]?.metadata?.rics_pathway?.trim();
        if (pathway) return pathway;
      }

      // Check payment intent metadata (one-time plans)
      const piResp = await fetch(
        `https://api.stripe.com/v1/payment_intents?customer=${customer.id}&limit=5`,
        { headers: { 'Authorization': `Bearer ${stripeKey}` } }
      );
      if (!piResp.ok) continue;
      const piData = await piResp.json();
      const paid = piData.data?.find(p => p.status === 'succeeded');
      if (paid?.metadata?.rics_pathway?.trim()) return paid.metadata.rics_pathway.trim();
    }
    return null;
  } catch { return null; }
}

// Returns resolved pathway string or null. Checks JWT first, then Blobs cache, then Stripe.
async function resolvePathway(payload) {
  if (payload.pathway) return payload.pathway;

  const email = payload.email;
  const cacheStore = process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore('pathway-cache')
    : getStore({ name: 'pathway-cache', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });

  // Check Blobs cache
  try {
    const cached = await cacheStore.get(email, { type: 'json' });
    if (cached && cached.pathway && cached.expiresAt > Date.now()) {
      console.log(`pathway-cache hit: ${email} → ${cached.pathway}`);
      return cached.pathway;
    }
  } catch { /* cache miss */ }

  // Lookup from Stripe
  console.log(`pathway-cache miss: ${email} — querying Stripe`);
  const pathway = await lookupPathwayFromStripe(email);

  // Cache the result (24h TTL), including null (to avoid hammering Stripe on repeated misses)
  try {
    await cacheStore.set(email, JSON.stringify({
      pathway: pathway || null,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    }));
  } catch { /* non-fatal */ }

  return pathway || null;
}

// ── Entitlement check ─────────────────────────────────────────────────────────
// Returns { allowed: bool, reason: string }
async function checkEntitlement(payload, moduleId) {
  const { plan, activatedAt } = payload;
  const isPathwayModule = moduleId >= 20 && moduleId <= 35;

  // Pathway module: resolve pathway server-side and validate
  if (isPathwayModule) {
    const pathway = await resolvePathway(payload);
    if (!pathway) {
      return { allowed: false, reason: 'PATHWAY_REFRESH' };
    }
    const expectedId = PATHWAY_TO_MODULE_ID[pathway];
    if (expectedId !== moduleId) {
      return { allowed: false, reason: 'PATHWAY_MISMATCH' };
    }
    // Pathway check passed — now verify plan-level eligibility for pathway modules
    let unlockCount;
    if (plan === 'annual') { unlockCount = 12; }
    else if (plan === 'sprint') { unlockCount = 12; }
    else if (plan === 'referred') { unlockCount = 12; }
    else if (plan === 'monthly') { unlockCount = getMonthlyUnlockCount(activatedAt); }
    else if (plan === 'selfpaced') {
      // Preserve existing behaviour: selfpaced pathway module uses time-based count
      // (same as client-side isModuleUnlocked — pre-existing condition, not changed here)
      unlockCount = getMonthlyUnlockCount(activatedAt);
    } else {
      return { allowed: false, reason: 'PLAN_NO_PATHWAY' };
    }
    if (unlockCount < 11) return { allowed: false, reason: 'NOT_YET_UNLOCKED' };
    return { allowed: true, reason: 'ok' };
  }

  // Core module entitlement per plan
  switch (plan) {
    case 'annual':
      return { allowed: moduleId >= 1 && moduleId <= 12, reason: moduleId >= 1 && moduleId <= 12 ? 'ok' : 'NOT_IN_PLAN' };

    case 'monthly': {
      const n = getMonthlyUnlockCount(activatedAt);
      return { allowed: moduleId >= 1 && moduleId <= n, reason: moduleId >= 1 && moduleId <= n ? 'ok' : 'NOT_YET_UNLOCKED' };
    }

    case 'sprint':
      return { allowed: moduleId === 1 || moduleId === 12, reason: (moduleId === 1 || moduleId === 12) ? 'ok' : 'NOT_IN_PLAN' };

    case 'referred':
      return { allowed: REFERRED_MODULE_IDS.has(moduleId), reason: REFERRED_MODULE_IDS.has(moduleId) ? 'ok' : 'NOT_IN_PLAN' };

    case 'selfpaced': {
      // Blobs lookup for unlocked module list
      try {
        const store = process.env.NETLIFY_BLOBS_CONTEXT
          ? getStore('selfpaced-progress')
          : getStore({ name: 'selfpaced-progress', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
        const record = await store.get(payload.email, { type: 'json' });
        const unlocked = record?.unlockedModules || [1];
        return { allowed: unlocked.includes(moduleId), reason: unlocked.includes(moduleId) ? 'ok' : 'NOT_YET_UNLOCKED' };
      } catch {
        // Blobs unavailable — default to Module 1 only
        return { allowed: moduleId === 1, reason: moduleId === 1 ? 'ok' : 'NOT_YET_UNLOCKED' };
      }
    }

    case 'year-one':
    case 'apprentice':
      // These plans use separate pages; not entitled to main programme content
      return { allowed: false, reason: 'WRONG_PLAN' };

    default:
      return { allowed: false, reason: 'UNKNOWN_PLAN' };
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { token, moduleId } = body;
  if (!token) return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorised' }) };
  if (typeof moduleId !== 'number') return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'moduleId required' }) };

  const payload = verifyToken(token);
  if (!payload) return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorised' }) };

  if (REVOKED_EMAILS.includes(payload.email?.toLowerCase())) {
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorised' }) };
  }

  const module = DATA.find(m => m.id === moduleId);
  if (!module) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Module not found' }) };

  const entitlement = await checkEntitlement(payload, moduleId);
  if (!entitlement.allowed) {
    const code = entitlement.reason;
    const status = (code === 'PATHWAY_REFRESH') ? 403 : 403;
    console.log(`get-lesson: DENIED ${payload.email} plan=${payload.plan} moduleId=${moduleId} reason=${code}`);
    return { statusCode: status, headers: HEADERS, body: JSON.stringify({ error: 'Access denied', code }) };
  }

  console.log(`get-lesson: ${payload.email} plan=${payload.plan} moduleId=${moduleId}`);
  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ module }),
  };
};
