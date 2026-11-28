/**
 * scripts/reconcile-mgr-email-index.mjs
 *
 * Bounded administrative utility to reconcile the p1-mgr-by-email secondary index
 * for a specific manager email address.
 *
 * DEFAULTS TO DRY-RUN. Pass --apply to write repairs.
 *
 * ENVIRONMENT RESTRICTION (Build 1):
 *   This utility only operates against an isolated local `netlify dev` environment.
 *   It refuses to run if NETLIFY_BLOBS_CONTEXT does not decode to a JSON object
 *   containing an edgeURL whose hostname is localhost or 127.0.0.1. This check runs
 *   for every execution path, including direct imports, unless the caller supplies
 *   opts.env pointing at a local context (used exclusively by mocked tests).
 *
 * Scan complexity:
 *   O(active employers), bounded by maxEmployers (default 100). The limit is enforced
 *   inline during pagination — the utility aborts as soon as it discovers a
 *   (maxEmployers + 1)th employer blob, before reading any agreement, roster, or index
 *   records. It never silently processes a partial set.
 *
 * Bidirectional reconciliation:
 *   - Activates or creates an index entry when the roster and agreement both allow
 *     access, also repairing any incorrect email or employerKey stored in the entry.
 *   - Deactivates a stale active entry when the authoritative records no longer allow
 *     access (roster removed, agreement inactive/expired, or agreement blob deleted).
 *
 * This utility never modifies agreements or roster records.
 * This utility never sends emails.
 *
 * Usage:
 *   # dry-run (default) — shows what would change without writing:
 *   node scripts/reconcile-mgr-email-index.mjs --email <email>
 *
 *   # write repairs (local dev only):
 *   node scripts/reconcile-mgr-email-index.mjs --email <email> --apply
 *
 *   # override scan limit:
 *   node scripts/reconcile-mgr-email-index.mjs --email <email> --max-employers 50
 */

import { getStore }      from '@netlify/blobs';
import { fileURLToPath } from 'url';

const DEFAULT_MAX_EMPLOYERS = 100;

const PREFIX   = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ── Environment safety check ──────────────────────────────────────────────────

/**
 * Verifies that the given env object contains a NETLIFY_BLOBS_CONTEXT that decodes
 * to a JSON object whose edgeURL routes to localhost or 127.0.0.1.
 *
 * Returns null if the environment is confirmed as isolated local development.
 * Returns a string[] of error lines if the check fails. Callers must treat any
 * non-null return as a hard block — fail closed.
 *
 * @param {object} env — process.env or a test-supplied substitute
 * @returns {string[]|null}
 */
export function checkLocalEnv(env = process.env) {
  const raw = env.NETLIFY_BLOBS_CONTEXT;

  if (!raw) {
    return [
      'NETLIFY_BLOBS_CONTEXT is not set.',
      'This utility requires a local `netlify dev` context to prevent accidental',
      'production writes. Run from within `netlify dev` (the CLI sets this automatically).'
    ];
  }

  let ctx;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    ctx = JSON.parse(decoded);
    if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) throw new Error('not an object');
  } catch {
    return [
      'NETLIFY_BLOBS_CONTEXT does not contain valid base64-encoded JSON.',
      'A bare "1" or other non-JSON value is not acceptable.',
      'Run from within `netlify dev` to obtain a valid local context.'
    ];
  }

  if (!ctx.edgeURL) {
    return [
      'NETLIFY_BLOBS_CONTEXT context has no edgeURL.',
      'Without an edgeURL the SDK routes all Blobs requests to the production Netlify API.',
      'Run from within `netlify dev` to obtain a local context.'
    ];
  }

  let hostname;
  try {
    hostname = new URL(ctx.edgeURL).hostname;
  } catch {
    return [`NETLIFY_BLOBS_CONTEXT edgeURL "${ctx.edgeURL}" is not a valid URL.`];
  }

  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return [
      `NETLIFY_BLOBS_CONTEXT edgeURL hostname "${hostname}" is not a local address.`,
      'This utility only operates against isolated local development environments.',
      'Production reconciliation is out of scope for Build 1.',
      'Run from within `netlify dev`.'
    ];
  }

  return null;
}

// ── Pagination helper (used only for Phase 2 — bounded by memberships) ────────

async function listAllBlobsForPrefix(store, prefix) {
  const all = [];
  let cursor;
  do {
    const result = cursor
      ? await store.list({ prefix, cursor })
      : await store.list({ prefix });
    all.push(...result.blobs);
    cursor = result.cursor;
  } while (cursor);
  return all;
}

// ── Core reconciliation logic ─────────────────────────────────────────────────

/**
 * Reconciles the email secondary index for the given normalised email address.
 *
 * The environment safety check runs before any storage access. Tests supply
 * opts.env pointing at a local context; production relies on process.env.
 *
 * Phase 1 — paginate employer agreements (enforces maxEmployers inline):
 *   - Activates/creates/repairs an index entry when the roster and agreement allow access.
 *   - Deactivates an active index entry when access should be revoked.
 *
 * Phase 2 — deactivate orphaned index entries:
 *   - Finds active index entries for employer keys not seen in Phase 1 and deactivates them.
 *   - These arise when an employer's agreement blob was deleted after the index was written.
 *
 * With dryRun=true (the default) no writes occur; the counts reflect what would change.
 *
 * Throws if:
 *   - the environment check fails
 *   - the email is invalid
 *   - the employer count exceeds maxEmployers (aborts before reading any records)
 *   - an index write fails (errors propagate; they are not silently swallowed)
 *
 * Never modifies agreements or roster records.
 *
 * @param {string} normalised — lower-cased, trimmed email address
 * @param {{ agreementStore, rosterStore, emailIdxStore }} stores — injected (mocked in tests)
 * @param {{ dryRun?: boolean, maxEmployers?: number, env?: object }} opts
 * @returns {Promise<{ checked: number, activated: number, deactivated: number, dryRun: boolean }>}
 */
export async function reconcileEmail(normalised, { agreementStore, rosterStore, emailIdxStore }, opts = {}) {
  // Environment safety check — runs before any storage access for every caller.
  // Tests inject opts.env pointing at a valid local context; all other callers use
  // process.env, which must contain a localhost-routed NETLIFY_BLOBS_CONTEXT.
  const envToCheck = opts.env !== undefined ? opts.env : process.env;
  const envErrors  = checkLocalEnv(envToCheck);
  if (envErrors) throw new Error(`Environment safety check failed — ${envErrors[0]}`);

  // Validate email before any storage access.
  if (!normalised || typeof normalised !== 'string' || !EMAIL_RE.test(normalised)) {
    throw new Error('Invalid email address');
  }

  const dryRun       = opts.dryRun !== false;
  const maxEmployers = (typeof opts.maxEmployers === 'number' && opts.maxEmployers > 0)
    ? opts.maxEmployers
    : DEFAULT_MAX_EMPLOYERS;

  const emailKey = Buffer.from(normalised).toString('base64url');

  // Phase 0 — paginate employer blobs with an inline scan-limit guard.
  // The limit is enforced as each blob arrives during pagination, not after all pages
  // are loaded. If a (maxEmployers + 1)th employer blob is found we abort before
  // reading any agreement, roster or index records.
  const employerBlobs = [];
  {
    let cursor;
    do {
      const result = cursor
        ? await agreementStore.list({ cursor })
        : await agreementStore.list({});
      for (const blob of result.blobs) {
        if (!UUID_RE.test(blob.key)) continue;
        employerBlobs.push(blob);
        if (employerBlobs.length > maxEmployers) {
          throw new Error(
            `Employer count exceeds the scan limit of ${maxEmployers}. ` +
            `Increase maxEmployers or investigate the number of active employer agreements.`
          );
        }
      }
      cursor = result.cursor;
    } while (cursor);
  }

  const seenEmployers = new Set();
  let activated   = 0;
  let deactivated = 0;

  // Phase 1 — for each employer, determine and enforce the correct index state.
  for (const { key: empKey } of employerBlobs) {
    seenEmployers.add(empKey);

    const agreement   = await agreementStore.get(empKey, { type: 'json' });
    const rosterEntry = await rosterStore.get(`${empKey}/${emailKey}`, { type: 'json' });
    const idxEntry    = await emailIdxStore.get(`${emailKey}/${empKey}`, { type: 'json' });

    const shouldBeActive =
      agreement != null &&
      agreement.serviceActive === true &&
      new Date(agreement.serviceExpiresAt) > new Date() &&
      rosterEntry != null &&
      rosterEntry.active === true;

    // Check all index fields — not just the active flag. An entry with the right active
    // status but wrong email or employerKey is also incorrect and must be repaired.
    const entryNeedsRepair =
      !idxEntry ||
      !idxEntry.active ||
      idxEntry.email       !== normalised ||
      idxEntry.employerKey !== empKey;

    if (shouldBeActive && entryNeedsRepair) {
      if (!dryRun) {
        await emailIdxStore.setJSON(`${emailKey}/${empKey}`, {
          email:       normalised,
          employerKey: empKey,
          active:      true,
          updatedAt:   new Date().toISOString()
        });
      }
      activated++;
    } else if (!shouldBeActive && idxEntry != null && idxEntry.active === true) {
      if (!dryRun) {
        await emailIdxStore.setJSON(`${emailKey}/${empKey}`, {
          email:       normalised,
          employerKey: empKey,
          active:      false,
          updatedAt:   new Date().toISOString()
        });
      }
      deactivated++;
    }
  }

  // Phase 2 — deactivate orphaned index entries for employers not seen in Phase 1.
  // These indicate an employer whose agreement blob was removed after the index was last
  // written. This scan is bounded by the number of employers for a single manager —
  // typically very small.
  const idxBlobs = await listAllBlobsForPrefix(emailIdxStore, `${emailKey}/`);
  for (const { key: idxKey } of idxBlobs) {
    const empKey = idxKey.slice(emailKey.length + 1);
    if (!UUID_RE.test(empKey)) continue;
    if (seenEmployers.has(empKey)) continue;

    const idxEntry = await emailIdxStore.get(idxKey, { type: 'json' });
    if (!idxEntry || !idxEntry.active) continue;

    if (!dryRun) {
      await emailIdxStore.setJSON(idxKey, {
        email:       normalised,
        employerKey: empKey,
        active:      false,
        updatedAt:   new Date().toISOString()
      });
    }
    deactivated++;
  }

  return { checked: employerBlobs.length, activated, deactivated, dryRun };
}

// ── Store factory (local dev only — CLI entry point) ──────────────────────────

function makeStores() {
  const s = (name) => getStore(`${PREFIX}${name}`);
  return {
    agreementStore: s('p1-employer-agreements'),
    rosterStore:    s('p1-manager-roster'),
    emailIdxStore:  s('p1-mgr-by-email')
  };
}

// ── CLI entry point ───────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Environment check before argument parsing — no storage access possible yet.
  const cliEnvErrors = checkLocalEnv(process.env);
  if (cliEnvErrors) {
    for (const line of cliEnvErrors) console.error(line);
    process.exit(1);
  }

  const args         = process.argv.slice(2);
  const iEmail       = args.indexOf('--email');
  const iMax         = args.indexOf('--max-employers');
  const rawEmail     = iEmail !== -1 ? args[iEmail + 1] : null;
  const maxEmployers = iMax   !== -1 ? parseInt(args[iMax + 1], 10) : DEFAULT_MAX_EMPLOYERS;
  const apply        = args.includes('--apply');

  if (!rawEmail || !EMAIL_RE.test(rawEmail.trim())) {
    console.error('Usage: node scripts/reconcile-mgr-email-index.mjs --email <email> [--apply] [--max-employers <n>]');
    console.error('       --apply          write repairs (default is dry-run, no writes)');
    console.error(`       --max-employers  maximum employer agreements to scan (default ${DEFAULT_MAX_EMPLOYERS})`);
    process.exit(1);
  }

  if (iMax !== -1 && (!Number.isInteger(maxEmployers) || maxEmployers <= 0)) {
    console.error(`--max-employers must be a positive integer; got: ${args[iMax + 1]}`);
    process.exit(1);
  }

  const normalised = rawEmail.trim().toLowerCase();
  const dryRun     = !apply;

  try {
    const { checked, activated, deactivated } = await reconcileEmail(
      normalised,
      makeStores(),
      { dryRun, maxEmployers }
      // opts.env omitted — reconcileEmail falls back to process.env, which the
      // CLI already verified above.
    );

    if (dryRun) {
      console.log(`Dry-run (no writes): checked ${checked} employer(s).`);
      if (activated > 0)   console.log(`  Would activate:   ${activated} index entry/entries.`);
      if (deactivated > 0) console.log(`  Would deactivate: ${deactivated} index entry/entries.`);
      if (activated === 0 && deactivated === 0) console.log('  Index is consistent — no repairs needed.');
      console.log('Pass --apply to write repairs.');
    } else {
      console.log(`Applied: checked ${checked} employer(s).`);
      if (activated > 0)   console.log(`  Activated:   ${activated} index entry/entries.`);
      if (deactivated > 0) console.log(`  Deactivated: ${deactivated} index entry/entries.`);
      if (activated === 0 && deactivated === 0) console.log('  Index was already consistent — no changes made.');
    }
  } catch (e) {
    console.error(`Reconcile failed: ${e.message}`);
    process.exit(1);
  }
}
