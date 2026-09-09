// netlify/functions/p1-cohort-analytics-background.js
// Background function. Internal secret gate.
// Reads {sessionId}/cohort-safe and {sessionId}/metadata only — no other per-session blobs opened.
// POST { cohortId, internalSecret, runToken }
// Writes {cohortId}/snapshot to p1-cohorts store.

const { getStore } = require('@netlify/blobs');
const PREFIX = process.env.P1_STORE_PREFIX ? `${process.env.P1_STORE_PREFIX}-` : '';

const FIVE_AREAS = [
  'Professional Behaviour & Responsibility',
  'Communication & Working With Others',
  'Learning & Applying Knowledge',
  'Judgement, Help & Escalation',
  'Feedback, Reflection & Development'
];

const OUTCOME_KEYS = ['ON TRACK', 'DEVELOPING', 'SUPPORT WOULD HELP', 'NOT YET ENOUGH EXPOSURE'];

const PROGRESS_LABELS = [
  'Progress evident',
  'Some progress',
  'Limited evidence of progress',
  'Priority should be reconsidered'
];

const ANALYTICS_ELIGIBLE = new Set([
  'summary-ready', 'reflection-ready', 'progress-reflection-open',
  'progress-manager-invited', 'progress-synthesising',
  'progress-manager-lapsed', 'progress-ready', 'progress-complete'
]);

const PHASE4_COMPLETE = new Set(['progress-ready', 'progress-complete']);

const MIN_GROUP = 5;

// ── Store helpers ─────────────────────────────────────────────────────────────

function getSessionStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-sessions`)
    : getStore({ name: `${PREFIX}p1-sessions`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function getCohortStore() {
  return process.env.NETLIFY_BLOBS_CONTEXT
    ? getStore(`${PREFIX}p1-cohorts`)
    : getStore({ name: `${PREFIX}p1-cohorts`, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

// ── Session fetching ──────────────────────────────────────────────────────────

async function fetchSessions(sessionIds, sessionStore) {
  const BATCH = 20;
  const all = [];
  for (let i = 0; i < sessionIds.length; i += BATCH) {
    const slice = sessionIds.slice(i, i + BATCH);
    const chunk = await Promise.all(slice.map(async id => {
      const [meta, safe] = await Promise.all([
        sessionStore.get(`${id}/metadata`, { type: 'json' }),
        sessionStore.get(`${id}/cohort-safe`, { type: 'json' })
      ]);
      return { id, meta, safe };
    }));
    all.push(...chunk);
  }
  return all;
}

// ── Backward-compat helpers ───────────────────────────────────────────────────
// Sessions written before the schema update used separate priorityAreas / priorityGapTypes arrays
// (potentially misaligned after filter). New sessions use developmentPriorities: [{ area, gapType }].

function getBenchmarkPriorities(safe) {
  if (safe?.benchmark?.developmentPriorities) return safe.benchmark.developmentPriorities;
  const areas = safe?.benchmark?.priorityAreas || [];
  const gapTypes = safe?.benchmark?.priorityGapTypes || [];
  return areas.map((area, i) => ({ area: area || null, gapType: gapTypes[i] || null }));
}

function getSynthesisPriorities(safe) {
  if (safe?.phase3?.michaelSynthesisPriorities) return safe.phase3.michaelSynthesisPriorities;
  return (safe?.phase3?.developmentFocusAreas || []).map(area => ({ area: area || null, gapType: null }));
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function blankAreaOutcomes() {
  const obj = {};
  for (const area of FIVE_AREAS) {
    obj[area] = { 'ON TRACK': 0, 'DEVELOPING': 0, 'SUPPORT WOULD HELP': 0, 'NOT YET ENOUGH EXPOSURE': 0, total: 0 };
  }
  return obj;
}

function accumulateAreaOutcomes(map, sessions) {
  for (const s of sessions) {
    for (const a of (s.safe?.benchmark?.areas || [])) {
      if (map[a.name] && OUTCOME_KEYS.includes(a.outcome)) {
        map[a.name][a.outcome]++;
        map[a.name].total++;
      }
    }
  }
}

function sortedEntries(obj) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
}

function pct(n, d) {
  return d > 0 ? `${Math.round(n / d * 100)}%` : '—';
}

// ── Exposure intelligence ─────────────────────────────────────────────────────
// Four-state breakdown per area. unavailable = legacy sessions without exposure data;
// excluded from denominator; coverage reported explicitly.

function computeExposureIntelligence(eligible) {
  const byArea = {};
  for (const area of FIVE_AREAS) {
    byArea[area] = { confirmedLack: 0, relevantExposure: 0, notAssessed: 0, unavailable: 0, denominator: 0 };
  }
  const withBench = eligible.filter(s => s.safe?.benchmark?.areas?.length);
  let coveredSessions = 0;
  for (const s of withBench) {
    let sessionCovered = false;
    for (const a of s.safe.benchmark.areas) {
      if (!byArea[a.name]) continue;
      const ec = a.exposureConfirmation || 'unavailable';
      if (ec === 'unavailable') {
        byArea[a.name].unavailable++;
      } else {
        if (ec === 'confirmed-lack-of-exposure') byArea[a.name].confirmedLack++;
        else if (ec === 'relevant-exposure-identified') byArea[a.name].relevantExposure++;
        else if (ec === 'not-assessed') byArea[a.name].notAssessed++;
        byArea[a.name].denominator++;
        sessionCovered = true;
      }
    }
    if (sessionCovered) coveredSessions++;
  }
  return {
    coverage: {
      coveredSessions,
      total: withBench.length,
      note: `Exposure confirmation available for ${coveredSessions} of ${withBench.length} sessions`
    },
    byArea
  };
}

// ── Perspective distributions ─────────────────────────────────────────────────
// Three explicitly named sources — not collapsed into a generic topPriorityAreas.
// Phase 1 Michael = benchmark diagnostic before manager input.
// Phase 3 Michael = post-synthesis recommendation incorporating manager evidence.

function computePerspectives(eligible) {
  const candidateByArea = {};
  const managerByArea = {};
  const michaelPhase1ByArea = {};
  const michaelPhase3ByArea = {};
  let candidateBase = 0;
  let managerBase = 0;
  let phase1Base = 0;
  let phase3Base = 0;

  for (const s of eligible) {
    const csp = s.safe?.benchmark?.candidateSelectedPriority;
    if (csp) {
      candidateByArea[csp] = (candidateByArea[csp] || 0) + 1;
      candidateBase++;
    }

    const mfa = s.safe?.phase3?.managerSelectedFocusAreas;
    if (mfa?.length) {
      for (const area of mfa) managerByArea[area] = (managerByArea[area] || 0) + 1;
      managerBase++;
    }

    const p1Prios = getBenchmarkPriorities(s.safe);
    if (p1Prios.length) {
      for (const p of p1Prios) {
        if (p.area) michaelPhase1ByArea[p.area] = (michaelPhase1ByArea[p.area] || 0) + 1;
      }
      phase1Base++;
    }

    const p3Prios = getSynthesisPriorities(s.safe);
    if (p3Prios.length) {
      for (const p of p3Prios) {
        if (p.area) michaelPhase3ByArea[p.area] = (michaelPhase3ByArea[p.area] || 0) + 1;
      }
      phase3Base++;
    }
  }

  return {
    candidateSelectedPriority: {
      coverage: { basedOn: candidateBase, total: eligible.length },
      byArea: candidateByArea
    },
    managerSelectedFocusAreas: {
      coverage: { basedOn: managerBase, total: eligible.length },
      byArea: managerByArea
    },
    michaelBenchmarkPriorities: {
      coverage: { basedOn: phase1Base, total: eligible.length },
      byArea: michaelPhase1ByArea
    },
    michaelSynthesisPriorities: {
      coverage: { basedOn: phase3Base, total: eligible.length },
      byArea: michaelPhase3ByArea
    }
  };
}

// ── Intervention classifier ───────────────────────────────────────────────────
// Session-level three-source pattern detection, then mapped to areas.
// Three independent sources: candidateSelectedPriority, managerSelectedFocusAreas,
// Michael Phase 1 priorities (pre-manager, avoids circularity with manager input).
//
// Session-level patterns (all require all three sources present):
//   A — candidate isolated: candidateArea not in Michael or manager selections
//   B — manager isolated (conservative): manager's entire selection has zero overlap
//       with both Michael and candidate (additional-areas constraint honoured)
//   C — Michael rank-1 isolated: Michael's top priority not in candidate or manager
//
// genuine-divergence from Phase 3 synthesis fires independently (even without full
// three-source data, e.g. manager responded but selected no focus areas).
//
// Remaining per-area rules (priority order after alignment check):
//   NOT YET ENOUGH EXPOSURE → experienceExposureNeed
//   DEVELOPING|SUPPORT WOULD HELP + knowledge|practice gapType → learningPracticeNeed
//   DEVELOPING|SUPPORT WOULD HELP + experience|exposure + relevant-exposure-identified:
//     → learningPracticeNeed if Phase 4 'Limited evidence of progress' (corroborated)
//     → insufficientEvidence otherwise
//   default → insufficientEvidence

function computeInterventionTypes(eligible) {
  const byArea = {};
  for (const area of FIVE_AREAS) {
    byArea[area] = {
      learningPracticeNeed: 0,
      experienceExposureNeed: 0,
      priorityAlignmentConversation: 0,
      insufficientEvidence: 0,
      total: 0
    };
  }
  let basedOn = 0;
  for (const s of eligible) {
    if (!s.safe?.benchmark?.areas?.length) continue;
    basedOn++;

    // Session-level three-source signals (computed once, used across all five area checks)
    const candidateArea  = s.safe.benchmark.candidateSelectedPriority || null;
    const managerAreas   = s.safe?.phase3?.managerSelectedFocusAreas || [];
    const managerHasData = s.safe?.phase3?.managerParticipated && managerAreas.length > 0;
    const michaelPrios   = getBenchmarkPriorities(s.safe);
    const michaelAreas   = michaelPrios.map(p => p.area).filter(Boolean);
    const michaelHasData = michaelAreas.length > 0;
    const michaelRank1   = michaelAreas[0] || null;
    const allPresent     = candidateArea && managerHasData && michaelHasData;

    // Identify areas requiring alignment conversation (session-level, mapped to area set)
    const alignmentAreas = new Set();
    if (allPresent) {
      // A: candidate isolated — area not recognised by either professional or manager
      if (!michaelAreas.includes(candidateArea) && !managerAreas.includes(candidateArea))
        alignmentAreas.add(candidateArea);

      // B: manager isolated (conservative) — zero overlap between manager's full selection
      //    and both Michael's areas and candidate's area; additional-areas constraint honoured
      const managerOverlaps = managerAreas.some(a => michaelAreas.includes(a) || a === candidateArea);
      if (!managerOverlaps)
        for (const a of managerAreas) alignmentAreas.add(a);

      // C: Michael rank-1 isolated — top professional priority not selected by either party
      if (michaelRank1 && michaelRank1 !== candidateArea && !managerAreas.includes(michaelRank1))
        alignmentAreas.add(michaelRank1);
    }

    for (const area of FIVE_AREAS) {
      const benchArea = (s.safe.benchmark.areas || []).find(a => a.name === area);
      if (!benchArea) continue;
      const outcome       = benchArea.outcome;
      const exposureConf  = benchArea.exposureConfirmation;
      const relationship  = (s.safe.phase3?.areaRelationships || []).find(r => r.area === area);
      const matchedPrio   = michaelPrios.find(p => p.area === area);
      const gapType       = matchedPrio?.gapType;
      const phase4ForArea = (s.safe.phase4?.progressJudgements || []).filter(p => p.area === area);

      let type;
      if (relationship?.relationshipType === 'genuine-divergence' || alignmentAreas.has(area)) {
        type = 'priorityAlignmentConversation';
      } else if (outcome === 'NOT YET ENOUGH EXPOSURE') {
        type = 'experienceExposureNeed';
      } else if (gapType && ['knowledge', 'practice'].includes(gapType) &&
                 ['DEVELOPING', 'SUPPORT WOULD HELP'].includes(outcome)) {
        type = 'learningPracticeNeed';
      } else if (gapType && ['experience', 'exposure'].includes(gapType) &&
                 exposureConf === 'relevant-exposure-identified' &&
                 ['DEVELOPING', 'SUPPORT WOULD HELP'].includes(outcome)) {
        const corroborated = phase4ForArea.some(p => p.progressJudgement === 'Limited evidence of progress');
        type = corroborated ? 'learningPracticeNeed' : 'insufficientEvidence';
      } else {
        type = 'insufficientEvidence';
      }

      byArea[area][type]++;
      byArea[area].total++;
    }
  }
  return { coverage: { basedOn, total: eligible.length }, byArea };
}

// ── Area relationships ────────────────────────────────────────────────────────

function computeAreaRelationships(eligible) {
  const withRel = eligible.filter(s => s.safe?.phase3?.areaRelationships?.length);
  const divergenceByArea = {};
  const exposureAlignByArea = {};
  let divergenceCount = 0;
  let exposureAlignCount = 0;
  for (const s of withRel) {
    for (const r of s.safe.phase3.areaRelationships) {
      if (r.relationshipType === 'genuine-divergence') {
        divergenceByArea[r.area] = (divergenceByArea[r.area] || 0) + 1;
        divergenceCount++;
      }
      if (r.relationshipType === 'exposure-alignment') {
        exposureAlignByArea[r.area] = (exposureAlignByArea[r.area] || 0) + 1;
        exposureAlignCount++;
      }
    }
  }
  return {
    coverage: { basedOn: withRel.length, total: eligible.length },
    genuineDivergence: { count: divergenceCount, byArea: divergenceByArea },
    exposureAlignment: { count: exposureAlignCount, byArea: exposureAlignByArea }
  };
}

// ── Subgroup breakdowns ───────────────────────────────────────────────────────

function computeSubgroupsA(sessions, getKey) {
  const groups = {};
  for (const s of sessions) {
    const k = getKey(s);
    if (!k) continue;
    if (!groups[k]) groups[k] = [];
    groups[k].push(s);
  }
  const result = {};
  for (const [k, members] of Object.entries(groups)) {
    if (members.length < MIN_GROUP) {
      result[k] = { suppressed: true, analyticsEligible: members.length };
    } else {
      const withBench = members.filter(s => s.safe?.benchmark?.areas?.length);
      const withPh3 = members.filter(s => s.safe?.phase3);
      const outcomeMap = blankAreaOutcomes();
      accumulateAreaOutcomes(outcomeMap, withBench);
      result[k] = {
        suppressed: false,
        analyticsEligible: members.length,
        areaOutcomes: {
          coverage: { basedOn: withBench.length, total: members.length },
          byArea: outcomeMap
        },
        managerParticipation: {
          participated: withPh3.filter(s => s.safe.phase3.managerParticipated).length,
          basedOn: withPh3.length
        }
      };
    }
  }
  return result;
}

function computeSubgroupsB(sessions, getKey) {
  const groups = {};
  for (const s of sessions) {
    const k = getKey(s);
    if (!k) continue;
    if (!groups[k]) groups[k] = [];
    groups[k].push(s);
  }
  const result = {};
  for (const [k, members] of Object.entries(groups)) {
    if (members.length < MIN_GROUP) {
      result[k] = { suppressed: true, phase4Complete: members.length };
    } else {
      const withPh4 = members.filter(s => s.safe?.phase4);
      const byArea = {};
      for (const area of FIVE_AREAS) {
        byArea[area] = {};
        for (const lbl of PROGRESS_LABELS) byArea[area][lbl] = 0;
        byArea[area].total = 0;
      }
      for (const s of withPh4) {
        for (const p of (s.safe.phase4.progressJudgements || [])) {
          if (p.area && byArea[p.area] && PROGRESS_LABELS.includes(p.progressJudgement)) {
            byArea[p.area][p.progressJudgement]++;
            byArea[p.area].total++;
          }
        }
      }
      result[k] = {
        suppressed: false,
        phase4Complete: members.length,
        progressJudgements: {
          coverage: { basedOn: withPh4.length, total: members.length },
          byArea
        },
        progressManagerParticipation: {
          participated: withPh4.filter(s => s.safe.phase4.progressManagerParticipated).length,
          total: withPh4.length
        }
      };
    }
  }
  return result;
}

// ── State A ───────────────────────────────────────────────────────────────────

function computeStateA(eligible) {
  if (eligible.length < MIN_GROUP) return { available: false, basedOn: eligible.length };

  const withBench = eligible.filter(s => s.safe?.benchmark?.areas?.length);
  const withPh3 = eligible.filter(s => s.safe?.phase3);

  const areaOutcomeMap = blankAreaOutcomes();
  accumulateAreaOutcomes(areaOutcomeMap, withBench);

  const gapTypeCounts = {};
  for (const s of withBench) {
    for (const p of getBenchmarkPriorities(s.safe)) {
      if (p.gapType) gapTypeCounts[p.gapType] = (gapTypeCounts[p.gapType] || 0) + 1;
    }
  }

  return {
    available: true,
    basedOn: eligible.length,
    areaOutcomes: {
      coverage: { basedOn: withBench.length, total: eligible.length },
      byArea: areaOutcomeMap
    },
    exposureIntelligence: computeExposureIntelligence(eligible),
    interventionTypes: computeInterventionTypes(eligible),
    perspectives: computePerspectives(eligible),
    areaRelationships: computeAreaRelationships(eligible),
    managerParticipation: {
      coverage: { basedOn: withPh3.length, total: eligible.length },
      participated: withPh3.filter(s => s.safe.phase3.managerParticipated).length
    },
    topGapTypes: sortedEntries(gapTypeCounts),
    employerActions: null,   // populated async by handler after this function returns
    subgroups: {
      byDiscipline: computeSubgroupsA(eligible, s => s.meta?.discipline),
      byTeam: computeSubgroupsA(eligible, s => s.meta?.team),
      byOffice: computeSubgroupsA(eligible, s => s.meta?.office)
    }
  };
}

// ── State B ───────────────────────────────────────────────────────────────────

function computeExposureToProgress(phase4Sessions) {
  // Cross-reference Benchmark exposure position with Phase 4 priority progress.
  // Phase 4 does not re-measure exposure — this only shows what happened to priorities
  // in areas where candidates had confirmed lack of opportunity at Benchmark.
  const byArea = {};
  for (const area of FIVE_AREAS) {
    const confirmedLackSessions = phase4Sessions.filter(s => {
      const a = (s.safe?.benchmark?.areas || []).find(x => x.name === area);
      return a?.exposureConfirmation === 'confirmed-lack-of-exposure';
    });
    const counts = {};
    for (const lbl of PROGRESS_LABELS) counts[lbl] = 0;
    counts.total = 0;
    for (const s of confirmedLackSessions) {
      for (const p of (s.safe?.phase4?.progressJudgements || [])) {
        if (p.area === area && PROGRESS_LABELS.includes(p.progressJudgement)) {
          counts[p.progressJudgement]++;
          counts.total++;
        }
      }
    }
    byArea[area] = { confirmedLackAtBenchmark: confirmedLackSessions.length, progressJudgements: counts };
  }
  return {
    note: 'Benchmark exposure position cross-referenced with Phase 4 priority progress. Phase 4 does not re-measure exposure confirmation.',
    byArea
  };
}

function computeStateB(phase4Complete) {
  if (phase4Complete.length < MIN_GROUP) return { available: false, basedOn: phase4Complete.length };

  const withPh4 = phase4Complete.filter(s => s.safe?.phase4);

  const byArea = {};
  for (const area of FIVE_AREAS) {
    byArea[area] = {};
    for (const lbl of PROGRESS_LABELS) byArea[area][lbl] = 0;
    byArea[area].total = 0;
  }
  let totalSlots = 0;
  let graduatedSlots = 0;
  for (const s of withPh4) {
    for (const p of (s.safe.phase4.progressJudgements || [])) {
      totalSlots++;
      if (p.graduated) graduatedSlots++;
      if (p.area && byArea[p.area] && PROGRESS_LABELS.includes(p.progressJudgement)) {
        byArea[p.area][p.progressJudgement]++;
        byArea[p.area].total++;
      }
    }
  }

  const proposedAreaCounts = {};
  for (const s of withPh4) {
    for (const area of (s.safe.phase4.proposedPriorityAreas || [])) {
      proposedAreaCounts[area] = (proposedAreaCounts[area] || 0) + 1;
    }
  }

  return {
    available: true,
    basedOn: phase4Complete.length,
    progressJudgements: {
      coverage: { basedOn: withPh4.length, total: phase4Complete.length },
      byArea
    },
    exposureToProgress: computeExposureToProgress(phase4Complete),
    graduationRate: {
      graduated: graduatedSlots,
      total: totalSlots,
      note: `${graduatedSlots} of ${totalSlots} priority slots graduated across ${withPh4.length} sessions`
    },
    progressManagerParticipation: {
      participated: withPh4.filter(s => s.safe.phase4.progressManagerParticipated).length,
      total: withPh4.length
    },
    proposedPriorityAreas: sortedEntries(proposedAreaCounts),
    subgroups: {
      byDiscipline: computeSubgroupsB(phase4Complete, s => s.meta?.discipline),
      byTeam: computeSubgroupsB(phase4Complete, s => s.meta?.team),
      byOffice: computeSubgroupsB(phase4Complete, s => s.meta?.office)
    }
  };
}

// ── Employer actions ──────────────────────────────────────────────────────────
// Michael receives aggregated counts only — no per-session text, no identifiers.

async function generateEmployerActions(apiKey, firmName, eligibleCount, stateA, stateB) {
  const show = (n, d) => `${n} (${pct(n, d)})`;

  const aoBase = stateA.areaOutcomes.coverage.basedOn;
  const aoLines = FIVE_AREAS.map(area => {
    const c = stateA.areaOutcomes.byArea[area];
    if (!c || c.total === 0) return `  ${area}: no data`;
    return `  ${area}: ON TRACK ${show(c['ON TRACK'], c.total)} | DEVELOPING ${show(c['DEVELOPING'], c.total)} | SUPPORT WOULD HELP ${show(c['SUPPORT WOULD HELP'], c.total)} | NOT YET ENOUGH EXPOSURE ${show(c['NOT YET ENOUGH EXPOSURE'], c.total)}`;
  }).join('\n');

  const expCov = stateA.exposureIntelligence.coverage;
  const expLines = FIVE_AREAS.map(area => {
    const e = stateA.exposureIntelligence.byArea[area];
    if (!e || e.denominator === 0) return `  ${area}: no exposure data`;
    return `  ${area}: confirmed-lack ${show(e.confirmedLack, e.denominator)} | relevant-exposure ${show(e.relevantExposure, e.denominator)} | not-assessed ${show(e.notAssessed, e.denominator)}`;
  }).join('\n');

  const gapLines = stateA.topGapTypes.map(g => `${g.label}: ${g.count}`).join(' | ') || '(no data)';

  const mp = stateA.managerParticipation;
  const div = stateA.areaRelationships.genuineDivergence;

  // Intervention-type distribution per area
  const itBase = stateA.interventionTypes.coverage.basedOn;
  const itLines = FIVE_AREAS.map(area => {
    const t = stateA.interventionTypes.byArea[area];
    if (!t || t.total === 0) return `  ${area}: no data`;
    return `  ${area}: learningPracticeNeed ${show(t.learningPracticeNeed, t.total)} | experienceExposureNeed ${show(t.experienceExposureNeed, t.total)} | priorityAlignmentConversation ${show(t.priorityAlignmentConversation, t.total)} | insufficientEvidence ${show(t.insufficientEvidence, t.total)}`;
  }).join('\n');

  // Four perspective distributions
  const persp = stateA.perspectives;

  const candBase = persp.candidateSelectedPriority.coverage.basedOn;
  const candLines = FIVE_AREAS
    .map(area => `  ${area}: ${persp.candidateSelectedPriority.byArea[area] || 0}`)
    .join('\n');

  const mgrBase = persp.managerSelectedFocusAreas.coverage.basedOn;
  const mgrLines = FIVE_AREAS
    .map(area => `  ${area}: ${persp.managerSelectedFocusAreas.byArea[area] || 0}`)
    .join('\n');

  const mp1Base = persp.michaelBenchmarkPriorities.coverage.basedOn;
  const mp1Lines = FIVE_AREAS
    .map(area => `  ${area}: ${persp.michaelBenchmarkPriorities.byArea[area] || 0}`)
    .join('\n');

  const mp3Base = persp.michaelSynthesisPriorities.coverage.basedOn;
  const mp3Lines = FIVE_AREAS
    .map(area => `  ${area}: ${persp.michaelSynthesisPriorities.byArea[area] || 0}`)
    .join('\n');

  let phase4Section = '';
  if (stateB.available) {
    const progLines = FIVE_AREAS.map(area => {
      const p = stateB.progressJudgements.byArea[area];
      if (!p || p.total === 0) return `  ${area}: no data`;
      return `  ${area}: Progress evident ${show(p['Progress evident'], p.total)} | Some progress ${show(p['Some progress'], p.total)} | Limited evidence ${show(p['Limited evidence of progress'], p.total)} | Should reconsider ${show(p['Priority should be reconsidered'], p.total)}`;
    }).join('\n');
    const gr = stateB.graduationRate;
    phase4Section = `\n## Progress data (${stateB.basedOn} sessions completed Phase 4 progress review)\n${progLines}\nGraduation rate: ${show(gr.graduated, gr.total)} priority slots graduated`;
  }

  const prompt = `You are Michael, producing Development Conditions for an employer from aggregated, anonymised Professional Readiness signals.

Context: ${eligibleCount} analytics-eligible candidates at ${firmName}. You have structured counts only — no individual reflections, no names, no free text from anyone.

## Benchmark area outcomes (${aoBase} sessions)
${aoLines}

## Exposure data (${expCov.coveredSessions} of ${expCov.total} sessions with exposure confirmation)
${expLines}

## Development gap types (from Michael's Phase 1 diagnostics)
${gapLines}

## Intervention types per area (${itBase} sessions — how each area-level development need was classified)
${itLines}

## Candidate perspective — area selected as personal priority (${candBase} sessions)
${candLines}

## Manager perspective — areas selected as development focus (${mgrBase} sessions with manager input)
${mgrLines}

## Michael Phase 1 perspective — areas diagnosed as development priorities at Benchmark (${mp1Base} sessions)
${mp1Lines}

## Michael Phase 3 perspective — areas recommended for discussion after synthesis (${mp3Base} sessions with Phase 3)
${mp3Lines}

## Manager engagement (Phase 3)
Provided meaningful input: ${show(mp.participated, mp.coverage.basedOn)} of ${mp.coverage.basedOn} sessions with Phase 3 synthesis
Genuine perspective divergence: ${div.count} area-instances across cohort
${phase4Section}

Return 3–5 Development Conditions — evidence-based actions the employer can take to improve the professional development environment for this cohort.

Each action must:
- Derive from the specific numbers above — cite the signal in "basis"
- Be confident and specific, not timid (e.g. "Create structured opportunities to practise X" not "Consider whether…")
- Address an organisational condition the employer can change, not a personal performance target
- Use the exact Benchmark area names where relevant
- Where relevant, draw on perspective alignment or misalignment across candidate, manager and Michael signals

Return ONLY valid JSON — no preamble, no markdown:
{
  "actions": [
    {
      "action": "<specific development condition — what the employer should create, change or provide>",
      "basis": "<the specific aggregated signal that supports this — cite counts or percentages>"
    }
  ]
}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      signal: controller.signal,
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json();
  if (!response.ok) throw new Error(`Anthropic error: ${data?.error?.message || JSON.stringify(data)}`);

  const text = (data.content || []).map(b => b.text || '').join('');
  const clean = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  return { generatedAt: Date.now(), actions: parsed.actions || [] };
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return; }

  const { cohortId, internalSecret, runToken } = body;
  if (!internalSecret || internalSecret !== process.env.P1_INTERNAL_SECRET) return;
  if (!cohortId) return;

  const sessionStore = getSessionStore();
  const cohortStore = getCohortStore();
  const jobKey = `${cohortId}/jobs/analytics`;

  try {
    const existingJob = await cohortStore.get(jobKey, { type: 'json' });
    if (existingJob?.runToken === runToken &&
        (existingJob.status === 'pending' || existingJob.status === 'complete')) {
      return;
    }

    await cohortStore.setJSON(jobKey, { status: 'pending', runToken, startedAt: Date.now() });

    const sessionIds = await cohortStore.get(`${cohortId}/sessions`, { type: 'json' });
    if (!sessionIds?.length) {
      await cohortStore.setJSON(jobKey, { status: 'failed', runToken, error: 'no_sessions', failedAt: Date.now() });
      return;
    }

    const cohortIndex = await cohortStore.get('index', { type: 'json' }) || [];
    const cohortMeta = cohortIndex.find(c => c.cohortId === cohortId) || {};
    const firmName = cohortMeta.firmName || '(unknown)';

    const sessions = await fetchSessions(sessionIds, sessionStore);
    const eligible = sessions.filter(s => s.meta && ANALYTICS_ELIGIBLE.has(s.meta.status));
    const phase4Complete = sessions.filter(s => s.meta && PHASE4_COMPLETE.has(s.meta.status));

    const stateA = computeStateA(eligible);
    const stateB = computeStateB(phase4Complete);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (stateA.available && apiKey) {
      try {
        stateA.employerActions = await generateEmployerActions(
          apiKey, firmName, eligible.length, stateA, stateB
        );
      } catch (err) {
        console.error('[p1-cohort-analytics-bg] Employer actions generation failed:', err.message);
        // stateA.employerActions remains null — snapshot still written without actions
      }
    }

    const snapshot = {
      schemaVersion: 'cohort-snapshot-v1',
      cohortId,
      firmName,
      computedAt: Date.now(),
      coverage: {
        total: sessions.length,
        analyticsEligible: eligible.length,
        phase4Complete: phase4Complete.length
      },
      stateA,
      stateB
    };

    await cohortStore.setJSON(`${cohortId}/snapshot`, snapshot);

    const now = Date.now();
    await cohortStore.setJSON(jobKey, { status: 'complete', runToken, completedAt: now });
    console.log(`[p1-cohort-analytics-bg] Snapshot for ${cohortId}: ${eligible.length} eligible, ${phase4Complete.length} phase4 complete`);

  } catch (err) {
    console.error('[p1-cohort-analytics-bg] Unexpected error:', err.message);
    try {
      await cohortStore.setJSON(jobKey, { status: 'failed', runToken, error: 'unexpected_error', failedAt: Date.now() });
    } catch { /* ignore */ }
  }
};
