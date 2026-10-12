/**
 * Creates an isolated test candidate session on the Netlify preview.
 * Outputs a usable benchmark URL — no email is sent; no real employee is involved.
 *
 * Secure usage (credentials stay in .env — never pasted into terminal):
 *   ! node --env-file=.env scripts/create-p1-test-session.mjs
 *
 * Required in .env (or environment):
 *   JWT_SECRET             — already present
 *   NETLIFY_AUTH_TOKEN     — get from Netlify dashboard → User settings → Personal access tokens
 *
 * Optional:
 *   P1_BASE_URL=https://deploy-preview-13--getcharteredai.netlify.app
 */

import { createHmac, randomUUID } from 'crypto';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const JWT_SECRET  = process.env.JWT_SECRET;
const AUTH_TOKEN  = process.env.NETLIFY_AUTH_TOKEN;
const BASE_URL    = process.env.P1_BASE_URL || 'https://deploy-preview-13--getcharteredai.netlify.app';
const PREFIX      = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

// Auto-read siteId from .netlify/state.json — no need to paste it
let SITE_ID = process.env.NETLIFY_SITE_ID;
if (!SITE_ID) {
  try {
    const state = JSON.parse(readFileSync(path.join(__dirname, '../.netlify/state.json'), 'utf8'));
    SITE_ID = state.siteId;
  } catch { /* will fail below */ }
}

if (!JWT_SECRET) {
  console.error('Missing JWT_SECRET — add it to .env and run: node --env-file=.env scripts/create-p1-test-session.mjs');
  process.exit(1);
}
if (!AUTH_TOKEN) {
  console.error('Missing NETLIFY_AUTH_TOKEN — add it to .env (Netlify dashboard → User settings → Personal access tokens)');
  process.exit(1);
}
if (!SITE_ID) {
  console.error('Could not read siteId from .netlify/state.json and NETLIFY_SITE_ID not set');
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

const candidateToken = generateToken({
  sessionId,
  role: 'candidate',
  email: meta.candidateEmail,
  expires: now + 24 * 60 * 60 * 1000
});

const sessionStore = getStore({
  name: `${PREFIX}p1-sessions`,
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
  console.log('  - Delete from Netlify Blobs after testing if desired\n');
} catch (err) {
  console.error('Failed to create session:', err.message);
  process.exit(1);
}
