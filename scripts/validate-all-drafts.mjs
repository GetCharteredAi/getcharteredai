// scripts/validate-all-drafts.mjs
// Schema validation for all four Manager Learning draft modules.
// Checks structural correctness, required fields, practiceCharacter completeness,
// stageLabel presence, HTML tag allowlist, and published:false on every topic.
//
// Usage: node scripts/validate-all-drafts.mjs

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DRAFT_FILES = [
  'manager-lessons-draft-m1.json',
  'manager-lessons-draft-m2.json',
  'manager-lessons-draft-m3.json',
  'manager-lessons-draft-m4.json',
];

const ALLOWED_HTML = ['p','ul','ol','li','strong','em','h2','h3','h4','a','blockquote','br'];
const DATA_DISCLOSURE_RE = /share.{0,30}(personal details|personal information|private information|medical|health details|family details|home address)/i;

// ── Per-run counters ───────────────────────────────────────────────────────────

let totalPass = 0;
let totalFail = 0;

function ok(label) {
  console.log(`  PASS  ${label}`);
  totalPass++;
}

function fail(label, detail) {
  console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  totalFail++;
}

function assert(condition, label, detail) {
  condition ? ok(label) : fail(label, detail);
}

// ── Validate a single draft file ───────────────────────────────────────────────

function validateFile(filename) {
  const filePath = path.resolve(__dirname, '../netlify/functions', filename);
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Validating ${filename}\n`);

  // Load
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
    ok('file is readable');
  } catch (e) {
    fail('file is readable', e.message);
    return;
  }

  let data;
  try {
    data = JSON.parse(raw);
    ok('file is valid JSON');
  } catch (e) {
    fail('file is valid JSON', e.message);
    return;
  }

  // Root structure
  assert(data._draft === true,       'root._draft is true');
  assert(typeof data._note === 'string' && data._note.length > 0, 'root._note is non-empty string');
  assert(Array.isArray(data.topics), 'root.topics is an array');
  assert(data.topics.length > 0,     'root.topics is non-empty');

  for (const [tIdx, topic] of data.topics.entries()) {
    const tid    = topic.id ?? `(topic[${tIdx}])`;
    const prefix = `topic[${tIdx}] "${tid}"`;

    assert(typeof topic.id === 'string' && topic.id.length > 0,
      `${prefix}: id is a non-empty string`);
    assert(typeof topic.title === 'string' && topic.title.length > 0,
      `${prefix}: title is a non-empty string`);
    assert(topic.published === false,
      `${prefix}: published is false (draft safety)`, `got: ${JSON.stringify(topic.published)}`);
    assert(Array.isArray(topic.sections),
      `${prefix}: sections is an array`);
    assert(topic.sections.length > 0,
      `${prefix}: sections is non-empty`);

    let practiceCount = 0;
    let reflectCount  = 0;
    let contentCount  = 0;
    let stageLabelCount = 0;

    const VALID_TYPES = new Set(['content', 'reflect', 'practice']);

    for (const [sIdx, section] of topic.sections.entries()) {
      const sp = `${prefix} section[${sIdx}]`;

      assert(section && typeof section === 'object', `${sp}: is an object`);
      assert(typeof section.sectionType === 'string',  `${sp}: sectionType is a string`);
      assert(VALID_TYPES.has(section.sectionType),
        `${sp}: sectionType is content|reflect|practice`, `got: "${section.sectionType}"`);

      // stageLabel presence
      if (typeof section.stageLabel === 'string' && section.stageLabel.length > 0) {
        stageLabelCount++;
        ok(`${sp}: stageLabel present ("${section.stageLabel}")`);
      } else {
        fail(`${sp}: stageLabel is a non-empty string`, `got: ${JSON.stringify(section.stageLabel)}`);
      }

      if (section.sectionType === 'content') {
        contentCount++;
        assert(typeof section.body === 'string' && section.body.length > 0,
          `${sp} (content): body is a non-empty string`);

        if (typeof section.body === 'string') {
          const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)/g;
          const disallowed = [];
          let m;
          while ((m = tagRe.exec(section.body)) !== null) {
            const tag = m[1].toLowerCase();
            if (!ALLOWED_HTML.includes(tag) && !disallowed.includes(tag)) disallowed.push(tag);
          }
          assert(disallowed.length === 0,
            `${sp} (content): body uses only allowed HTML tags`,
            disallowed.length > 0 ? `disallowed: ${disallowed.join(', ')}` : undefined);
          assert(!section.body.toLowerCase().includes('<script'),
            `${sp} (content): body contains no <script> tags`);
        }

      } else if (section.sectionType === 'reflect') {
        reflectCount++;
        assert(typeof section.reflectionPrompt === 'string' && section.reflectionPrompt.length > 0,
          `${sp} (reflect): reflectionPrompt is a non-empty string`);
        assert(!Object.prototype.hasOwnProperty.call(section, 'practiceCharacter'),
          `${sp} (reflect): no practiceCharacter field`);

      } else if (section.sectionType === 'practice') {
        practiceCount++;
        assert(typeof section.practicePrompt === 'string' && section.practicePrompt.length > 0,
          `${sp} (practice): practicePrompt is a non-empty string`);
        assert(!DATA_DISCLOSURE_RE.test(section.practicePrompt ?? ''),
          `${sp} (practice): practicePrompt does not encourage personal data disclosure`);

        const pc = section.practiceCharacter;
        assert(pc && typeof pc === 'object',
          `${sp} (practice): practiceCharacter is an object`);

        if (pc && typeof pc === 'object') {
          assert(typeof pc.name === 'string' && pc.name.trim().length > 0,
            `${sp} (practice): practiceCharacter.name is a non-empty string`);
          assert(typeof pc.yearDescription === 'string' && pc.yearDescription.length > 0,
            `${sp} (practice): practiceCharacter.yearDescription is a non-empty string`);
          assert(typeof pc.pathway === 'string' && pc.pathway.length > 0,
            `${sp} (practice): practiceCharacter.pathway is a non-empty string`);
          assert(typeof pc.scenarioContext === 'string' && pc.scenarioContext.length > 100,
            `${sp} (practice): practiceCharacter.scenarioContext is substantial (>100 chars)`,
            `got length: ${pc.scenarioContext?.length ?? 0}`);
          if (typeof pc.scenarioContext === 'string' && typeof pc.name === 'string') {
            assert(pc.scenarioContext.includes(pc.name),
              `${sp} (practice): scenarioContext references character by name ("${pc.name}")`);
          }
        }
      }
    }

    // Five-stage structure
    assert(contentCount >= 2,  `${prefix}: at least 2 content sections (got ${contentCount})`);
    assert(practiceCount >= 1, `${prefix}: at least 1 practice section (got ${practiceCount})`);
    assert(reflectCount >= 1,  `${prefix}: at least 1 reflect section (got ${reflectCount})`);
    assert(stageLabelCount === topic.sections.length,
      `${prefix}: every section has a stageLabel (${stageLabelCount}/${topic.sections.length})`);

    // Stage order: content → content → practice → content → reflect
    const types = topic.sections.map(s => s.sectionType);
    assert(types[0] === 'content',  `${prefix}: section[0] is content (Understand)`);
    assert(types[1] === 'content',  `${prefix}: section[1] is content (Recognise)`);
    assert(types[2] === 'practice', `${prefix}: section[2] is practice (Practise)`);
    assert(types[3] === 'content',  `${prefix}: section[3] is content (Apply)`);
    assert(types[4] === 'reflect',  `${prefix}: section[4] is reflect (Reflect)`);
  }
}

// ── Run ────────────────────────────────────────────────────────────────────────

for (const filename of DRAFT_FILES) {
  validateFile(filename);
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`Total: ${totalPass}/${totalPass + totalFail} checks passed across ${DRAFT_FILES.length} modules`);

if (totalFail === 0) {
  console.log('All draft modules are structurally valid and unpublished.\n');
  process.exit(0);
} else {
  console.error(`\n${totalFail} validation error(s) — correct before publishing.\n`);
  process.exit(1);
}
