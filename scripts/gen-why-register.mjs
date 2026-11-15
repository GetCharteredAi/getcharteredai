/**
 * One-off generator for the 316-question why-correction register.
 * Reads netlify/functions/questions-data.json, drafts a provisional `why`
 * for every question whose `why` is absent/null/empty, and writes a CSV for
 * SME review. Does NOT modify the question bank.
 *
 * Run: node scripts/gen-why-register.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const require = createRequire(import.meta.url);
const data = require(path.join(root, 'netlify/functions/questions-data.json'));

// Standard CSV field quoting (RFC 4180): wrap in quotes if it contains
// comma, quote or newline; escape embedded quotes by doubling.
function csv(v) {
  const s = (v === undefined || v === null) ? '' : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// Classify the expected response type from question wording only.
// Mirrors the intent of _inferLevelCue in tofy-speak.js (no verified level metadata exists).
function responseType(qt) {
  const t = (qt || '').toLowerCase().trim();
  if (/^(how would you|how do you)\b.{0,40}\bexplain\b/.test(t)) return 'knowledge explanation';
  if (/\badvis(e|ing|ory)\b|\brecommend\b|\bjustif\b/.test(t) || /^(what advice|a client asks)/.test(t)) return 'professional advice';
  if (/^(how would you|how do you|describe your approach|what would you do|what steps|how do|how would)\b/.test(t)) return 'practical application';
  if (/^(what is|what are|define|explain|describe|outline|name)\b/.test(t)) return 'knowledge explanation';
  return 'knowledge explanation';
}

// The 6 pathways whose module tag is just the bare pathway name (or a near-identical
// banner) carry no specific competency/sub-competency mapping — flag for SME review.
// "M11B" is a generic pathway-specific module banner with no sub-competency detail — flag too.
function smeAssessment(pathway, module) {
  const m = (module || '').trim();
  const genericBanners = new Set([
    'Facilities Management', 'Rural', 'Land and Resources', 'Building Control',
    'Corporate Real Estate', 'Management Consultancy'
  ]);
  // bare pathway name (exact or whitespace-insensitive match to the pathway)
  const bareName = m.toLowerCase() === (pathway || '').toLowerCase();
  if (m === 'M11B') {
    return { flag: 'Yes', reason: 'Module tag is generic M11B pathway banner — no sub-competency detail to confirm specific competency mapping.' };
  }
  if (genericBanners.has(m) || bareName) {
    return { flag: 'Yes', reason: 'Module tag is the bare pathway name (generic banner) — specific RICS competency and level cannot be confirmed from metadata.' };
  }
  return { flag: 'No', reason: '' };
}

function confidence(pass, keyPoints, smeFlagged) {
  const hasSubstance = (pass && pass.trim().length > 20) && (keyPoints && keyPoints.length >= 2);
  // Low where module tag is generic (specific competency uncertain).
  if (smeFlagged) return 'Low';
  if (hasSubstance) return 'Medium';
  return 'Low';
}

// Draft a 1–3 sentence why grounded ONLY in the existing pass answer and keyPoints.
// States the competency principle / professional knowledge tested and the expected
// response type. Does not invent technical requirements beyond the evidenced content.
function draftWhy(q, pathway) {
  const rt = responseType(q.q);
  const kp = (q.keyPoints || []).filter(Boolean);
  const principle = kp.length ? kp[0].replace(/\.$/, '') : (q.pass || '').split(/[.;]/)[0].trim();

  let s1;
  if (rt === 'knowledge explanation') {
    s1 = `Tests the candidate's technical knowledge and understanding in ${pathway}, specifically the ability to explain the relevant principles accurately.`;
  } else if (rt === 'professional advice') {
    s1 = `Tests the candidate's professional judgement and reasoning in ${pathway}, requiring them to give or justify reasoned advice rather than recite facts alone.`;
  } else {
    s1 = `Tests the candidate's practical application of ${pathway} knowledge, assessing whether they can describe a sound, methodical approach and the reasoning behind it.`;
  }

  let s2 = '';
  if (principle) {
    // Preserve original casing: lowercasing the first letter would mangle acronyms
    // (FM, MEES, RICS) that frequently open a keyPoint. Keep it as written.
    s2 = ` A sound answer reflects that ${principle}.`;
  }

  const s3 = ` Expected response type: ${rt}.`;
  return (s1 + s2 + s3).replace(/\s+/g, ' ').trim();
}

const rows = [];
rows.push('pathway,index,question,existing_why,keypoints_summary,proposed_why,confidence,sme_flag,sme_flag_reason');

let count = 0;
for (const [pathway, qs] of Object.entries(data)) {
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    const missing = q.why === undefined || q.why === null || q.why === '';
    if (!missing) continue;
    count++;

    const kp = (q.keyPoints || []).filter(Boolean);
    let kpSummary = kp.slice(0, 2).join(' | ');
    if (kpSummary.length > 120) kpSummary = kpSummary.slice(0, 117) + '...';

    const sme = smeAssessment(pathway, q.module);
    const conf = confidence(q.pass, kp, sme.flag === 'Yes');
    const proposed = draftWhy(q, pathway);

    rows.push([
      csv(pathway),
      csv(i),
      csv(q.q),
      csv(q.why === undefined || q.why === null ? '' : q.why),
      csv(kpSummary),
      csv(proposed),
      csv(conf),
      csv(sme.flag),
      csv(sme.reason)
    ].join(','));
  }
}

const out = path.join(root, 'scripts/why-correction-register.csv');
writeFileSync(out, rows.join('\n') + '\n', 'utf8');
console.log('Wrote', out);
console.log('Data rows (excluding header):', count);
console.log('Total lines (incl header):', rows.length);
