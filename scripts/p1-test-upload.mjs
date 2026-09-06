// scripts/p1-test-upload.mjs
// Uploads test-upload.csv to the branch deploy p1-admin-upload function.
// Reads P1_ADMIN_SECRET from .p1-admin-secret in the repo root (gitignored).
// Does not log or expose the secret.
// Usage: npm run p1:test-upload

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRANCH_URL = 'https://feature-professional-readiness-benchmark--getcharteredai.netlify.app';
const ENDPOINT = `${BRANCH_URL}/.netlify/functions/p1-admin-upload`;

async function main() {
  let csv;
  try {
    csv = readFileSync(join(ROOT, 'test-upload.csv'), 'utf8');
  } catch {
    console.error('ERROR: test-upload.csv not found in repo root.');
    process.exit(1);
  }

  let secret;
  try {
    secret = readFileSync(join(ROOT, '.p1-admin-secret'), 'utf8').trim();
  } catch {
    console.error('ERROR: .p1-admin-secret not found in repo root.');
    console.error('Create it and paste your P1_ADMIN_SECRET value into it.');
    process.exit(1);
  }

  if (!secret) {
    console.error('ERROR: .p1-admin-secret is empty.');
    process.exit(1);
  }

  console.log(`Secret read: ${secret.length} characters`);
  console.log(`Posting to: ${ENDPOINT}`);

  let res, text;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminSecret: secret, csvContent: csv })
    });
    text = await res.text();
  } catch (e) {
    console.error('ERROR: Request failed —', e.message);
    console.error('Check that the branch deploy is live and the URL is reachable.');
    process.exit(1);
  }

  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }

  if (res.ok) {
    console.log('SUCCESS', res.status);
    console.log(JSON.stringify(parsed ?? text, null, 2));
  } else {
    console.log('FAILED', res.status);
    console.log(JSON.stringify(parsed ?? text, null, 2));
    process.exit(1);
  }
}

main();
