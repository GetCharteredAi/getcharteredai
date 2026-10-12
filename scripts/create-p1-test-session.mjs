/**
 * Creates an isolated test candidate session on the Netlify preview.
 * Outputs a usable benchmark URL — no email is sent; no real employee is involved.
 *
 * Usage (run with ! in Claude Code terminal to get the URL in this session):
 *   ! JWT_SECRET=<s> NETLIFY_SITE_ID=<id> NETLIFY_AUTH_TOKEN=<tok> node scripts/create-p1-test-session.mjs
 *
 * Optional:
 *   P1_BASE_URL=https://deploy-preview-13--getcharteredai.netlify.app
 *   P1_STORE_PREFIX=  (leave empty to match preview default)
 */

import { createHmac, randomUUID } from 'crypto';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const JWT_SECRET      = process.env.JWT_SECRET;
const SITE_ID         = process.env.NETLIFY_SITE_ID;
const AUTH_TOKEN      = process.env.NETLIFY_AUTH_TOKEN;
const BASE_URL        = process.env.P1_BASE_URL || 'https://deploy-preview-13--getcharteredai.netlify.app';
const STORE_PREFIX    = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

if (!JWT_SECRET || !SITE_ID || !AUTH_TOKEN) {
  console.error('Required: JWT_SECRET, NETLIFY_SITE_ID, NETLIFY_AUTH_TOKEN');
  process.exit(1);
}

const { getStore } = require(path.join(__dirname, '../node_modules/@netlify/blobs'));

function generateToken(payload) {
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = createHmac('sha256', JWT_SECRET).update(tokenData).digest('base64url');
  return `${tokenData}.${sig}`;
}

const sessionId = `p1-test-${randomUUID().slice(0, 8)}`;
const now = Date.now();
const TTL = 24 * 60 * 60 * 1000; // 24h

// Session metadata — mirrors what p1-admin-upload creates
const meta = {
  sessionId,
  status: 'invited',
  firmName: 'GCAi Acceptance Test',
  discipline: 'Quantity Surveying',
  monthsInRole: 7,
  employmentStartDate: '2026-03-01',
  employmentType: 'graduate',
  candidateEmail: 'test-candidate@gca-internal.test',
  managerEmail: 'test-manager@gca-internal.test',
  candidateName: 'Test Candidate',
  managerName: 'Test Manager',
  cohortId: 'test-cohort-acceptance',
  createdAt: now
};

const candidatePayload = {
  sessionId,
  role: 'candidate',
  email: meta.candidateEmail,
  expires: now + TTL
};
const candidateToken = generateToken(candidatePayload);

const sessionStore = getStore({
  name: `${STORE_PREFIX}p1-sessions`,
  siteID: SITE_ID,
  token: AUTH_TOKEN
});

try {
  await sessionStore.setJSON(`${sessionId}/metadata`, meta);
  console.log('\n✓ Test session created:', sessionId);
  console.log('\nCandidate benchmark URL (24h expiry):');
  console.log(`\n  ${BASE_URL}/professional-readiness-benchmark?token=${candidateToken}\n`);
  console.log('Notes:');
  console.log('  - No email sent; no real employee contacted');
  console.log('  - Session ID starts with p1-test- so manager emails route to contact@gcaitutor.com');
  console.log('  - Delete session from Netlify Blobs after testing if desired\n');
} catch (err) {
  console.error('Failed to create session:', err.message);
  process.exit(1);
}
