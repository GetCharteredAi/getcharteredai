// netlify/functions/p1-admin-upload.js
// Admin endpoint: parse CSV cohort upload, create sessions, issue invitations.
// POST { adminSecret, csvContent }

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

const FROM = 'Get Chartered AI <info@getcharteredai.com>';
const VALID_EMPLOYMENT_TYPES = ['graduate', 'apprentice', 'other'];
const CANDIDATE_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;   // 30 days
const EMPLOYER_TOKEN_TTL_MS  = 365 * 24 * 60 * 60 * 1000;  // 365 days

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSessionStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore('p1-sessions')
    : getStore({ name: 'p1-sessions', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function getCohortStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore('p1-cohorts')
    : getStore({ name: 'p1-cohorts', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function getInviteStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore('p1-invites')
    : getStore({ name: 'p1-invites', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function generateToken(payload) {
  const jwtSecret = process.env.JWT_SECRET;
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', jwtSecret).update(tokenData).digest('base64url');
  return `${tokenData}.${sig}`;
}

function computeMonthsInRole(startDateStr) {
  const start = new Date(startDateStr + 'T00:00:00Z');
  if (isNaN(start.getTime())) return null;
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return Math.max(0, months);
}

function parseCSVLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === ',' && !inQuotes) {
      fields.push(field.trim());
      field = '';
    } else {
      field += c;
    }
  }
  fields.push(field.trim());
  return fields;
}

function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV requires a header row and at least one data row');
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ''));
  const required = ['candidateemail', 'manageremail', 'employeremail', 'employmenttype', 'discipline', 'employmentstartdate', 'firmname'];
  for (const r of required) {
    if (!headers.includes(r)) throw new Error(`Missing required column: ${r}`);
  }
  return lines.slice(1).map((line, idx) => {
    const vals = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
    return { rowNum: idx + 2, ...row };
  });
}

async function sendEmail(to, subject, html, text) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.log(`[p1-upload] Would send to ${to}: ${subject}`); return; }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text })
    });
  } catch (e) {
    console.error(`[p1-upload] Email send failed to ${to}:`, e.message);
  }
}

function wrap(content) {
  return `<div style="font-family:'DM Sans',Arial,sans-serif;max-width:580px;margin:0 auto;background:#fff">
    <div style="background:#0D0F1C;padding:20px 28px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center">
      <span style="font-family:Georgia,serif;font-size:17px;font-weight:700;color:#fff">Get Chartered <span style="color:#f59e0b">AI</span></span>
      <span style="font-size:11px;color:rgba(255,255,255,.4)">getcharteredai.com</span>
    </div>
    <div style="padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px">
      ${content}
    </div>
    <div style="padding:14px 28px;text-align:center">
      <p style="font-size:11px;color:#94a3b8;margin:0">Get Chartered AI &middot; <a href="https://getcharteredai.com" style="color:#94a3b8">getcharteredai.com</a></p>
    </div>
  </div>`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) }; }

  const { adminSecret, csvContent } = body;

  if (!adminSecret || adminSecret !== process.env.P1_ADMIN_SECRET) {
    return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  if (!csvContent || typeof csvContent !== 'string') {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'csvContent is required' }) };
  }

  // Parse and validate CSV
  let rows;
  try { rows = parseCSV(csvContent); }
  catch (e) { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: e.message }) }; }

  const errors = [];
  const validRows = [];

  for (const row of rows) {
    const rowErrors = [];
    if (!row.candidateemail || !row.candidateemail.includes('@')) rowErrors.push('invalid candidateEmail');
    if (!row.manageremail || !row.manageremail.includes('@')) rowErrors.push('invalid managerEmail');
    if (!row.employeremail || !row.employeremail.includes('@')) rowErrors.push('invalid employerEmail');
    if (!VALID_EMPLOYMENT_TYPES.includes(row.employmenttype)) rowErrors.push(`employmentType must be graduate|apprentice|other, got: ${row.employmenttype}`);
    if (!row.discipline) rowErrors.push('discipline is required');
    if (!row.firmname) rowErrors.push('firmName is required');
    const months = computeMonthsInRole(row.employmentstartdate);
    if (months === null) rowErrors.push(`invalid employmentStartDate: ${row.employmentstartdate}`);

    if (rowErrors.length) {
      errors.push({ row: row.rowNum, errors: rowErrors });
    } else {
      validRows.push({ ...row, monthsInRole: months });
    }
  }

  if (errors.length) {
    return { statusCode: 422, headers: HEADERS, body: JSON.stringify({ error: 'Validation errors', errors }) };
  }

  // All rows valid — proceed
  const cohortId = crypto.randomUUID();
  const firmName = validRows[0].firmname;
  const employerContactEmail = validRows[0].employeremail;
  const now = Date.now();

  const sessionStore = getSessionStore();
  const cohortStore  = getCohortStore();
  const inviteStore  = getInviteStore();
  const siteUrl      = process.env.URL || 'https://getcharteredai.com';

  const sessionIds = [];

  // Write each session
  for (const row of validRows) {
    const sessionId = crypto.randomUUID();
    sessionIds.push(sessionId);

    const meta = {
      schemaVersion: 'benchmark-v1',
      sessionId,
      cohortId,
      firmName: row.firmname,
      candidateEmail: row.candidateemail,
      managerEmail: row.manageremail,
      employerEmail: row.employeremail,
      employmentType: row.employmenttype,
      discipline: row.discipline,
      employmentStartDate: row.employmentstartdate,
      monthsInRole: row.monthsInRole,
      status: 'invited',
      createdAt: now,
      candidateInviteKey: null,  // set below after token is generated
      candidateStartedAt: null,
      candidateCompletedAt: null,
      managerInvitedAt: null,
      currentManagerInviteKey: null,
      managerCompletedAt: null,
      synthesisStartedAt: null,
      synthesisCompletedAt: null,
      reminderEmail2SentAt: null,
      reminderEmail4SentAt: null,
      selfPlanSetAt: null,
      selfPlanReviewDate: null,
      progressReflectionSentAt: null
    };

    await sessionStore.setJSON(`${sessionId}/metadata`, meta);

    // Candidate invite token
    const candidatePayload = {
      sessionId,
      role: 'candidate',
      email: row.candidateemail,
      expires: now + CANDIDATE_TOKEN_TTL_MS
    };
    const candidateToken = generateToken(candidatePayload);
    await inviteStore.setJSON(candidateToken, {
      sessionId,
      role: 'candidate',
      expiresAt: now + CANDIDATE_TOKEN_TTL_MS,
      issuedAt: now
    });

    // Store token key in metadata so Scheduled Function can rebuild reminder link
    meta.candidateInviteKey = candidateToken;
    await sessionStore.setJSON(`${sessionId}/metadata`, meta);

    // Email #2 — candidate invitation
    const candidateLink = `${siteUrl}/professional-readiness-benchmark?token=${candidateToken}`;
    await sendEmail(
      row.candidateemail,
      `Your Professional Readiness Benchmark invitation — ${row.firmname}`,
      wrap(`
        <p style="font-size:15px;color:#374151;line-height:1.7">You have been invited to complete a Professional Readiness Benchmark by ${row.firmname}.</p>
        <p style="font-size:15px;color:#374151;line-height:1.7">This is a structured professional development review — a confidential conversation with Michael, our AI coach, followed by a personalised development report.</p>
        <div style="margin:24px 0;text-align:center">
          <a href="${candidateLink}" style="display:inline-block;background:#3d5afe;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;font-size:14px">Begin your Benchmark →</a>
        </div>
        <p style="font-size:13px;color:#94a3b8;line-height:1.6">This link is personal to you and expires in 30 days. If you have questions, contact <a href="mailto:info@getcharteredai.com" style="color:#94a3b8">info@getcharteredai.com</a>.</p>
      `),
      `You have been invited to complete a Professional Readiness Benchmark by ${row.firmname}.\n\nBegin here: ${candidateLink}\n\nThis link expires in 30 days.`
    );
  }

  // Write cohort index entries
  await cohortStore.setJSON(`${cohortId}/sessions`, sessionIds);

  const existingIndex = await cohortStore.get('index', { type: 'json' }) || [];
  existingIndex.push({ cohortId, firmName, employerContactEmail, status: 'active', createdAt: now });
  await cohortStore.setJSON('index', existingIndex);

  // Employer invite token
  const employerPayload = {
    cohortId,
    role: 'employer',
    email: employerContactEmail,
    expires: now + EMPLOYER_TOKEN_TTL_MS
  };
  const employerToken = generateToken(employerPayload);
  await inviteStore.setJSON(employerToken, {
    cohortId,
    role: 'employer',
    expiresAt: now + EMPLOYER_TOKEN_TTL_MS,
    issuedAt: now
  });

  // Email #1 — employer confirmation
  const employerLink = `${siteUrl}/professional-readiness-benchmark?token=${employerToken}`;
  await sendEmail(
    employerContactEmail,
    `Your Professional Readiness Benchmark cohort is ready — ${firmName}`,
    wrap(`
      <p style="font-size:15px;color:#374151;line-height:1.7">Your cohort of <strong>${sessionIds.length} candidate${sessionIds.length !== 1 ? 's' : ''}</strong> has been created and invitation emails have been sent.</p>
      <p style="font-size:15px;color:#374151;line-height:1.7">You can track progress using the link below:</p>
      <div style="margin:24px 0;text-align:center">
        <a href="${employerLink}" style="display:inline-block;background:#3d5afe;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;font-size:14px">View cohort status →</a>
      </div>
      <p style="font-size:13px;color:#94a3b8;line-height:1.6">This link shows real-time status for all candidates in this cohort. Bookmark it — it expires in 365 days.</p>
    `),
    `Your cohort of ${sessionIds.length} candidate(s) has been created. Track progress here: ${employerLink}`
  );

  console.log(`[p1-upload] Cohort ${cohortId} created: ${sessionIds.length} sessions for ${firmName}`);

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      success: true,
      cohortId,
      firmName,
      sessionsCreated: sessionIds.length
    })
  };
};
