// yr2-engine.js — GCAi Learning Moment Engine (shared module, v1)
// Activation boundary: Year Two Professional Readiness Review only for this release.
// Intent: validate here, extend to other products as a separate, deliberate decision.
// Turning it on elsewhere = update ACTIVE_PRODUCTS and supply a product-specific question bank.

const YR2_ENGINE = {

  // Activation boundary — explicit toggle, not buried in logic
  ACTIVE_PRODUCTS: ['year-two-review'],

  // Six gap types — locked. Do not add Judgement or Responsibility.
  GAP: {
    KNOWLEDGE:           'knowledge',
    PRACTICE:            'practice',
    EXPERIENCE:          'experience',
    EXPOSURE:            'exposure',
    EVIDENCE_RECOGNITION:'evidence-recognition',
    ARTICULATION:        'articulation'
  },

  // Six evidence states — mutually exclusive per question
  STATE: {
    INDEPENDENT:              'independent-demonstration',
    AFTER_PROMPTING:          'demonstrated-after-prompting',
    AFTER_LEARNING:           'demonstrated-after-learning',
    EXPERIENCE_NOT_RECOGNISED:'experience-present-not-recognised',
    INSUFFICIENT:             'insufficient-experience-exposure',
    NOT_YET:                  'not-yet-demonstrated'
  },

  // Learning Moment shapes
  SHAPE: {
    FULL_LOOP:          'full-loop',
    SINGLE_REPROMPT:    'single-reprompt',
    RECOGNITION_PROMPT: 'recognition-prompt',
    NONE:               'none'
  },

  // Development actions (for report recommendations)
  DEV_ACTION: {
    LEARN:           'learn-it',
    APPLY:           'apply-it',
    EXPERIENCE:      'experience-it',
    EXPOSURE:        'gain-exposure',
    RESPONSIBILITY:  'take-greater-responsibility',
    ARTICULATE:      'articulate-it',
    CHALLENGE:       'challenge-the-reasoning'
  },

  // Build a question record for an eligible question where support was NOT triggered
  untriggered(originalResponse) {
    return {
      originalResponse,
      assistanceTriggered: false,
      initialGapIdentified: null,
      promptOrExplanationGiven: null,
      followUpResponse: null,
      finalEvidenceState: this.STATE.INDEPENDENT
    };
  },

  // Build a question record for a question that is unassisted by design (Q13, Q19, Q29 self-report, Q30)
  unassisted(originalResponse) {
    return {
      originalResponse,
      assistanceTriggered: false,
      initialGapIdentified: null,
      promptOrExplanationGiven: null,
      followUpResponse: null,
      finalEvidenceState: null  // holistic pass judges, not per-question code
    };
  },

  // Build a question record for a context-only question (Q1, Q2 — not scored)
  context(selection) {
    return { contextSelection: selection, scored: false };
  },

  // Build a completed Learning Moment record
  fromLM({ originalResponse, gapType, explainText, followUpResponse, evidenceState }) {
    return {
      originalResponse,
      assistanceTriggered: true,
      initialGapIdentified: gapType || null,
      promptOrExplanationGiven: explainText || null,
      followUpResponse: followUpResponse || null,
      finalEvidenceState: evidenceState
    };
  },

  // Word counter for textarea enforcement
  wordCount(text) {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  },

  // Format provenance record for the final report context string
  formatForReport(index, question, record) {
    if (!record) return `Q${index + 1}: [no response]`;
    if (record.scored === false) {
      return `Q${index + 1} [${question.areaName} — context]: ${JSON.stringify(record.contextSelection)}`;
    }

    let out = `Q${index + 1} [${question.areaName}]: ${question.question}\n`;
    out += `  Response: ${record.originalResponse || '(not answered)'}`;

    if (record.extras) {
      if (record.extras.alwaysFollowUp) out += `\n  Follow-up (always asked): ${record.extras.alwaysFollowUp}`;
      if (record.extras.diaryEntry)     out += `\n  Diary entry pasted: ${record.extras.diaryEntry}`;
      if (record.extras.multiSelect)    out += `\n  Multi-select choices: ${record.extras.multiSelect.join(', ')}`;
      if (record.extras.priorities)     out += `\n  Development priorities selected: ${record.extras.priorities.join(', ')}`;
    }

    if (record.assistanceTriggered) {
      out += `\n  [Learning Moment triggered]`;
      if (record.initialGapIdentified) out += `\n  Gap identified: ${record.initialGapIdentified}`;
      if (record.promptOrExplanationGiven) out += `\n  Michael's support: ${record.promptOrExplanationGiven}`;
      if (record.followUpResponse) out += `\n  Follow-up response: ${record.followUpResponse}`;
    }

    if (record.finalEvidenceState) out += `\n  Evidence state: ${record.finalEvidenceState}`;
    return out;
  }

};
