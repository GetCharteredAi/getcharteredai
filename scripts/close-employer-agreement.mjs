/**
 * Close an employer agreement: set serviceActive:false and record the closure date and reason.
 *
 * This operation immediately revokes manager-learning access — every protected endpoint
 * checks agreement.serviceActive — but preserves all records. The agreement, manager
 * roster, and all associated Benchmark data are retained.
 *
 * Permanent deletion of records is a separate procedure subject to retention obligations
 * and is NOT performed by this script.
 *
 * Dry-run by default. Pass --confirm to execute.
 *
 * Usage:
 *   node scripts/close-employer-agreement.mjs --employer-key <UUID> [--reason "text"]
 *   node scripts/close-employer-agreement.mjs --employer-key <UUID> [--reason "text"] --confirm
 *
 * Required env: NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN
 *               (or NETLIFY_BLOBS_CONTEXT=1 for local/test use)
 */

import { getStore }         from '@netlify/blobs';
import crypto               from 'crypto';
import { fileURLToPath }    from 'url';

const PREFIX  = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ── Pagination-safe list ───────────────────────────────────────────────────────
// Explicitly follows cursor pages rather than relying on SDK auto-pagination.
// Exported for unit testing.
export async function listAllBlobs(blobStore, prefix) {
  const all = [];
  let cursor;
  do {
    const opts   = cursor ? { prefix, cursor } : { prefix };
    const result = await blobStore.list(opts);
    all.push(...(result.blobs || []));
    cursor = result.nextCursor || null;
  } while (cursor);
  return all;
}

// ── Audit helper ──────────────────────────────────────────────────────────────
async function writeAudit(auditStore, entry) {
  const key = `${new Date().toISOString()}-${crypto.randomUUID()}`;
  await auditStore.setJSON(key, entry);
  return key;
}

// ── Core logic (exported for testing) ────────────────────────────────────────
/**
 * @param {{ employerKey: string, reason: string|null, confirm: boolean }} opts
 * @param {{ agreementStore, rosterStore, auditStore }} stores
 * @returns {Promise<{ exitCode: number, messages: string[] }>}
 */
export async function runClosure(opts, stores) {
  const { employerKey, reason, confirm } = opts;
  const { agreementStore, rosterStore, auditStore } = stores;
  const messages = [];

  if (!employerKey || !UUID_RE.test(employerKey)) {
    return { exitCode: 1, messages: ['Error: --employer-key must be a valid UUID'] };
  }

  const agreement = await agreementStore.get(employerKey, { type: 'json' });
  if (!agreement) {
    return { exitCode: 1, messages: [`Error: No agreement found for employerKey ${employerKey}`] };
  }

  if (!agreement.serviceActive) {
    const when = agreement.closedAt ? ` (closed ${agreement.closedAt})` : '';
    return {
      exitCode: 0,
      messages: [`Agreement for ${agreement.firmName} is already inactive${when}. No changes required.`]
    };
  }

  // Count managers — informational; roster is not modified
  const managerBlobs = await listAllBlobs(rosterStore, `${employerKey}/`);
  const managerCount = managerBlobs.length;

  messages.push('');
  messages.push('── Agreement closure ──────────────────────────────────────────');
  messages.push(`  Firm:         ${agreement.firmName}`);
  messages.push(`  EmployerKey:  ${employerKey}`);
  messages.push(`  Currently:    serviceActive=true`);
  messages.push(`  Managers:     ${managerCount} roster record(s) — preserved, not modified`);
  messages.push(`  Reason:       ${reason || '(none provided)'}`);
  messages.push('');
  messages.push('  What this operation WILL do:');
  messages.push('    • Set serviceActive: false on the agreement record');
  messages.push('    • Record closedAt and closedReason on the agreement record');
  messages.push('    • Write a pre-change and post-change audit entry');
  messages.push('    • Immediately revoke manager-learning access via agreement check');
  messages.push('');
  messages.push('  What this operation will NOT do:');
  messages.push('    • Delete the agreement record');
  messages.push('    • Delete any manager roster records');
  messages.push('    • Delete any Benchmark data');
  messages.push('──────────────────────────────────────────────────────────────');
  messages.push('');

  if (!confirm) {
    messages.push('DRY RUN — no changes made. Re-run with --confirm to execute.');
    messages.push('');
    return { exitCode: 0, messages };
  }

  const closedAt     = new Date().toISOString();
  const closedReason = reason || null;

  // Record intent before any change. Abort if this write fails — no changes have been made.
  let intentKey;
  try {
    intentKey = await writeAudit(auditStore, {
      type:        'agreement-closure-initiated',
      employerKey,
      firmName:    agreement.firmName,
      managerCount,
      closedReason,
      initiatedAt: closedAt
    });
    messages.push(`Pre-change audit entry: ${intentKey}`);
  } catch (auditErr) {
    messages.push(`Error: Failed to write pre-change audit entry — aborting. No changes have been made.`);
    messages.push(`       ${auditErr.message}`);
    return { exitCode: 1, messages };
  }

  // Execute closure
  let closeError;
  try {
    await agreementStore.setJSON(employerKey, {
      ...agreement,
      serviceActive: false,
      closedAt,
      closedReason,
      updatedAt:     closedAt
    });
    messages.push('Agreement deactivated (serviceActive: false)');
  } catch (e) {
    closeError = e;
    messages.push(`Error: Failed to update agreement record: ${e.message}`);
  }

  // Record outcome — always attempt, even after a failed closure.
  let postAuditError;
  try {
    const outcomeKey = await writeAudit(auditStore, {
      type:           closeError ? 'agreement-closure-failed' : 'agreement-closure-completed',
      employerKey,
      firmName:       agreement.firmName,
      managerCount,
      closedReason,
      intentAuditKey: intentKey,
      completedAt:    new Date().toISOString(),
      error:          closeError ? closeError.message : null
    });
    messages.push(`Post-change audit entry: ${outcomeKey}`);
  } catch (e) {
    postAuditError = e;
    if (!closeError) {
      // Agreement was deactivated but the audit record is missing — operator must investigate.
      messages.push(`WARNING: The agreement was deactivated but the post-change audit record`);
      messages.push(`         could not be written (${e.message}).`);
      messages.push(`         The agreement is now inactive. This closure is not fully audited.`);
      messages.push(`         Verify the agreement state and write a manual audit record.`);
    } else {
      messages.push(`WARNING: Agreement update failed and the post-change audit record`);
      messages.push(`         could not be written (${e.message}).`);
    }
  }

  if (closeError || postAuditError) {
    return { exitCode: 1, messages };
  }

  messages.push('');
  messages.push('Agreement closed. Manager-learning access revoked. All records preserved.');
  messages.push('');
  return { exitCode: 0, messages };
}

// ── CLI entry point ───────────────────────────────────────────────────────────
function makeStores() {
  const s = (name) => process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}${name}`)
    : getStore({ name: `${PREFIX}${name}`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
  return {
    agreementStore: s('p1-employer-agreements'),
    rosterStore:    s('p1-manager-roster'),
    auditStore:     s('p1-deletion-audit')
  };
}

function parseArgs() {
  const args    = process.argv.slice(2);
  const get     = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
  const confirm = args.includes('--confirm');
  return { employerKey: get('--employer-key'), reason: get('--reason'), confirm };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts   = parseArgs();
  const result = await runClosure(opts, makeStores());
  for (const msg of result.messages) console.log(msg);
  process.exit(result.exitCode);
}
