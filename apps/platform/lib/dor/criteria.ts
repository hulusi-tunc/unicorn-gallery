/**
 * Definition of Ready — single source of truth.
 *
 * This is the ONE file that defines what "ready to start design" means: the
 * criteria, their weights, which are mandatory, the per-track additions, the
 * clear threshold, and the scoring math. Both the UI (live verdict) and the
 * server (authoritative recompute on save) import from here so the two can
 * never drift. Keep it dependency-free + framework-free so it stays importable
 * from client components AND route handlers.
 */

export type Track = 'ai' | 'figma';

/** A single tick on a criterion: not started, partial, or done. */
export type CriterionScore = 0 | 0.5 | 1;

/** Verdict buckets, mirrored in the DB check constraint + the UI card. */
export type Verdict = 'cleared' | 'almost' | 'not_ready';

export interface Criterion {
  /** Stable key — persisted inside the `scores` JSON. Never rename. */
  id: string;
  title: string;
  description: string;
  /** Importance multiplier, 1–3. */
  weight: 1 | 2 | 3;
  /** Mandatory items must each be a full 1 before an assessment can clear. */
  mandatory: boolean;
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

// ─────────────────────────────────────────────────────────────────────────────
// Criteria. Order here is the order rendered in the UI.
// ─────────────────────────────────────────────────────────────────────────────

/** Applies to both tracks. */
export const SHARED_CRITERIA: readonly Criterion[] = [
  {
    id: 'prd',
    title: 'PRD provided',
    description: 'Product requirements doc handed off with goals, scope, and requirements.',
    weight: 3,
    mandatory: true,
  },
  {
    id: 'wbs',
    title: 'WBS provided',
    description: 'A work breakdown structure exists for the project.',
    weight: 3,
    mandatory: true,
  },
  {
    id: 'wbs_quality',
    title: 'WBS quality check',
    description: 'Acceptance criteria are clear, work is grouped, priorities are set, and non-goals are stated.',
    weight: 3,
    mandatory: true,
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
    description: 'What is explicitly out of scope and what is deferred to V2 is written down.',
    weight: 2,
    mandatory: true,
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

/** Snap any incoming value to a valid tick (0 / 0.5 / 1); unknowns become 0. */
export function normalizeTick(value: unknown): CriterionScore {
  if (value === 1 || value === 0.5) return value;
  return 0;
}

export interface ScoreResult {
  /** Weighted, normalized to 0–10, rounded to one decimal. */
  score: number;
  /** True only when score ≥ CLEAR_THRESHOLD AND every mandatory item is a full 1. */
  cleared: boolean;
  verdict: Verdict;
  /** Mandatory criteria not yet at a full 1 — what's blocking clearance. */
  missingMandatory: Criterion[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Compute the normalized score + verdict for a set of ticks on a track.
 *
 * scores maps criterion id → tick. Missing/invalid entries count as 0, so a
 * partial save can never accidentally inflate the result.
 */
export function computeScore(
  track: Track,
  scores: Record<string, unknown>,
): ScoreResult {
  const criteria = criteriaForTrack(track);
  let weighted = 0;
  let totalWeight = 0;
  const missingMandatory: Criterion[] = [];

  for (const c of criteria) {
    const tick = normalizeTick(scores[c.id]);
    weighted += tick * c.weight;
    totalWeight += c.weight;
    if (c.mandatory && tick < 1) missingMandatory.push(c);
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

/** Sanitize a raw scores object down to known criterion ids with valid ticks. */
export function sanitizeScores(
  track: Track,
  raw: Record<string, unknown> | null | undefined,
): Record<string, CriterionScore> {
  const out: Record<string, CriterionScore> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const c of criteriaForTrack(track)) {
    out[c.id] = normalizeTick(raw[c.id]);
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
