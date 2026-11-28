// scripts/validate-draft-m1.mjs
// Schema validation for manager-lessons-draft-m1.json.
// Checks structural correctness, required fields, practiceCharacter completeness,
// and confirms published:false on every topic.
//
// Usage: node scripts/validate-draft-m1.mjs

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRAFT_PATH = path.resolve(__dirname, '../netlify/functions/manager-lessons-draft-m1.json');

// ── Helpers ────────────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;

function ok(label) {
  console.log(`  PASS  ${label}`);
  pass++;
}

function err(label, detail) {
  console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  fail++;
}

function assert(condition, label, detail) {
  condition ? ok(label) : err(label, detail);
}

// ── Load file ──────────────────────────────────────────────────────────────────

console.log('\nValidating manager-lessons-draft-m1.json\n');

let raw;
try {
  raw = fs.readFileSync(DRAFT_PATH, 'utf8');
  ok('draft file is readable');
} catch (e) {
  err('draft file is readable', e.message);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
  ok('draft file is valid JSON');
} catch (e) {
  err('draft file is valid JSON', e.message);
  process.exit(1);
}

// ── Root structure ─────────────────────────────────────────────────────────────

assert(data._draft === true,       'root._draft is true (draft flag present)');
assert(typeof data._note === 'string' && data._note.length > 0, 'root._note is non-empty string');
assert(Array.isArray(data.topics), 'root.topics is an array');
assert(data.topics.length > 0,     'root.topics contains at least one topic');

// ── Topic validation ───────────────────────────────────────────────────────────

for (const [tIdx, topic] of data.topics.entries()) {
  const tid = topic.id ?? `(topic[${tIdx}])`;
  const prefix = `topic[${tIdx}] "${tid}"`;

  assert(typeof topic.id === 'string' && topic.id.length > 0,
    `${prefix}: id is a non-empty string`);
  assert(typeof topic.title === 'string' && topic.title.length > 0,
    `${prefix}: title is a non-empty string`);
  assert(topic.published === false,
    `${prefix}: published is false (draft safety check)`, `got: ${JSON.stringify(topic.published)}`);
  assert(Array.isArray(topic.sections),
    `${prefix}: sections is an array`);
  assert(topic.sections.length > 0,
    `${prefix}: sections is non-empty`);

  const VALID_TYPES = new Set(['content', 'reflect', 'practice']);
  let practiceCount = 0;
  let reflectCount  = 0;
  let contentCount  = 0;

  for (const [sIdx, section] of topic.sections.entries()) {
    const sp = `${prefix} section[${sIdx}]`;

    assert(section && typeof section === 'object',
      `${sp}: is an object`);
    assert(typeof section.sectionType === 'string',
      `${sp}: sectionType is a string`);
    assert(VALID_TYPES.has(section.sectionType),
      `${sp}: sectionType is content|reflect|practice`, `got: "${section.sectionType}"`);

    if (section.sectionType === 'content') {
      contentCount++;
      assert(typeof section.body === 'string' && section.body.length > 0,
        `${sp} (content): body is a non-empty string`);

      // Check only allowed HTML tags are used
      const ALLOWED = ['p','ul','ol','li','strong','em','h2','h3','h4','a','blockquote','br'];
      const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)/g;
      const disallowed = [];
      let m;
      while ((m = tagPattern.exec(section.body)) !== null) {
        const tag = m[1].toLowerCase();
        if (!ALLOWED.includes(tag) && !disallowed.includes(tag)) {
          disallowed.push(tag);
        }
      }
      assert(disallowed.length === 0,
        `${sp} (content): body uses only allowed HTML tags`,
        disallowed.length > 0 ? `disallowed: ${disallowed.join(', ')}` : undefined);

      // No <script> tags
      assert(!section.body.toLowerCase().includes('<script'),
        `${sp} (content): body contains no <script> tags`);

    } else if (section.sectionType === 'reflect') {
      reflectCount++;
      assert(typeof section.reflectionPrompt === 'string' && section.reflectionPrompt.length > 0,
        `${sp} (reflect): reflectionPrompt is a non-empty string`);
      assert(!Object.prototype.hasOwnProperty.call(section, 'practiceCharacter'),
        `${sp} (reflect): no practiceCharacter field (server-only fields must not be on reflect sections)`);

    } else if (section.sectionType === 'practice') {
      practiceCount++;
      assert(typeof section.practicePrompt === 'string' && section.practicePrompt.length > 0,
        `${sp} (practice): practicePrompt is a non-empty string`);

      const pc = section.practiceCharacter;
      assert(pc && typeof pc === 'object',
        `${sp} (practice): practiceCharacter is an object`);

      if (pc && typeof pc === 'object') {
        assert(typeof pc.name === 'string' && pc.name.length > 0,
          `${sp} (practice): practiceCharacter.name is a non-empty string`);
        assert(typeof pc.yearDescription === 'string' && pc.yearDescription.length > 0,
          `${sp} (practice): practiceCharacter.yearDescription is a non-empty string`);
        assert(typeof pc.pathway === 'string' && pc.pathway.length > 0,
          `${sp} (practice): practiceCharacter.pathway is a non-empty string`);
        assert(typeof pc.scenarioContext === 'string' && pc.scenarioContext.length > 100,
          `${sp} (practice): practiceCharacter.scenarioContext is a substantial string (>100 chars)`,
          `got length: ${pc.scenarioContext?.length ?? 0}`);

        // Debrief uses character.name, .yearDescription, .scenarioContext — verify non-empty
        assert(pc.name.trim().length > 0,
          `${sp} (practice): practiceCharacter.name is non-blank`);
        assert(pc.scenarioContext.includes('Jordan') || pc.scenarioContext.includes(pc.name),
          `${sp} (practice): scenarioContext references character by name`);
      }

      // Check practicePrompt does not encourage disclosure of personal data.
      // Uses a tight character window ({0,30}) so the match cannot span two sentences.
      // Catches: "share personal details/information", "share private information",
      // "share medical/health/family/home details" etc.
      const dataDisclosure = /share.{0,30}(personal details|personal information|private information|medical|health details|family details|home address)/i;
      assert(!dataDisclosure.test(section.practicePrompt),
        `${sp} (practice): practicePrompt does not encourage personal data disclosure`);
    }
  }

  // Five-stage structure checks
  assert(contentCount >= 2,
    `${prefix}: at least 2 content sections present (got ${contentCount})`);
  assert(practiceCount >= 1,
    `${prefix}: at least 1 practice section present (got ${practiceCount})`);
  assert(reflectCount >= 1,
    `${prefix}: at least 1 reflect section present (got ${reflectCount})`);

  // Verify stage order: content → content → practice → content → reflect
  const types = topic.sections.map(s => s.sectionType);
  assert(types[0] === 'content',
    `${prefix}: section[0] is content (Understand)`);
  assert(types[1] === 'content',
    `${prefix}: section[1] is content (Recognise)`);
  assert(types[2] === 'practice',
    `${prefix}: section[2] is practice (Practise with Michael)`);
  assert(types[3] === 'content',
    `${prefix}: section[3] is content (Apply)`);
  assert(types[4] === 'reflect',
    `${prefix}: section[4] is reflect (Reflect with Michael)`);
}

// ── Summary ────────────────────────────────────────────────────────────────────

console.log('');
console.log('────────────────────────────────────────────────');
console.log(`Schema validation: ${pass}/${pass + fail} passed`);

if (fail === 0) {
  console.log('All checks passed. Draft is structurally valid.');
  console.log('\nNext step: content review by publisher, then set published:true and');
  console.log('copy the topic into manager-lessons-data.json when approved.\n');
  process.exit(0);
} else {
  console.error(`\n${fail} validation error(s) — correct before publishing.\n`);
  process.exit(1);
}
