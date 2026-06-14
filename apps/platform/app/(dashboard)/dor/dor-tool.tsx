'use client';

import {
  CalendarClock,
  Check,
  ClipboardCheck,
  Loader2,
  Lock,
  RotateCcw,
  Sparkles,
  PenTool,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import type { DorAssessment } from '@/lib/db';
import {
  canCommitEta,
  CLEAR_THRESHOLD,
  computeScore,
  criteriaForTrack,
  ETA_UNLOCK_THRESHOLD,
  evalCriterion,
  subCheckKey,
  verdictLabel,
  type AnswerMap,
  type Criterion,
  type CriterionScore,
  type SubCheck,
  type Track,
  type Verdict,
} from '@/lib/dor/criteria';
import { editorialFonts, getNd, type SwatchTheme } from '@/lib/tokens';

export interface DorAppOption {
  id: string;
  name: string;
  platform: 'web' | 'ios' | 'android';
}

const STICKY_TOP = 76; // topnav (60) + breathing room.

export function DorTool({
  apps,
  initialHistory,
  designerName: initialDesigner,
}: {
  apps: DorAppOption[];
  initialHistory: DorAssessment[];
  designerName: string;
}): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);

  const [track, setTrack] = useState<Track>('ai');
  const [projectMode, setProjectMode] = useState<'existing' | 'new'>(
    apps.length > 0 ? 'existing' : 'new',
  );
  const [appId, setAppId] = useState<string>(apps[0]?.id ?? '');
  const [customProject, setCustomProject] = useState('');
  const [designerName, setDesignerName] = useState(initialDesigner);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [etaHours, setEtaHours] = useState('');
  const [etaDate, setEtaDate] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [history, setHistory] = useState<DorAssessment[]>(initialHistory);

  const criteria = useMemo(() => criteriaForTrack(track), [track]);
  const result = useMemo(() => computeScore(track, answers), [track, answers]);
  const { score, cleared, verdict, missingMandatory } = result;

  // A criterion counts as "addressed" once it has any signal: a leaf tick > 0,
  // or any sub-check marked met / N/A. "Untouched" stays neutral so a fresh
  // form doesn't scream red 0.0 before the designer has rated anything.
  const ratedCount = criteria.filter((c) =>
    c.subChecks && c.subChecks.length > 0
      ? c.subChecks.some((sc) => {
          const s = answers[subCheckKey(c.id, sc.id)];
          return s === 'met' || s === 'na';
        })
      : typeof answers[c.id] === 'number' && (answers[c.id] as number) > 0,
  ).length;
  const touched = ratedCount > 0;

  const resolvedProjectName =
    projectMode === 'existing'
      ? (apps.find((a) => a.id === appId)?.name ?? '')
      : customProject.trim();

  const canSave = resolvedProjectName.length > 0 && designerName.trim().length > 0;
  const dirty = touched || etaHours.trim() !== '' || etaDate.trim() !== '';
  const etaUnlocked = canCommitEta(score);

  function setLeaf(id: string, value: CriterionScore): void {
    setJustSaved(false);
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  // Toggle a sub-check between met and unmet. Marking met also clears any N/A.
  function toggleSubMet(criterionId: string, subId: string): void {
    setJustSaved(false);
    const key = subCheckKey(criterionId, subId);
    setAnswers((prev) => {
      const next = { ...prev };
      if (next[key] === 'met') delete next[key];
      else next[key] = 'met';
      return next;
    });
  }

  // Toggle a sub-check's N/A flag (drops it out of the criterion's denominator).
  function toggleSubNa(criterionId: string, subId: string): void {
    setJustSaved(false);
    const key = subCheckKey(criterionId, subId);
    setAnswers((prev) => {
      const next = { ...prev };
      if (next[key] === 'na') delete next[key];
      else next[key] = 'na';
      return next;
    });
  }

  function resetChecklist(): void {
    setAnswers({});
    setEtaHours('');
    setEtaDate('');
    setError(null);
    setJustSaved(false);
  }

  async function handleSave(): Promise<void> {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      const payload: Record<string, unknown> = {
        track,
        designerName: designerName.trim(),
        scores: answers,
        etaHours: etaHours.trim() ? Number(etaHours) : undefined,
        etaDate: etaDate.trim() || undefined,
      };
      if (projectMode === 'existing' && appId) payload.appId = appId;
      else payload.projectName = resolvedProjectName;

      const res = await fetch('/api/dor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        assessment?: DorAssessment;
        error?: string;
      };
      if (!res.ok || !json.assessment) {
        setError(json.error ?? 'Save failed.');
        return;
      }
      setHistory((prev) => [json.assessment as DorAssessment, ...prev]);
      setJustSaved(true);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="dor-root"
      style={{
        maxWidth: 1120,
        margin: '0 auto',
        padding: '40px 24px 96px',
        fontFamily: editorialFonts.body,
        color: t.textPrimary,
      }}
    >
      {/* Header */}
      <header style={{ marginBottom: 32 }}>
        <p style={labelStyle(t)}>
          <ClipboardCheck size={11} style={{ marginRight: 6, verticalAlign: '-1px' }} />
          Definition of Ready
        </p>
        <h1
          style={{
            margin: '8px 0 0',
            fontSize: 32,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: t.textDisplay,
          }}
        >
          Readiness self-check
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: t.textSecondary, maxWidth: 620 }}>
          Score the PM handoff before you start designing. You clear at{' '}
          <strong style={{ color: t.textPrimary }}>{CLEAR_THRESHOLD.toFixed(1)}</strong> with every
          mandatory item complete — only then can you commit an ETA.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* ── Left column: inputs ───────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* Track toggle */}
          <Card t={t}>
            <FieldLabel t={t}>Design track</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
              <TrackButton
                t={t}
                active={track === 'ai'}
                icon={<Sparkles size={15} />}
                title="AI design"
                caption="Vibe-coded build"
                onClick={() => setTrack('ai')}
              />
              <TrackButton
                t={t}
                active={track === 'figma'}
                icon={<PenTool size={15} />}
                title="Manual Figma"
                caption="Hand-crafted in Figma"
                onClick={() => setTrack('figma')}
              />
            </div>
          </Card>

          {/* Project + designer */}
          <Card t={t}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <FieldLabel t={t}>Project</FieldLabel>
                <div
                  style={{
                    display: 'inline-flex',
                    gap: 4,
                    marginTop: 10,
                    padding: 3,
                    borderRadius: 999,
                    background: t.surfaceInk,
                    border: `1px solid ${t.border}`,
                  }}
                >
                  <Segment
                    t={t}
                    active={projectMode === 'existing'}
                    disabled={apps.length === 0}
                    onClick={() => setProjectMode('existing')}
                  >
                    Existing project
                  </Segment>
                  <Segment
                    t={t}
                    active={projectMode === 'new'}
                    onClick={() => setProjectMode('new')}
                  >
                    New / external
                  </Segment>
                </div>

                {projectMode === 'existing' ? (
                  apps.length > 0 ? (
                    <select
                      value={appId}
                      onChange={(e) => setAppId(e.currentTarget.value)}
                      className="dor-focus"
                      style={{ ...inputStyle(t), marginTop: 10, cursor: 'pointer' }}
                    >
                      {apps.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} · {a.platform}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p style={{ margin: '10px 0 0', fontSize: 13, color: t.textSecondary }}>
                      No gallery projects yet — switch to “New / external”.
                    </p>
                  )
                ) : (
                  <input
                    type="text"
                    value={customProject}
                    onChange={(e) => setCustomProject(e.currentTarget.value)}
                    placeholder="Project name"
                    className="dor-focus"
                    style={{ ...inputStyle(t), marginTop: 10 }}
                  />
                )}
              </div>

              <div>
                <FieldLabel t={t}>Designer</FieldLabel>
                <input
                  type="text"
                  value={designerName}
                  onChange={(e) => setDesignerName(e.currentTarget.value)}
                  placeholder="Your name"
                  className="dor-focus"
                  style={{ ...inputStyle(t), marginTop: 10 }}
                />
              </div>
            </div>
          </Card>

          {/* Criteria */}
          <Card t={t} padded={false}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                padding: '16px 18px',
                borderBottom: `1px solid ${t.border}`,
              }}
            >
              <div>
                <FieldLabel t={t}>Checklist</FieldLabel>
                <p style={{ margin: '6px 0 0', fontSize: 12.5, color: t.textSecondary }}>
                  Tick each rubric sub-check that’s true; rate the rest{' '}
                  <strong style={{ color: t.textPrimary }}>0</strong> ·{' '}
                  <strong style={{ color: t.textPrimary }}>½</strong> ·{' '}
                  <strong style={{ color: t.textPrimary }}>1</strong>.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                <span
                  style={{
                    fontFamily: editorialFonts.mono,
                    fontSize: 11,
                    color: t.textSecondary,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {ratedCount} / {criteria.length} rated
                </span>
                {dirty ? (
                  <button
                    type="button"
                    onClick={resetChecklist}
                    className="dor-focus"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      border: 'none',
                      background: 'transparent',
                      color: t.textSecondary,
                      fontFamily: editorialFonts.body,
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: 6,
                    }}
                  >
                    <RotateCcw size={11} />
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
            <div>
              {criteria.map((c, i) => (
                <CriterionRow
                  key={c.id}
                  t={t}
                  criterion={c}
                  answers={answers}
                  onLeaf={(v) => setLeaf(c.id, v)}
                  onSubMet={(subId) => toggleSubMet(c.id, subId)}
                  onSubNa={(subId) => toggleSubNa(c.id, subId)}
                  last={i === criteria.length - 1}
                />
              ))}
            </div>
          </Card>
        </div>

        {/* ── Right column: verdict + ETA + save (sticky on desktop) ────── */}
        <aside
          className="flex flex-col gap-4 lg:sticky"
          style={{ top: STICKY_TOP }}
        >
          <VerdictCard
            t={t}
            score={score}
            verdict={verdict}
            cleared={cleared}
            touched={touched}
            missingMandatory={missingMandatory}
          />

          <EtaBlock
            t={t}
            unlocked={etaUnlocked}
            etaHours={etaHours}
            etaDate={etaDate}
            onHours={setEtaHours}
            onDate={setEtaDate}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canSave || saving}
              className="dor-focus"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                padding: '12px 18px',
                borderRadius: 10,
                border: 'none',
                background: t.accent,
                color: t.accentFg,
                fontFamily: editorialFonts.body,
                fontSize: 14,
                fontWeight: 600,
                cursor: !canSave || saving ? 'not-allowed' : 'pointer',
                opacity: !canSave || saving ? 0.55 : 1,
                transition: 'opacity 160ms ease-out',
              }}
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Save assessment
            </button>
            {error ? (
              <p role="alert" style={{ margin: 0, fontSize: 12.5, color: t.danger, textAlign: 'center' }}>
                {error}
              </p>
            ) : null}
            {justSaved && !error ? (
              <p style={{ margin: 0, fontSize: 12.5, color: t.success, textAlign: 'center' }}>
                Saved to the team history. Use <strong style={{ fontWeight: 600 }}>Clear</strong> to
                start another.
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      {/* ── Team history ──────────────────────────────────────────────── */}
      <section style={{ marginTop: 44 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: t.textDisplay,
          }}
        >
          Team history
        </h2>
        <p style={{ margin: '4px 0 16px', fontSize: 13, color: t.textSecondary }}>
          Every readiness check the team has run, newest first.
        </p>
        {history.length === 0 ? (
          <div
            style={{
              padding: 32,
              borderRadius: 12,
              border: `1px dashed ${t.borderVisible}`,
              textAlign: 'center',
              color: t.textSecondary,
              fontSize: 14,
            }}
          >
            No assessments yet. Your first save will show up here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((h) => (
              <HistoryRow key={h.id} t={t} row={h} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function CriterionRow({
  t,
  criterion,
  answers,
  onLeaf,
  onSubMet,
  onSubNa,
  last,
}: {
  t: SwatchTheme;
  criterion: Criterion;
  answers: AnswerMap;
  onLeaf: (v: CriterionScore) => void;
  onSubMet: (subId: string) => void;
  onSubNa: (subId: string) => void;
  last: boolean;
}): ReactNode {
  const isRubric = Boolean(criterion.subChecks && criterion.subChecks.length > 0);
  const ev = evalCriterion(criterion, answers);
  // A mandatory item below a full 1 blocks clearance — flag it so the designer
  // isn't surprised. A fully-N/A rubric (value null) doesn't apply, so no flag.
  const blocking = criterion.mandatory && ev.value !== null && ev.value < 1;
  const rawLeaf = answers[criterion.id];
  const leafValue: CriterionScore = typeof rawLeaf === 'number' ? (rawLeaf as CriterionScore) : 0;

  return (
    <div
      style={{
        padding: '14px 18px',
        borderBottom: last ? 'none' : `1px solid ${t.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <WeightBadge t={t} weight={criterion.weight} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: t.textDisplay }}>
              {criterion.title}
            </span>
            {criterion.mandatory ? <RequiredTag t={t} blocking={blocking} /> : null}
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, lineHeight: 1.45, color: t.textSecondary }}>
            {criterion.description}
          </p>
        </div>
        {isRubric ? (
          <RollupChip t={t} met={ev.met} applicable={ev.applicable} complete={ev.value === 1} />
        ) : (
          <TickPicker t={t} value={leafValue} onChange={onLeaf} label={criterion.title} />
        )}
      </div>

      {isRubric ? (
        <div style={{ marginLeft: 44, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {criterion.subChecks!.map((sc) => {
            const state = answers[subCheckKey(criterion.id, sc.id)];
            return (
              <SubCheckRow
                key={sc.id}
                t={t}
                subCheck={sc}
                met={state === 'met'}
                na={state === 'na'}
                onToggleMet={() => onSubMet(sc.id)}
                onToggleNa={() => onSubNa(sc.id)}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function RequiredTag({ t, blocking }: { t: SwatchTheme; blocking: boolean }): ReactNode {
  return (
    <span
      style={{
        fontFamily: editorialFonts.mono,
        fontSize: 9,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: blocking ? t.warning : t.textDisabled,
        border: `1px solid ${blocking ? t.warning : t.border}`,
        borderRadius: 999,
        padding: '1px 6px',
        transition: 'color 120ms ease-out, border-color 120ms ease-out',
      }}
    >
      Required
    </span>
  );
}

/** The "4 / 6" rollup shown on a rubric criterion's header. */
function RollupChip({
  t,
  met,
  applicable,
  complete,
}: {
  t: SwatchTheme;
  met: number;
  applicable: number;
  complete: boolean;
}): ReactNode {
  const allNa = applicable === 0;
  const color = allNa ? t.textDisabled : complete ? t.success : met > 0 ? t.accent : t.textSecondary;
  return (
    <span
      title={allNa ? 'All sub-checks marked N/A' : `${met} of ${applicable} sub-checks met`}
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        padding: '0 10px',
        borderRadius: 999,
        background: t.surfaceInk,
        border: `1px solid ${complete ? t.success : t.border}`,
        color,
        fontFamily: editorialFonts.mono,
        fontSize: 12,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {complete ? <Check size={12} /> : null}
      {allNa ? 'N/A' : `${met}/${applicable}`}
    </span>
  );
}

function SubCheckRow({
  t,
  subCheck,
  met,
  na,
  onToggleMet,
  onToggleNa,
}: {
  t: SwatchTheme;
  subCheck: SubCheck;
  met: boolean;
  na: boolean;
  onToggleMet: () => void;
  onToggleNa: () => void;
}): ReactNode {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '7px 10px',
        borderRadius: 8,
        background: na ? 'transparent' : t.surface,
        opacity: na ? 0.5 : 1,
        transition: 'opacity 120ms ease-out, background 120ms ease-out',
      }}
    >
      <Checkbox t={t} checked={met} disabled={na} onToggle={onToggleMet} label={subCheck.title} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 500,
            color: t.textPrimary,
            textDecoration: na ? 'line-through' : 'none',
          }}
        >
          {subCheck.title}
        </p>
        <p style={{ margin: '1px 0 0', fontSize: 11.5, lineHeight: 1.4, color: t.textSecondary }}>
          {subCheck.description}
        </p>
      </div>
      <NaToggle t={t} active={na} onToggle={onToggleNa} />
    </div>
  );
}

function Checkbox({
  t,
  checked,
  disabled,
  onToggle,
  label,
}: {
  t: SwatchTheme;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
  label: string;
}): ReactNode {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className="dor-focus"
      style={{
        flexShrink: 0,
        marginTop: 1,
        width: 20,
        height: 20,
        borderRadius: 6,
        border: `1px solid ${checked ? t.success : t.borderStrong}`,
        background: checked ? t.success : 'transparent',
        color: checked ? t.accentFg : 'transparent',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0,
        transition: 'background 120ms ease-out, border-color 120ms ease-out',
      }}
    >
      <Check size={13} strokeWidth={3} />
    </button>
  );
}

function NaToggle({
  t,
  active,
  onToggle,
}: {
  t: SwatchTheme;
  active: boolean;
  onToggle: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label="Mark not applicable"
      onClick={onToggle}
      className="dor-focus"
      style={{
        flexShrink: 0,
        alignSelf: 'center',
        padding: '3px 8px',
        borderRadius: 999,
        border: `1px solid ${active ? t.borderStrong : t.border}`,
        background: active ? t.surfaceRaised : 'transparent',
        color: active ? t.textPrimary : t.textDisabled,
        fontFamily: editorialFonts.mono,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.04em',
        cursor: 'pointer',
        transition: 'background 120ms ease-out, border-color 120ms ease-out, color 120ms ease-out',
      }}
    >
      N/A
    </button>
  );
}

const TICK_OPTS: { v: CriterionScore; label: string }[] = [
  { v: 0, label: '0' },
  { v: 0.5, label: '½' },
  { v: 1, label: '1' },
];

function TickPicker({
  t,
  value,
  onChange,
  label,
}: {
  t: SwatchTheme;
  value: CriterionScore;
  onChange: (v: CriterionScore) => void;
  label: string;
}): ReactNode {
  const groupRef = useRef<HTMLDivElement>(null);
  const idx = TICK_OPTS.findIndex((o) => o.v === value);

  // Roving-tabindex radiogroup: arrow / home / end move and select, so the
  // whole checklist can be flown through from the keyboard.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    let next = idx;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = Math.min(TICK_OPTS.length - 1, idx + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = Math.max(0, idx - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = TICK_OPTS.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    onChange(TICK_OPTS[next]!.v);
    const buttons = groupRef.current?.querySelectorAll('button');
    buttons?.[next]?.focus();
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={`Rating for ${label}`}
      onKeyDown={onKeyDown}
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 3,
        borderRadius: 999,
        background: t.surfaceInk,
        border: `1px solid ${t.border}`,
        flexShrink: 0,
      }}
    >
      {TICK_OPTS.map((o, i) => {
        const active = value === o.v;
        return (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label === '½' ? 'Partial (half)' : o.label}
            tabIndex={active || (idx === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.v)}
            className="dor-focus"
            style={{
              width: 32,
              height: 28,
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              fontFamily: editorialFonts.mono,
              fontSize: 13,
              fontWeight: 600,
              background: active ? (o.v === 1 ? t.success : t.accent) : 'transparent',
              color: active ? t.accentFg : t.textSecondary,
              transition: 'background 120ms ease-out, color 120ms ease-out',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function WeightBadge({ t, weight }: { t: SwatchTheme; weight: number }): ReactNode {
  return (
    <span
      title={`Weight ×${weight}`}
      style={{
        flexShrink: 0,
        marginTop: 1,
        minWidth: 30,
        height: 22,
        padding: '0 7px',
        borderRadius: 6,
        background: t.surfaceInk,
        border: `1px solid ${t.border}`,
        color: t.textSecondary,
        fontFamily: editorialFonts.mono,
        fontSize: 11,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      ×{weight}
    </span>
  );
}

function VerdictCard({
  t,
  score,
  verdict,
  cleared,
  touched,
  missingMandatory,
}: {
  t: SwatchTheme;
  score: number;
  verdict: Verdict;
  cleared: boolean;
  touched: boolean;
  missingMandatory: Criterion[];
}): ReactNode {
  const reduced = usePrefersReducedMotion();
  const display = useAnimatedNumber(touched ? score : 0, reduced);

  const color = touched ? verdictColor(t, verdict) : t.borderStrong;
  const numberColor = touched ? color : t.textDisabled;
  const pct = Math.min(100, Math.max(0, (score / 10) * 100));
  const label = touched ? verdictLabel(verdict) : 'Not started';

  return (
    <Card t={t}>
      <FieldLabel t={t}>Verdict</FieldLabel>

      {/* Live region so screen readers hear the score + verdict as it changes. */}
      <div
        aria-live="polite"
        style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}
      >
        <span
          style={{
            fontFamily: editorialFonts.display,
            fontSize: 48,
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: numberColor,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {display.toFixed(1)}
        </span>
        <span style={{ fontSize: 16, color: t.textSecondary }}>/ 10</span>
        <span className="sr-only">
          {touched
            ? `Score ${score.toFixed(1)} out of 10. ${label}.`
            : 'Not started. Rate the checklist to see your readiness.'}
        </span>
      </div>

      {/* progress bar with a marker at the clear threshold */}
      <div
        style={{
          marginTop: 14,
          height: 8,
          borderRadius: 999,
          background: t.surfaceInk,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${touched ? pct : 0}%`,
            height: '100%',
            background: color,
            borderRadius: 999,
            transition: 'width 260ms cubic-bezier(0.165, 0.84, 0.44, 1)',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -2,
            bottom: -2,
            left: `${(CLEAR_THRESHOLD / 10) * 100}%`,
            width: 2,
            background: t.borderStrong,
          }}
        />
      </div>

      <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block' }} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: t.textDisplay }}>{label}</span>
      </div>

      {!touched ? (
        <p style={{ margin: '12px 0 0', fontSize: 12.5, color: t.textSecondary, lineHeight: 1.5 }}>
          Rate the checklist to see where the handoff stands.
        </p>
      ) : cleared ? (
        <p style={{ margin: '12px 0 0', fontSize: 12.5, color: t.success }}>
          Ready to start — commit your ETA below.
        </p>
      ) : (
        <div style={{ marginTop: 12 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11.5,
              fontFamily: editorialFonts.mono,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: t.textSecondary,
            }}
          >
            {missingMandatory.length > 0
              ? `Blocking (${missingMandatory.length})`
              : `Reach ${CLEAR_THRESHOLD.toFixed(1)} to clear`}
          </p>
          {missingMandatory.length > 0 ? (
            <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {missingMandatory.map((c) => (
                <li
                  key={c.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: t.textPrimary }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: t.warning, flexShrink: 0 }} />
                  {c.title}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function EtaBlock({
  t,
  unlocked,
  etaHours,
  etaDate,
  onHours,
  onDate,
}: {
  t: SwatchTheme;
  unlocked: boolean;
  etaHours: string;
  etaDate: string;
  onHours: (v: string) => void;
  onDate: (v: string) => void;
}): ReactNode {
  return (
    <Card t={t}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <FieldLabel t={t}>
          <CalendarClock size={11} style={{ marginRight: 6, verticalAlign: '-1px' }} />
          ETA commitment
        </FieldLabel>
        {!unlocked ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: t.textDisabled }}>
            <Lock size={11} /> Locked
          </span>
        ) : null}
      </div>

      {unlocked ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={subLabelStyle(t)}>Estimated hours</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={etaHours}
              onChange={(e) => onHours(e.currentTarget.value)}
              placeholder="e.g. 6"
              className="dor-focus"
              style={inputStyle(t)}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={subLabelStyle(t)}>Target date</span>
            <input
              type="date"
              value={etaDate}
              onChange={(e) => onDate(e.currentTarget.value)}
              className="dor-focus"
              style={inputStyle(t)}
            />
          </label>
        </div>
      ) : (
        <p style={{ margin: '10px 0 0', fontSize: 12.5, color: t.textSecondary, lineHeight: 1.5 }}>
          Unlocks once your score is above {ETA_UNLOCK_THRESHOLD.toFixed(1)} — close enough to commit
          a time estimate, even before the check fully clears at {CLEAR_THRESHOLD.toFixed(1)}.
        </p>
      )}
    </Card>
  );
}

function HistoryRow({ t, row }: { t: SwatchTheme; row: DorAssessment }): ReactNode {
  const color = verdictColor(t, row.verdict);
  const eta = row.eta_hours != null
    ? `${row.eta_hours}h`
    : row.eta_date
      ? formatDate(row.eta_date)
      : null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 16px',
        borderRadius: 10,
        background: t.black,
        border: `1px solid ${t.border}`,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 46,
          height: 46,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: t.surfaceInk,
          border: `1px solid ${color}`,
          color,
          fontFamily: editorialFonts.display,
          fontSize: 17,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {row.score.toFixed(1)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: t.textDisplay,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 260,
            }}
          >
            {row.project_name}
          </span>
          <TrackChip t={t} track={row.track} />
        </div>
        <p style={{ margin: '2px 0 0', fontSize: 12.5, color: t.textSecondary }}>
          {row.designer_name} · {formatDate(row.created_at)}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: color }} />
          {verdictLabel(row.verdict)}
        </span>
        {eta ? (
          <span style={{ fontSize: 11.5, color: t.textSecondary, fontFamily: editorialFonts.mono }}>
            ETA {eta}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TrackChip({ t, track }: { t: SwatchTheme; track: Track }): ReactNode {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: editorialFonts.mono,
        fontSize: 9,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: t.textSecondary,
        background: t.surfaceInk,
        border: `1px solid ${t.border}`,
        borderRadius: 999,
        padding: '2px 7px',
      }}
    >
      {track === 'ai' ? <Sparkles size={9} /> : <PenTool size={9} />}
      {track === 'ai' ? 'AI' : 'Figma'}
    </span>
  );
}

function TrackButton({
  t,
  active,
  icon,
  title,
  caption,
  onClick,
}: {
  t: SwatchTheme;
  active: boolean;
  icon: ReactNode;
  title: string;
  caption: string;
  onClick: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="dor-focus"
      style={{
        textAlign: 'left',
        padding: 14,
        borderRadius: 10,
        background: active ? t.surfaceRaised : t.surface,
        border: `1px solid ${active ? t.accent : t.border}`,
        cursor: 'pointer',
        fontFamily: editorialFonts.body,
        transition: 'background 120ms ease-out, border-color 120ms ease-out',
      }}
    >
      <span
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: active ? t.accent : t.textPrimary }}
      >
        {icon}
        <span style={{ fontSize: 14, fontWeight: 600, color: t.textDisplay }}>{title}</span>
      </span>
      <p style={{ margin: '4px 0 0', fontSize: 12, color: t.textSecondary }}>{caption}</p>
    </button>
  );
}

function Segment({
  t,
  active,
  disabled,
  onClick,
  children,
}: {
  t: SwatchTheme;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className="dor-focus"
      style={{
        padding: '6px 14px',
        borderRadius: 999,
        border: 'none',
        background: active ? t.accent : 'transparent',
        color: active ? t.accentFg : disabled ? t.textDisabled : t.textSecondary,
        fontFamily: editorialFonts.body,
        fontSize: 12.5,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 120ms ease-out, color 120ms ease-out',
      }}
    >
      {children}
    </button>
  );
}

function Card({
  t,
  children,
  padded = true,
}: {
  t: SwatchTheme;
  children: ReactNode;
  padded?: boolean;
}): ReactNode {
  return (
    <div
      style={{
        background: t.black,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: padded ? 18 : 0,
      }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ t, children }: { t: SwatchTheme; children: ReactNode }): ReactNode {
  return <span style={labelStyle(t)}>{children}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (): void => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Eases the displayed number toward `target`; jumps instantly if reduced-motion. */
function useAnimatedNumber(target: number, reduced: boolean): number {
  const [display, setDisplay] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    if (reduced || current.current === target) {
      current.current = target;
      setDisplay(target);
      return;
    }
    const from = current.current;
    const start = performance.now();
    const duration = 280;
    let raf = 0;
    const step = (now: number): void => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const value = from + (target - from) * eased;
      current.current = value;
      setDisplay(value);
      if (p < 1) raf = requestAnimationFrame(step);
      else {
        current.current = target;
        setDisplay(target);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);

  return display;
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles + helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function subLabelStyle(t: SwatchTheme): CSSProperties {
  return {
    fontFamily: editorialFonts.mono,
    fontSize: 10.5,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: t.textSecondary,
  };
}

function inputStyle(t: SwatchTheme): CSSProperties {
  return {
    width: '100%',
    padding: '10px 13px',
    borderRadius: 9,
    border: `1px solid ${t.borderVisible}`,
    background: t.surface,
    fontFamily: editorialFonts.body,
    fontSize: 14,
    color: t.textDisplay,
    outline: 'none',
    transition: 'border-color 160ms ease-out',
    boxSizing: 'border-box',
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
