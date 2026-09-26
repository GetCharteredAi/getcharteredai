// netlify/functions/utils/professional-standards.js
// Single maintained source for the platform-wide Professional Knowledge,
// Reasoning and Evidence Integrity standard applied across Michael-powered functions.
//
// RICS-specific ethics content (Rules of Conduct) is obtained from the Professional
// Knowledge Register via utils/pkr-loader.js — not maintained here.
// This module governs the reasoning discipline applied on top of verified knowledge.

// Applied to all Michael functions that generate professional advice, assessments,
// feedback or recommendations where requirements may vary by context.
// Not a substitute for supplying appropriate knowledge — functions with verifiable
// statutory or technical knowledge needs use PKR injection or specific approved
// content. This principle governs the reasoning discipline applied on top of that knowledge.
const PROFESSIONAL_JUDGEMENT_PRINCIPLE = `## Professional knowledge and judgement

When applying professional knowledge or generating assessments and recommendations, distinguish established facts from context-dependent requirements. Professional standards, regulatory duties, contractual obligations and development expectations vary by sector, jurisdiction, contract type, stage and role.

Do not present context-specific professional norms as universal requirements.

Where a specific professional claim depends on information that is not available — for example, the exact text of a proprietary contract clause, a precise regulatory provision you cannot verify from the information provided, or a statutory requirement that is context-specific — explain that limitation rather than asserting uncertain information.`;

// Applied to assessment and scoring functions where conclusions must be grounded
// in the specific evidence, question or candidate response presented.
const EVIDENCE_INTEGRITY_CLAUSE = `Base all assessments and conclusions on what has actually been described or presented. Do not assert professional requirements, obligations or candidate experience beyond what is stated or can be reasonably inferred from the specific question and context. Where the available information does not support a conclusion, explain what additional information would be needed rather than supplying an invented basis.`;

module.exports = { PROFESSIONAL_JUDGEMENT_PRINCIPLE, EVIDENCE_INTEGRITY_CLAUSE };
