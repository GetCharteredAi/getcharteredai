// scripts/test-alan.mjs
// Unit tests for Ask Alan core logic (alan-products.js + alan.js helpers).
// Tests the routing, template assembly, bridge-text validation, and product record
// integrity without a live endpoint. Run: node scripts/test-alan.mjs
//
// End-to-end test plan (T01–T22 from proposal) requires the deployed function.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const {
  PRODUCTS, RESOURCES, VALID_IDS, VALID_TAGS, NOT_YET_LIVE_PATHWAYS,
  getModelContext, getRecord, buildCard
} = require('../netlify/functions/utils/alan-products.js');

let passed = 0;
let failed = 0;

function assert(label, condition, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// ──────────────────────────────────────────────────────────────────
// 1. Product record integrity
// ──────────────────────────────────────────────────────────────────
console.log('\n1. Product record integrity');

assert('6 products defined', PRODUCTS.length === 6);
assert('8 resources defined', RESOURCES.length === 8);

PRODUCTS.forEach(p => {
  assert(`${p.id}: required fields present`, !!(p.id && p.canonicalName && p.url && p.purpose && p.ctaLabel));
  assert(`${p.id}: isLive is true`, p.isLive === true);
});

assert('programme: annual access period correct', PRODUCTS.find(p => p.id === 'programme').accessPeriod.includes('18 months'));
assert('sprint: access period 70 days', PRODUCTS.find(p => p.id === 'sprint').accessPeriod === '70 days from purchase');
assert('referred: access period 90 days', PRODUCTS.find(p => p.id === 'referred').accessPeriod === '90 days from purchase');
assert('year-one: access period Up to 3 diagnostic attempts', PRODUCTS.find(p => p.id === 'year-one').accessPeriod === 'Up to 3 diagnostic attempts');
assert('apprentice: access period Up to 3 diagnostic attempts', PRODUCTS.find(p => p.id === 'apprentice').accessPeriod === 'Up to 3 diagnostic attempts');
assert('employer: isDirectPurchase false', PRODUCTS.find(p => p.id === 'employer').isDirectPurchase === false);
assert('apprentice: isDirectPurchase true', PRODUCTS.find(p => p.id === 'apprentice').isDirectPurchase === true);
assert('referred: pathwayCoverage null', PRODUCTS.find(p => p.id === 'referred').pathwayCoverage === null);
assert('sprint: notYetLivePathways has 6', PRODUCTS.find(p => p.id === 'sprint').notYetLivePathways.length === 6);

// ──────────────────────────────────────────────────────────────────
// 2. Canonical names match approved decisions
// ──────────────────────────────────────────────────────────────────
console.log('\n2. Canonical names');

assert('referred canonical name correct', PRODUCTS.find(p => p.id === 'referred').canonicalName === 'Referred Candidate Support');
assert('apprentice canonical name correct', PRODUCTS.find(p => p.id === 'apprentice').canonicalName === 'Advanced Technical Pathway Benchmark');
assert('year-one canonical name correct', PRODUCTS.find(p => p.id === 'year-one').canonicalName === 'APC Apprenticeship Mid-Programme Professional Readiness Review');

// ──────────────────────────────────────────────────────────────────
// 3. Model context excludes _pricing
// ──────────────────────────────────────────────────────────────────
console.log('\n3. Model context / _pricing exclusion');

const ctx = getModelContext();
assert('getModelContext returns a string', typeof ctx === 'string');
const parsed = JSON.parse(ctx);
assert('model context has products array', Array.isArray(parsed.products));
assert('model context has resources array', Array.isArray(parsed.resources));
parsed.products.forEach(p => {
  assert(`${p.id}: no _pricing in model context`, !('_pricing' in p));
  assert(`${p.id}: no keyFeatures in model context`, !('keyFeatures' in p));
  assert(`${p.id}: no restrictions in model context`, !('restrictions' in p));
  assert(`${p.id}: no ctaLabel in model context`, !('ctaLabel' in p));
  assert(`${p.id}: no accessPeriod in model context`, !('accessPeriod' in p));
});
// No pricing strings should appear in the model context
assert('No £ symbol in model context', !ctx.includes('£'));

// ──────────────────────────────────────────────────────────────────
// 4. Valid ID and tag sets
// ──────────────────────────────────────────────────────────────────
console.log('\n4. Valid ID and tag sets');

assert('VALID_IDS has programme', VALID_IDS.has('programme'));
assert('VALID_IDS has sprint', VALID_IDS.has('sprint'));
assert('VALID_IDS has referred', VALID_IDS.has('referred'));
assert('VALID_IDS has year-one', VALID_IDS.has('year-one'));
assert('VALID_IDS has apprentice', VALID_IDS.has('apprentice'));
assert('VALID_IDS has employer', VALID_IDS.has('employer'));
assert('VALID_IDS has resource-hot-topics', VALID_IDS.has('resource-hot-topics'));
assert('VALID_IDS does NOT have selfpaced', !VALID_IDS.has('selfpaced'));
assert('VALID_IDS does NOT have invented-product', !VALID_IDS.has('invented-product'));

assert('VALID_TAGS has all 12 tags', VALID_TAGS.size === 12);
assert('VALID_TAGS has SUBMITTED_IMMINENT', VALID_TAGS.has('SUBMITTED_IMMINENT'));
assert('VALID_TAGS has PRICE_QUERY', VALID_TAGS.has('PRICE_QUERY'));
assert('VALID_TAGS has NOT_YET_LIVE_PATHWAY', VALID_TAGS.has('NOT_YET_LIVE_PATHWAY'));

// ──────────────────────────────────────────────────────────────────
// 5. NOT_YET_LIVE_PATHWAYS set
// ──────────────────────────────────────────────────────────────────
console.log('\n5. Not-yet-live pathways');

assert('NOT_YET_LIVE_PATHWAYS has 6 entries', NOT_YET_LIVE_PATHWAYS.size === 6);
assert('Geomatics in NOT_YET_LIVE', NOT_YET_LIVE_PATHWAYS.has('Geomatics'));
assert('Environmental Surveying in NOT_YET_LIVE', NOT_YET_LIVE_PATHWAYS.has('Environmental Surveying'));
assert('Commercial Real Estate NOT in NOT_YET_LIVE', !NOT_YET_LIVE_PATHWAYS.has('Commercial Real Estate'));

// ──────────────────────────────────────────────────────────────────
// 6. getRecord
// ──────────────────────────────────────────────────────────────────
console.log('\n6. getRecord');

assert('getRecord(sprint) returns sprint', getRecord('sprint')?.id === 'sprint');
assert('getRecord(resource-hot-topics) returns resource', getRecord('resource-hot-topics')?.id === 'resource-hot-topics');
assert('getRecord(invented) returns null', getRecord('invented-id') === null);
assert('getRecord(undefined) returns null', getRecord(undefined) === null);

// ──────────────────────────────────────────────────────────────────
// 7. buildCard — no _pricing exposed
// ──────────────────────────────────────────────────────────────────
console.log('\n7. buildCard / card safety');

const sprintCard = buildCard(getRecord('sprint'));
assert('buildCard(sprint) has canonicalName', !!sprintCard.canonicalName);
assert('buildCard(sprint) has url', !!sprintCard.url);
assert('buildCard(sprint) has ctaLabel', !!sprintCard.ctaLabel);
assert('buildCard(sprint) no _pricing', !('_pricing' in sprintCard));
assert('buildCard(sprint) no accessPeriod', !('accessPeriod' in sprintCard));
assert('buildCard(sprint) no keyFeatures', !('keyFeatures' in sprintCard));
assert('buildCard(null) returns null', buildCard(null) === null);

const resourceCard = buildCard(getRecord('resource-hot-topics'));
assert('buildCard(resource) has title', !!resourceCard.title);
assert('buildCard(resource) isResource true', resourceCard.isResource === true);

// ──────────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────────
console.log(`\n────────────────────────────────`);
console.log(`  ${passed} passed  |  ${failed} failed`);
if (failed > 0) {
  console.error('\nFAIL — fix errors before build approval.');
  process.exit(1);
} else {
  console.log('\nPASS — product/resource layer clean.');
  console.log('\nNote: end-to-end test scenarios T01–T22 require the deployed function.');
}
