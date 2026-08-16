// apprentice-engine.js — GCAi Apprentice Professional Readiness Review Engine
// Activation boundary: Apprentice Professional Readiness Review only for this release.
// Do not modify yr2-engine.js — each product has its own engine with its own activation scope.

const AREV_ENGINE = {

  ACTIVE_PRODUCTS: ['apprentice-review'],

  // Six gap types — locked. Do not add Judgement or Responsibility.
  GAP: {
    KNOWLEDGE:            'knowledge',
    PRACTICE:             'practice',
    EXPERIENCE:           'experience',
    EXPOSURE:             'exposure',
    EVIDENCE_RECOGNITION: 'evidence-recognition',
    ARTICULATION:         'articulation'
  },

  // Six evidence states — mutually exclusive per question
  STATE: {
    INDEPENDENT:               'independent-demonstration',
    AFTER_PROMPTING:           'demonstrated-after-prompting',
    AFTER_LEARNING:            'demonstrated-after-learning',
    EXPERIENCE_NOT_RECOGNISED: 'experience-present-not-recognised',
    INSUFFICIENT:              'insufficient-experience-exposure',
    NOT_YET:                   'not-yet-demonstrated'
  },

  // Learning Moment shapes — five in this build
  SHAPE: {
    FULL_LOOP:             'full-loop',
    SINGLE_REPROMPT:       'single-reprompt',
    RECOGNITION_PROMPT:    'recognition-prompt',
    RECOGNITION_FULLLOOP:  'recognition-then-fullloop',
    BESPOKE_A5:            'bespoke-a5',
    NONE:                  'none'
  },

  // Build a record for a question answered without assistance
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

  // Build a record for a context/calibration/self-report question (not scored)
  context(selection) {
    return { contextSelection: selection, scored: false };
  },

  // Build a record for a question with no assistance by design (no escape option)
  unassisted(originalResponse) {
    return {
      originalResponse,
      assistanceTriggered: false,
      initialGapIdentified: null,
      promptOrExplanationGiven: null,
      followUpResponse: null,
      finalEvidenceState: null
    };
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

  // Build an observational learning record (§9a — not a standard LM, not a provenance state)
  fromObservational({ originalResponse, observedDescription, reflection }) {
    return {
      originalResponse,
      assistanceTriggered: false,
      initialGapIdentified: null,
      promptOrExplanationGiven: null,
      followUpResponse: null,
      finalEvidenceState: this.STATE.INSUFFICIENT,
      observationalLearning: true,
      observationalDescription: observedDescription || null,
      observationalReflection: reflection || null
    };
  },

  // Build a stage-flag record (A8 escape — silently accepted, flagged for report)
  stageFlag(originalResponse) {
    return {
      originalResponse,
      assistanceTriggered: false,
      initialGapIdentified: null,
      promptOrExplanationGiven: null,
      followUpResponse: null,
      finalEvidenceState: null,
      stageFlag: true
    };
  },

  wordCount(text) {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  },

  formatForReport(index, question, record) {
    if (!record) return `A${index + 1}: [no response]`;
    if (record.scored === false) {
      let out = `A${index + 1} [${question.areaName} — context]: ${JSON.stringify(record.contextSelection)}`;
      if (record.extras?.alwaysFollowUp) out += `\n  Follow-up (always asked): ${record.extras.alwaysFollowUp}`;
      return out;
    }

    let out = `A${index + 1} [${question.areaName}]: ${question.question}\n`;
    out += `  Response: ${record.originalResponse || '(not answered)'}`;

    if (record.extras) {
      if (record.extras.alwaysFollowUp)      out += `\n  Follow-up (always asked): ${record.extras.alwaysFollowUp}`;
      if (record.extras.investigationFollowUp) out += `\n  Investigation follow-up: ${record.extras.investigationFollowUp}`;
      if (record.extras.multiSelect)         out += `\n  Multi-select choices: ${Array.isArray(record.extras.multiSelect) ? record.extras.multiSelect.join(', ') : record.extras.multiSelect}`;
      if (record.extras.priorities)          out += `\n  Priorities selected: ${record.extras.priorities.join(', ')}`;
      if (record.extras.priorityFirst)       out += `\n  Top priority: ${record.extras.priorityFirst}`;
      if (record.extras.commercialItem)      out += `\n  Commercial item chosen: ${record.extras.commercialItem}`;
      if (record.extras.routeExperience)     out += `\n  Route experience areas selected: ${record.extras.routeExperience.join(', ')}`;
      if (record.extras.stageContext)        out += `\n  Stage context: ${record.extras.stageContext}`;
    }

    if (record.observationalLearning) {
      out += `\n  [Observational learning noted — not personal demonstration]`;
      if (record.observationalDescription) out += `\n  Observed: ${record.observationalDescription}`;
      if (record.observationalReflection)  out += `\n  Reflection: ${record.observationalReflection}`;
    }

    if (record.stageFlag) {
      out += `\n  [Stage-appropriate limitation — flag for report interpretation]`;
    }

    if (record.assistanceTriggered) {
      out += `\n  [Learning Moment triggered]`;
      if (record.initialGapIdentified)      out += `\n  Gap identified: ${record.initialGapIdentified}`;
      if (record.promptOrExplanationGiven)  out += `\n  Michael's support: ${record.promptOrExplanationGiven}`;
      if (record.followUpResponse)          out += `\n  Follow-up response: ${record.followUpResponse}`;
    }

    if (record.finalEvidenceState) out += `\n  Evidence state: ${record.finalEvidenceState}`;
    return out;
  }

};
