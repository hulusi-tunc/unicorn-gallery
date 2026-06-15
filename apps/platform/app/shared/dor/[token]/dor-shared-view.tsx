'use client';

import { CalendarClock, Check, ClipboardCheck, Minus, X } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { UnicornLogo } from '@/components/brand/unicorn-logo';
import { useTheme } from '@/components/providers/theme-provider';
import type { DorAssessment } from '@/lib/db';
import {
  CLEAR_THRESHOLD,
  criteriaForTrack,
  evalCriterion,
  subCheckKey,
  verdictLabel,
  type AnswerMap,
  type Criterion,
  type Verdict,
} from '@/lib/dor/criteria';
import { editorialFonts, getNd, type SwatchTheme } from '@/lib/tokens';

/** Public read-only render of a saved assessment, reached via its share link. */
export function DorSharedView({ assessment }: { assessment: DorAssessment }): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const answers = assessment.scores as AnswerMap;
  const criteria = criteriaForTrack(assessment.track);
  const color = verdictColor(t, assessment.verdict);
  const pct = Math.min(100, Math.max(0, (assessment.score / 10) * 100));
  const eta = assessment.eta_hours != null ? `${assessment.eta_hours} h` : null;

  return (
    <div style={{ minHeight: '100vh', background: t.black, color: t.textPrimary, fontFamily: editorialFonts.body }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 80px' }}>
        {/* Brand + read-only marker */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <UnicornLogo variant="mark" height={20} color={t.accent} />
            <span style={{ fontFamily: editorialFonts.display, fontSize: 14, fontWeight: 600, color: t.textDisplay }}>
              Unicorn Studio
            </span>
          </span>
          <span style={labelStyle(t)}>Read-only</span>
        </div>

        {/* Title */}
        <p style={labelStyle(t)}>
          <ClipboardCheck size={11} style={{ marginRight: 6, verticalAlign: '-1px' }} />
          Definition of Ready
        </p>
        <h1 style={{ margin: '8px 0 0', fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em', color: t.textDisplay }}>
          {assessment.project_name}
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: t.textSecondary }}>
          {assessment.designer_name} · {assessment.track === 'ai' ? 'AI design' : 'Manual Figma'} ·{' '}
          {formatDate(assessment.created_at)}
        </p>

        {/* Verdict */}
        <div style={{ marginTop: 24, padding: 20, borderRadius: 12, background: t.surface, border: `1px solid ${t.border}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontFamily: editorialFonts.display,
                fontSize: 44,
                fontWeight: 600,
                lineHeight: 1,
                letterSpacing: '-0.02em',
                color,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {assessment.score.toFixed(1)}
            </span>
            <span style={{ fontSize: 15, color: t.textSecondary }}>/ 10</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, color: t.textDisplay }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
              {verdictLabel(assessment.verdict)}
            </span>
          </div>
          <div style={{ marginTop: 12, height: 8, borderRadius: 999, background: t.surfaceInk, overflow: 'hidden', position: 'relative' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
            <div aria-hidden style={{ position: 'absolute', top: -2, bottom: -2, left: `${(CLEAR_THRESHOLD / 10) * 100}%`, width: 2, background: t.borderStrong }} />
          </div>
        </div>

        {/* ETA */}
        {eta || assessment.eta_date ? (
          <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 10, background: t.surface, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <CalendarClock size={14} style={{ color: t.textSecondary, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: t.textPrimary }}>
              {eta ? (
                <>
                  <strong>{eta}</strong> estimated
                </>
              ) : null}
              {eta && assessment.eta_date ? ' · ' : null}
              {assessment.eta_date ? <>target {formatDate(assessment.eta_date)}</> : null}
            </span>
          </div>
        ) : null}

        {/* Final thoughts */}
        {assessment.notes ? (
          <div style={{ marginTop: 14, padding: 16, borderRadius: 10, background: t.surface, border: `1px solid ${t.border}` }}>
            <p style={labelStyle(t)}>Final thoughts</p>
            <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.55, color: t.textPrimary, whiteSpace: 'pre-wrap' }}>
              {assessment.notes}
            </p>
          </div>
        ) : null}

        {/* Checklist */}
        <h2 style={{ margin: '28px 0 12px', fontSize: 15, fontWeight: 600, color: t.textDisplay }}>Checklist</h2>
        <div style={{ borderRadius: 12, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
          {criteria.map((c, i) => (
            <SharedCriterion key={c.id} t={t} criterion={c} answers={answers} last={i === criteria.length - 1} />
          ))}
        </div>

        <p style={{ marginTop: 28, textAlign: 'center', fontFamily: editorialFonts.mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.textDisabled }}>
          Shared by Unicorn Studio
        </p>
      </div>
    </div>
  );
}

function SharedCriterion({
  t,
  criterion,
  answers,
  last,
}: {
  t: SwatchTheme;
  criterion: Criterion;
  answers: AnswerMap;
  last: boolean;
}): ReactNode {
  const ev = evalCriterion(criterion, answers);
  const isRubric = Boolean(criterion.subChecks && criterion.subChecks.length > 0);
  const rawLeaf = answers[criterion.id];
  const leaf = typeof rawLeaf === 'number' ? rawLeaf : 0;

  return (
    <div style={{ padding: '12px 16px', borderBottom: last ? 'none' : `1px solid ${t.border}`, background: t.black }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span
          style={{
            flexShrink: 0,
            marginTop: 1,
            minWidth: 28,
            height: 20,
            padding: '0 6px',
            borderRadius: 6,
            background: t.surfaceInk,
            border: `1px solid ${t.border}`,
            color: t.textSecondary,
            fontFamily: editorialFonts.mono,
            fontSize: 10.5,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×{criterion.weight}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 500, color: t.textDisplay }}>{criterion.title}</span>
          {criterion.mandatory ? (
            <span
              style={{
                marginLeft: 8,
                fontFamily: editorialFonts.mono,
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: t.textDisabled,
              }}
            >
              Required
            </span>
          ) : null}
        </div>
        {isRubric ? (
          <span
            style={{
              flexShrink: 0,
              fontFamily: editorialFonts.mono,
              fontSize: 12,
              fontWeight: 600,
              color: ev.value === 1 ? t.success : t.textSecondary,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {ev.applicable === 0 ? 'N/A' : `${ev.met}/${ev.applicable}`}
          </span>
        ) : (
          <LeafBadge t={t} value={leaf} />
        )}
      </div>

      {isRubric ? (
        <div style={{ marginLeft: 38, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {criterion.subChecks!.map((sc) => {
            const s = answers[subCheckKey(criterion.id, sc.id)];
            const state = s === 'met' ? 'met' : s === 'na' ? 'na' : 'unmet';
            return (
              <div key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: state === 'na' ? 0.5 : 1 }}>
                {state === 'met' ? (
                  <Check size={13} style={{ color: t.success, flexShrink: 0 }} />
                ) : state === 'na' ? (
                  <Minus size={13} style={{ color: t.textDisabled, flexShrink: 0 }} />
                ) : (
                  <X size={13} style={{ color: t.textDisabled, flexShrink: 0 }} />
                )}
                <span
                  style={{
                    fontSize: 12.5,
                    color: state === 'met' ? t.textPrimary : t.textSecondary,
                    textDecoration: state === 'na' ? 'line-through' : 'none',
                  }}
                >
                  {sc.title}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function LeafBadge({ t, value }: { t: SwatchTheme; value: number }): ReactNode {
  const label = value === 1 ? '1' : value === 0.5 ? '½' : '0';
  const color = value === 1 ? t.success : value === 0.5 ? t.accent : t.textDisabled;
  return (
    <span
      style={{
        flexShrink: 0,
        minWidth: 24,
        height: 22,
        padding: '0 7px',
        borderRadius: 999,
        background: t.surfaceInk,
        border: `1px solid ${value > 0 ? color : t.border}`,
        color,
        fontFamily: editorialFonts.mono,
        fontSize: 12,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {label}
    </span>
  );
}

function verdictColor(t: SwatchTheme, verdict: Verdict): string {
  if (verdict === 'cleared') return t.success;
  if (verdict === 'almost') return t.warning;
  return t.danger;
}

function labelStyle(t: SwatchTheme): CSSProperties {
  return {
    fontFamily: editorialFonts.mono,
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: t.textSecondary,
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
