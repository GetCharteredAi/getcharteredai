// netlify/functions/utils/p1-taxonomy.js
// Canonical GCAi Professional Readiness Development Taxonomy.
// Import in AI prompt files and analytics functions — do not redefine inline.

const GAP_TYPE_ENUM = 'knowledge|application|practice|exposure|observed-exposure|evidence-recognition|articulation|judgement|responsibility-escalation|confidence-calibration';

const GAP_TYPE_FAMILIES = {
  'knowledge':                 'learning-practice',
  'application':               'learning-practice',
  'practice':                  'learning-practice',
  'exposure':                  'workplace-exposure',
  'observed-exposure':         'workplace-exposure',
  'evidence-recognition':      'recognition-articulation',
  'articulation':              'recognition-articulation',
  'judgement':                 'judgement-responsibility',
  'responsibility-escalation': 'judgement-responsibility',
  'confidence-calibration':    'confidence-calibration',
  'experience':                'workplace-exposure',   // legacy pre-taxonomy value
};

const GAP_TYPE_DISPLAY_LABELS = {
  'knowledge':                 'Knowledge',
  'application':               'Application',
  'practice':                  'Practice',
  'exposure':                  'Workplace exposure',
  'observed-exposure':         'Observed exposure',
  'evidence-recognition':      'Evidence recognition',
  'articulation':              'Articulation',
  'judgement':                 'Judgement',
  'responsibility-escalation': 'Responsibility / escalation',
  'confidence-calibration':    'Confidence calibration',
};

const TAXONOMY_DEFINITIONS_BLOCK = `## GCAi Development Taxonomy

Before assigning a gapType, distinguish the limiting factor:

- knowledge — does not yet sufficiently understand the relevant principle, concept or requirement
- application — understands the principle but cannot yet apply it reliably to a realistic situation
- practice — can apply after explanation, prompting or support, but needs repetition before independent and consistent demonstration
- exposure — has not yet had a reasonable workplace opportunity to demonstrate the capability
- observed-exposure — has seen it demonstrated and can recognise the reasoning, but has not yet undertaken it personally
- evidence-recognition — has relevant experience but does not recognise it as evidence of the capability being explored
- articulation — has relevant understanding or experience but cannot yet explain the reasoning, decision or evidence clearly enough
- judgement — knows the technical principle but is not yet consistently weighing context, risk, consequences, alternatives or professional responsibility
- responsibility-escalation — needs greater clarity about what they can own, when to seek support, and when escalation is appropriate
- confidence-calibration — self-perception and demonstrated capability are materially out of alignment

Governing rule: Do not assign a gapType until the evidence distinguishes which of the above applies. Lack of opportunity is not lack of capability. Distinguish exposure gaps from knowledge or practice gaps. Distinguish evidence-recognition problems from genuine capability gaps.`;

const TAXONOMY_REPORTING_PRINCIPLE = `Prefer development language: strengths, development priorities, exposure needs, practice needs, recognition needs, articulation needs, next development opportunities. Do not use "gap" as the default label. Reserve "gap" for genuine deficits in knowledge, application or demonstrated capability.`;

const TAXONOMY_FINAL_ANALYSIS_QUESTIONS = `Before writing output, address all four questions:
1. What can this person already demonstrate?
2. Where is their professional capability currently developing?
3. What is actually preventing further progress?
4. What should happen next?`;

module.exports = {
  GAP_TYPE_ENUM,
  GAP_TYPE_FAMILIES,
  GAP_TYPE_DISPLAY_LABELS,
  TAXONOMY_DEFINITIONS_BLOCK,
  TAXONOMY_REPORTING_PRINCIPLE,
  TAXONOMY_FINAL_ANALYSIS_QUESTIONS,
};
