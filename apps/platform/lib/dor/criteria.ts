/**
 * Definition of Ready — single source of truth.
 *
 * The ONE file defining what "ready to start design" means: criteria, weights,
 * which are mandatory, per-track additions, the clear threshold, and the scoring
 * math. Both the UI (live verdict) and the server (authoritative recompute on
 * save) import from here so they can't drift. Dependency-free + framework-free
 * so it stays importable from client components AND route handlers.
 *
 * Heavy sections (PRD, WBS) carry a `subChecks` rubric mapped to the real PRD /
 * WBS template sections, so every checkbox has an answer in the doc. Each
 * sub-check is simply present (checked) or MISSING (unchecked) — unchecked
 * counts against the score and, for mandatory sections, blocks clearance. There
 * is no "N/A": these are fields a good doc should always contain.
 */

export type Track = 'ai' | 'figma';

/** A single tick on a leaf criterion: not started, partial, or done. */
export type CriterionScore = 0 | 0.5 | 1;

/** A sub-check's stored state. Absent from the answer map === missing (unchecked). */
export type SubCheckState = 'met';

/** Any stored answer value: a leaf tick, or a checked sub-check. */
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
  /** Importance multiplier, 1–3. Shown to users as a % share of the score. */
  weight: 1 | 2 | 3;
  /** Mandatory items must reach a full 1 before an assessment can clear. */
  mandatory: boolean;
  /**
   * When present, this criterion is rubric-scored: its value is the fraction of
   * sub-checks checked. A mandatory criterion clears only when ALL are checked.
   */
  subChecks?: readonly SubCheck[];
}

/** Normalized score (0–10) at or above which an assessment can clear. */
export const CLEAR_THRESHOLD = 9.0;

/** Floor for the "almost there" verdict — below this is "not ready". */
export const ALMOST_THRESHOLD = 7.0;

/**
 * Score a designer must exceed before they can commit an ETA. Deliberately
 * lower than CLEAR_THRESHOLD: you don't need a perfect/cleared check to give an
 * ETA — just to be confidently "almost there".
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
// Criteria — mapped to the PRD / WBS template sections. Order = render order.
// ─────────────────────────────────────────────────────────────────────────────

/** Applies to both tracks. */
export const SHARED_CRITERIA: readonly Criterion[] = [
  {
    id: 'prd',
    title: 'PRD',
    description: 'The product requirements doc is handed off and complete.',
    weight: 3,
    mandatory: true,
    subChecks: [
      { id: 'problem', title: 'Problem & goal are clear', description: 'Why we’re building this and what success looks like.' },
      { id: 'users', title: 'Target users are defined', description: 'Who it’s for — roles or personas.' },
      { id: 'features', title: 'Features listed & prioritised', description: 'The feature set with Must / Should / Could / Won’t (MoSCoW).' },
      { id: 'scope', title: 'Out-of-scope & V2 are stated', description: 'What we’re not building now, and what’s deferred to later.' },
      { id: 'success', title: 'Success metrics have targets', description: 'KPIs with actual numbers — not “to be defined”.' },
    ],
  },
  {
    id: 'wbs',
    title: 'WBS',
    description: 'The work breakdown is good enough to design from.',
    weight: 3,
    mandatory: true,
    subChecks: [
      { id: 'coverage', title: 'Every feature has a WBS item', description: 'Nothing in the PRD is missing from the breakdown.' },
      { id: 'acceptance', title: 'Each item has acceptance criteria', description: 'Every story says what “done” looks like.' },
      { id: 'grouped', title: 'Grouped by epic / flow', description: 'Organised, not a flat dump.' },
      { id: 'granularity', title: 'Items are sized to design from', description: 'Each maps to a screen/flow — no “TBD” or “misc”.' },
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
    id: 'roles',
    title: 'User roles & permissions',
    description: 'Each user role and what it can access is defined (single-role: just confirm the one).',
    weight: 2,
    mandatory: true,
  },
  {
    id: 'brand',
    title: 'Brand identity',
    description: 'Brand is settled — assets provided, or being created here with agreed direction.',
    weight: 2,
    mandatory: false,
  },
  {
    id: 'flows',
    title: 'Key user flows',
    description: 'The primary end-to-end journeys are mapped.',
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

/** Sum of all criterion weights for a track — the denominator behind the % shares. */
export function trackTotalWeight(track: Track): number {
  return criteriaForTrack(track).reduce((sum, c) => sum + c.weight, 0);
}

/** A criterion's share of the score, as a rounded percentage (replaces the ×N badge). */
export function criterionSharePct(track: Track, criterion: Criterion): number {
  const total = trackTotalWeight(track);
  return total === 0 ? 0 : Math.round((criterion.weight / total) * 100);
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
  /** 0–1: leaf tick, or the fraction of sub-checks checked. */
  value: number;
  /** Rubric only: sub-checks checked. */
  met: number;
  /** Rubric only: total sub-checks. */
  total: number;
}

/** Evaluate a single criterion against the answer map (leaf tick or rubric rollup). */
export function evalCriterion(criterion: Criterion, answers: AnswerMap): CriterionEval {
  const subs = criterion.subChecks;
  if (subs && subs.length > 0) {
    let met = 0;
    for (const sc of subs) {
      if (answers[subCheckKey(criterion.id, sc.id)] === 'met') met += 1;
    }
    return { value: met / subs.length, met, total: subs.length };
  }
  return { value: normalizeTick(answers[criterion.id]), met: 0, total: 0 };
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
 * Leaf criteria use their 0/½/1 tick; rubric criteria roll up checked sub-checks.
 */
export function computeScore(track: Track, answers: AnswerMap): ScoreResult {
  const criteria = criteriaForTrack(track);
  let weighted = 0;
  let totalWeight = 0;
  const missingMandatory: Criterion[] = [];

  for (const c of criteria) {
    const { value } = evalCriterion(c, answers);
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
        if (raw[key] === 'met') out[key] = 'met'; // unchecked is omitted
      }
    } else {
      out[c.id] = normalizeTick(raw[c.id]);
    }
  }
  return out;
}

/** Trim + cap a free-text note. Shared by the global + per-section notes. */
export function sanitizeNote(value: unknown, max = 2000): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Keep only section notes whose key is a real criterion id on this track. */
export function sanitizeSectionNotes(
  track: Track,
  raw: unknown,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  const ids = new Set(criteriaForTrack(track).map((c) => c.id));
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!ids.has(key)) continue;
    const note = sanitizeNote(val);
    if (note) out[key] = note;
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
