// netlify/functions/p1-employer-agreement-write.js
// Admin-only endpoint: create or update employer agreement records.
// Called by admin scripts only — no browser CORS exposure.
// POST { adminSecret, action: 'create'|'update'|'get', ...params }

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

// No Access-Control-Allow-Origin: admin scripts only, never browser cross-origin.
const HEADERS = { 'Content-Type': 'application/json' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function getAgreementStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-employer-agreements`)
    : getStore({ name: `${PREFIX}p1-employer-agreements`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function err(statusCode, message) {
  return { statusCode, headers: HEADERS, body: JSON.stringify({ error: message }) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');

  let body;
  try { body = JSON.parse(event.body); }
  catch { return err(400, 'Invalid request body'); }

  // Fail closed: reject requests if the server is not properly configured.
  const configuredSecret = process.env.P1_ADMIN_SECRET;
  if (!configuredSecret || !configuredSecret.trim()) {
    console.error('[p1-agreement] P1_ADMIN_SECRET is not configured');
    return err(500, 'Server configuration error');
  }
  const { adminSecret } = body;
  if (typeof adminSecret !== 'string' || !adminSecret.trim() || adminSecret.trim() !== configuredSecret.trim()) {
    return err(403, 'Forbidden');
  }

  const { action, employerKey, firmName, employerContactEmail,
          serviceStartsAt, serviceExpiresAt, serviceActive, notes } = body;

  const store = getAgreementStore();

  // ── Create ───────────────────────────────────────────────────────────────────
  if (action === 'create') {
    const missing = ['firmName', 'employerContactEmail', 'serviceStartsAt', 'serviceExpiresAt']
      .filter(f => body[f] === undefined || body[f] === null || body[f] === '');
    if (missing.length) return err(400, `Missing required fields: ${missing.join(', ')}`);

    // Type validation before any string operation
    if (typeof firmName !== 'string')             return err(400, 'firmName must be a string');
    if (typeof employerContactEmail !== 'string') return err(400, 'employerContactEmail must be a string');
    if (typeof serviceStartsAt !== 'string')      return err(400, 'serviceStartsAt must be a string');
    if (typeof serviceExpiresAt !== 'string')     return err(400, 'serviceExpiresAt must be a string');

    if (!EMAIL_RE.test(employerContactEmail.trim())) return err(400, 'Invalid employerContactEmail');

    const startsAt  = new Date(serviceStartsAt.trim());
    const expiresAt = new Date(serviceExpiresAt.trim());
    if (isNaN(startsAt.getTime()))  return err(400, 'Invalid serviceStartsAt: not a recognisable date');
    if (isNaN(expiresAt.getTime())) return err(400, 'Invalid serviceExpiresAt: not a recognisable date');
    if (expiresAt <= startsAt)      return err(400, 'serviceExpiresAt must be after serviceStartsAt');

    const newKey = crypto.randomUUID();
    const now    = new Date().toISOString();
    const record = {
      employerKey:          newKey,
      firmName:             firmName.trim(),
      employerContactEmail: employerContactEmail.trim().toLowerCase(),
      serviceStartsAt:      startsAt.toISOString(),
      serviceExpiresAt:     expiresAt.toISOString(),
      serviceActive:        true,
      createdAt:            now,
      updatedAt:            now,
      notes:                (typeof notes === 'string' ? notes.trim() || null : null)
    };
    await store.setJSON(newKey, record);
    console.log(`[p1-agreement] Created ${newKey} for ${record.firmName}`);
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ employerKey: newKey, firmName: record.firmName }) };
  }

  // ── Update ───────────────────────────────────────────────────────────────────
  if (action === 'update') {
    if (!employerKey || !UUID_RE.test(employerKey)) return err(400, 'Valid employerKey UUID is required');

    const existing = await store.get(employerKey, { type: 'json' });
    if (!existing) return err(404, 'Agreement not found');

    // Spread first to preserve every existing field, then overwrite only supplied values.
    const updated = { ...existing, updatedAt: new Date().toISOString() };

    if (firmName !== undefined) {
      if (typeof firmName !== 'string') return err(400, 'firmName must be a string');
      if (!firmName.trim())             return err(400, 'firmName cannot be empty');
      updated.firmName = firmName.trim();
    }
    if (serviceExpiresAt !== undefined) {
      if (typeof serviceExpiresAt !== 'string') return err(400, 'serviceExpiresAt must be a string');
      const expiresAt = new Date(serviceExpiresAt.trim());
      if (isNaN(expiresAt.getTime()))           return err(400, 'Invalid serviceExpiresAt: not a recognisable date');
      // Must remain after the agreement's existing start date.
      const existingStartsAt = new Date(existing.serviceStartsAt);
      if (expiresAt <= existingStartsAt)        return err(400, 'serviceExpiresAt must be after the existing serviceStartsAt');
      updated.serviceExpiresAt = expiresAt.toISOString();
    }
    if (serviceActive !== undefined) {
      if (typeof serviceActive !== 'boolean') return err(400, 'serviceActive must be a boolean');
      updated.serviceActive = serviceActive;
    }
    if (notes !== undefined) {
      updated.notes = typeof notes === 'string' ? notes.trim() || null : null;
    }

    await store.setJSON(employerKey, updated);
    console.log(`[p1-agreement] Updated ${employerKey}`);
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify(updated) };
  }

  // ── Get ───────────────────────────────────────────────────────────────────────
  if (action === 'get') {
    if (!employerKey || !UUID_RE.test(employerKey)) return err(400, 'Valid employerKey UUID is required');
    const record = await store.get(employerKey, { type: 'json' });
    if (!record) return err(404, 'Agreement not found');
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify(record) };
  }

  return err(400, 'action must be create, update or get');
};
