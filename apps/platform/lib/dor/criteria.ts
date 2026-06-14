/**
 * Definition of Ready — single source of truth.
 *
 * This is the ONE file that defines what "ready to start design" means: the
 * criteria, their weights, which are mandatory, the per-track additions, the
 * clear threshold, and the scoring math. Both the UI (live verdict) and the
 * server (authoritative recompute on save) import from here so the two can
 * never drift. Keep it dependency-free + framework-free so it stays importable
 * from client components AND route handlers.
 *
 * Heavy / fuzzy criteria (WBS, PRD, scope) carry a `subChecks` rubric: instead
 * of one subjective 0/½/1, the designer answers concrete yes/no items and the
 * criterion's value is *rolled up* from them — standardising judgment across
 * the team and teaching juniors what "good" looks like.
 */

export type Track = 'ai' | 'figma';

/** A single tick on a leaf criterion: not started, partial, or done. */
export type CriterionScore = 0 | 0.5 | 1;

/** A sub-check's state. Absent from the answer map === unmet (the default). */
export type SubCheckState = 'met' | 'na';

/** Any stored answer value: a leaf tick, or a sub-check state. */
export type AnswerValue = CriterionScore | SubCheckState;

/** criterionId (leaf) or "criterionId.subCheckId" (rubric) → answer. */
export type AnswerMap = Record<string, AnswerValue>;

/** Verdict buckets, mirrored in the DB check constraint + the UI card. */
export type Verdict = 'cleared' | 'almost' | 'not_ready';

export interface SubCheck {
  /** Stable key — persisted as part of the composite answer key. Never rename. */
  id: string;
  title: string;
  description: string;
}

export interface Criterion {
  /** Stable key — persisted inside the `scores` JSON. Never rename. */
  id: string;
  title: string;
  description: string;
  /** Importance multiplier, 1–3. */
  weight: 1 | 2 | 3;
  /** Mandatory items must reach a full 1 before an assessment can clear. */
  mandatory: boolean;
  /**
   * When present, this criterion is rubric-scored: its value is the fraction
   * of applicable sub-checks met (N/A sub-checks drop out of the denominator),
   * and a mandatory criterion clears only when ALL applicable sub-checks pass.
   */
  subChecks?: readonly SubCheck[];
}

/** Normalized score (0–10) at or above which an assessment can clear. */
export const CLEAR_THRESHOLD = 9.0;

/** Floor for the "almost there" verdict — below this is "not ready". */
export const ALMOST_THRESHOLD = 7.0;

/**
 * Score a designer must exceed before they can commit a time estimate.
 * Deliberately lower than CLEAR_THRESHOLD: you don't need a perfect/cleared
 * check to give an ETA — just to be confidently "almost there".
 */
export const ETA_UNLOCK_THRESHOLD = 8;

/** Whether the ETA field is open at this score (strictly above the threshold). */
export function canCommitEta(score: number): boolean {
  return score > ETA_UNLOCK_THRESHOLD;
}

/** Composite answer-map key for a sub-check. */
export function subCheckKey(criterionId: string, subCheckId: string): string {
  return `${criterionId}.${subCheckId}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Criteria. Order here is the order rendered in the UI.
// ─────────────────────────────────────────────────────────────────────────────

/** Applies to both tracks. */
export const SHARED_CRITERIA: readonly Criterion[] = [
  {
    id: 'prd',
    title: 'PRD provided',
    description: 'A product requirements doc has been handed off and is usable.',
    weight: 3,
    mandatory: true,
    subChecks: [
      { id: 'problem', title: 'Problem & goal clear', description: 'The “why” — the problem being solved and the goal — is stated.' },
      { id: 'users', title: 'Target users identified', description: 'Who the product is for is named.' },
      { id: 'requirements', title: 'Functional requirements enumerated', description: 'What it must do is listed, not implied.' },
      { id: 'success', title: 'Success criteria defined', description: 'What “done” / “working” means is measurable.' },
      { id: 'constraints', title: 'Constraints & assumptions stated', description: 'Known limits and assumptions are written down.' },
    ],
  },
  {
    id: 'wbs',
    title: 'Work breakdown structure',
    description: 'A WBS exists and is good enough to design from.',
    weight: 3,
    mandatory: true,
    subChecks: [
      { id: 'coverage', title: 'Complete coverage', description: 'Every feature in the PRD maps to a WBS item — nothing missing.' },
      { id: 'acceptance', title: 'Clear acceptance criteria', description: 'Each item states what “done” looks like, testably.' },
      { id: 'grouped', title: 'Logically grouped', description: 'Organised by epic / flow / feature, not a flat dump.' },
      { id: 'prioritised', title: 'Prioritised', description: 'Each item carries a priority (P0/P1/P2 or MoSCoW).' },
      { id: 'non_goals', title: 'Non-goals stated', description: 'What is explicitly not included is written down.' },
      { id: 'granularity', title: 'Design-able granularity', description: 'Items are sized to scope a screen/flow from — no “TBD” / “misc”.' },
    ],
  },
  {
    id: 'platform',
    title: 'Platform confirmed',
    description: 'Target platform (web / iOS / Android) is locked in.',
    weight: 3,
    mandatory: true,
  },
  {
    id: 'scope',
    title: 'Out-of-scope + V2 deferrals clear',
    description: 'The boundaries of this build are explicit.',
    weight: 2,
    mandatory: true,
    subChecks: [
      { id: 'not_building', title: 'Explicit “not building” list', description: 'What’s out of scope for this round is written down.' },
      { id: 'v2', title: 'V2 deferrals named', description: 'What’s consciously pushed to a later version is listed.' },
      { id: 'edge_states', title: 'Error / empty / edge states addressed', description: 'Non-happy-path cases are covered or consciously deferred.' },
    ],
  },
  {
    id: 'personas',
    title: 'Personas with goals + pain points',
    description: 'Target personas are defined with their goals and pain points.',
    weight: 2,
    mandatory: false,
  },
  {
    id: 'brand',
    title: 'Brand decision + assets',
    description: 'Brand direction is decided and the needed assets (logo, colors, fonts) are available.',
    weight: 2,
    mandatory: false,
  },
  {
    id: 'flows',
    title: 'Key user flows / screen list',
    description: 'The primary user flows or a screen inventory is provided.',
    weight: 2,
    mandatory: false,
  },
] as const;

/** Added when the project is built on the AI design track. */
export const AI_CRITERIA: readonly Criterion[] = [
  {
    id: 'tech_stack',
    title: 'Tech stack defined',
    description: 'The implementation stack (framework, data, hosting) is decided before design starts.',
    weight: 3,
    mandatory: true,
  },
] as const;

/** Added when the project is built on the manual Figma track. */
export const FIGMA_CRITERIA: readonly Criterion[] = [
  {
    id: 'design_system',
    title: 'Design system / UI kit status',
    description: 'Whether a design system / UI kit exists (or must be built) is known.',
    weight: 2,
    mandatory: false,
  },
  {
    id: 'fidelity',
    title: 'Expected fidelity agreed',
    description: 'Wireframe vs. high-fidelity expectations are agreed with the customer.',
    weight: 1,
    mandatory: false,
  },
] as const;

/** The ordered criteria list for a given track (shared + track-specific). */
export function criteriaForTrack(track: Track): Criterion[] {
  const extra = track === 'ai' ? AI_CRITERIA : FIGMA_CRITERIA;
  return [...SHARED_CRITERIA, ...extra];
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring. The server treats this as authoritative — the client value is only
// ever a live preview and is recomputed before any write.
// ─────────────────────────────────────────────────────────────────────────────

/** Snap any incoming value to a valid leaf tick (0 / 0.5 / 1); unknowns become 0. */
export function normalizeTick(value: unknown): CriterionScore {
  if (value === 1 || value === 0.5) return value;
  return 0;
}

export interface CriterionEval {
  /** 0–1. `null` means "not applicable" (every sub-check marked N/A) — excluded from the score. */
  value: number | null;
  /** Rubric only: sub-checks marked met. */
  met: number;
  /** Rubric only: sub-checks that count (total minus N/A). */
  applicable: number;
}

/** Evaluate a single criterion against the answer map (leaf tick or rubric rollup). */
export function evalCriterion(criterion: Criterion, answers: AnswerMap): CriterionEval {
  const subs = criterion.subChecks;
  if (subs && subs.length > 0) {
    let met = 0;
    let applicable = 0;
    for (const sc of subs) {
      const state = answers[subCheckKey(criterion.id, sc.id)];
      if (state === 'na') continue;
      applicable += 1;
      if (state === 'met') met += 1;
    }
    const value = applicable === 0 ? null : met / applicable;
    return { value, met, applicable };
  }
  return { value: normalizeTick(answers[criterion.id]), met: 0, applicable: 0 };
}

export interface ScoreResult {
  /** Weighted, normalized to 0–10, rounded to one decimal. */
  score: number;
  /** True only when score ≥ CLEAR_THRESHOLD AND every mandatory criterion reaches a full 1. */
  cleared: boolean;
  verdict: Verdict;
  /** Mandatory criteria not yet at a full 1 — what's blocking clearance. */
  missingMandatory: Criterion[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Compute the normalized score + verdict for a set of answers on a track.
 *
 * Leaf criteria use their 0/½/1 tick; rubric criteria roll up their sub-checks.
 * A criterion whose sub-checks are all N/A drops out of the weighted total
 * entirely (numerator and denominator), so it neither helps nor hurts.
 */
export function computeScore(track: Track, answers: AnswerMap): ScoreResult {
  const criteria = criteriaForTrack(track);
  let weighted = 0;
  let totalWeight = 0;
  const missingMandatory: Criterion[] = [];

  for (const c of criteria) {
    const { value } = evalCriterion(c, answers);
    if (value === null) continue; // fully N/A → not applicable
    weighted += value * c.weight;
    totalWeight += c.weight;
    if (c.mandatory && value < 1) missingMandatory.push(c);
  }

  const score = totalWeight === 0 ? 0 : round1((weighted / totalWeight) * 10);
  const cleared = score >= CLEAR_THRESHOLD && missingMandatory.length === 0;
  const verdict: Verdict = cleared
    ? 'cleared'
    : score >= ALMOST_THRESHOLD
      ? 'almost'
      : 'not_ready';

  return { score, cleared, verdict, missingMandatory };
}

/** Sanitize a raw answer object down to known keys with valid values. */
export function sanitizeAnswers(
  track: Track,
  raw: Record<string, unknown> | null | undefined,
): AnswerMap {
  const out: AnswerMap = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const c of criteriaForTrack(track)) {
    if (c.subChecks && c.subChecks.length > 0) {
      for (const sc of c.subChecks) {
        const key = subCheckKey(c.id, sc.id);
        const v = raw[key];
        if (v === 'met' || v === 'na') out[key] = v; // unmet is omitted
      }
    } else {
      out[c.id] = normalizeTick(raw[c.id]);
    }
  }
  return out;
}

/** Human-facing label for a verdict (UI + history badge). */
export function verdictLabel(verdict: Verdict): string {
  switch (verdict) {
    case 'cleared':
      return 'Cleared';
    case 'almost':
      return 'Almost ready';
    case 'not_ready':
      return 'Not ready';
  }
}
