'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Check,
  ChevronRight,
  Copy,
  FileDown,
  ImageDown,
  Loader2,
  MessageCircle,
  Search,
  Send,
  Star,
  X,
} from 'lucide-react';
import { useTheme } from '@/components/providers/theme-provider';
import {
  editorialFonts,
  getNd,
  getShadow,
  motion,
  space,
  swatchRadii,
  swatchTokens,
  type,
  type SwatchTheme,
  type TypeKey,
} from '@/lib/tokens';

export default function DesignSystemPage(): ReactNode {
  const { theme, toggle } = useTheme();
  const t = getNd(theme);
  const sh = getShadow(theme);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: t.black,
        color: t.textPrimary,
        fontFamily: editorialFonts.body,
        padding: '48px 64px',
        maxWidth: 1200,
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', color: t.textDisplay, margin: 0 }}>
            Design System
          </h1>
          <p style={{ fontSize: 14, color: t.textSecondary, margin: '8px 0 0' }}>
            Unicorn Studio Gallery - living token reference
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: t.surface,
            color: t.textPrimary,
            fontFamily: editorialFonts.body,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
        </button>
      </div>

      <Section title="Colors" t={t}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {Object.entries(theme === 'dark' ? swatchTokens.dark : swatchTokens.light).map(([name, value]) => (
            <ColorSwatch key={name} name={name} value={value} t={t} />
          ))}
        </div>
      </Section>

      <Section title="Typography" t={t}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {(Object.keys(type) as TypeKey[]).map((key) => {
            const style = type[key];
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
                <span
                  style={{
                    width: 100,
                    flexShrink: 0,
                    fontFamily: editorialFonts.mono,
                    fontSize: 11,
                    color: t.textSecondary,
                  }}
                >
                  {key}
                </span>
                <span style={{ ...style, color: t.textDisplay } as React.CSSProperties}>
                  The quick brown fox
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontFamily: editorialFonts.mono,
                    fontSize: 10,
                    color: t.textDisabled,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {style.fontSize}px / {style.fontWeight}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Spacing" t={t}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          {Object.entries(space).map(([key, px]) => (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: Math.max(px, 4),
                  height: Math.max(px, 4),
                  background: t.accent,
                  borderRadius: 2,
                  opacity: 0.8,
                }}
              />
              <span style={{ fontFamily: editorialFonts.mono, fontSize: 10, color: t.textSecondary }}>
                {key}
              </span>
              <span style={{ fontFamily: editorialFonts.mono, fontSize: 9, color: t.textDisabled }}>
                {px}px
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Radii" t={t}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {Object.entries(swatchRadii).map(([name, value]) => (
            <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  background: t.surface,
                  border: `2px solid ${t.accent}`,
                  borderRadius: value,
                }}
              />
              <span style={{ fontFamily: editorialFonts.mono, fontSize: 10, color: t.textSecondary }}>{name}</span>
              <span style={{ fontFamily: editorialFonts.mono, fontSize: 9, color: t.textDisabled }}>{value}px</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Shadows" t={t}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {(['none', 'low', 'medium', 'high'] as const).map((level) => (
            <div key={level} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 120,
                  height: 80,
                  background: t.surface,
                  borderRadius: 12,
                  border: `1px solid ${t.border}`,
                  boxShadow: sh[level],
                }}
              />
              <span style={{ fontFamily: editorialFonts.mono, fontSize: 10, color: t.textSecondary }}>{level}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons" t={t}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <DemoButton t={t} variant="primary" label="Primary" />
          <DemoButton t={t} variant="secondary" label="Secondary" />
          <DemoButton t={t} variant="ghost" label="Ghost" />
          <DemoButton t={t} variant="danger" label="Danger" />
          <DemoButton t={t} variant="primary" label="Loading" loading />
          <DemoButton t={t} variant="primary" label="Disabled" disabled />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
          <DemoButton t={t} variant="primary" label="With Icon" icon={<Send size={14} />} />
          <DemoButton t={t} variant="secondary" label="Download" icon={<FileDown size={14} />} />
          <DemoIconButton t={t} icon={<Search size={16} />} />
          <DemoIconButton t={t} icon={<Star size={16} />} />
          <DemoIconButton t={t} icon={<Copy size={16} />} />
          <DemoIconButton t={t} icon={<X size={16} />} />
        </div>
      </Section>

      <Section title="Inputs" t={t}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', maxWidth: 600 }}>
          <DemoInput t={t} placeholder="Default input" />
          <DemoInput t={t} placeholder="With icon" icon={<Search size={14} />} />
          <DemoInput t={t} placeholder="Disabled" disabled />
        </div>
      </Section>

      <Section title="Badges & Pills" t={t}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <DemoBadge t={t} label="Default" />
          <DemoBadge t={t} label="Accent" color={t.accent} bg={t.accentSubtle} />
          <DemoBadge t={t} label="Success" color={t.success} bg="transparent" border />
          <DemoBadge t={t} label="Warning" color={t.warning} bg="transparent" border />
          <DemoBadge t={t} label="Danger" color={t.danger} bg="transparent" border />
          <DemoBadge t={t} label="3" pill color={t.accentFg} bg={t.accent} />
          <DemoBadge t={t} label="12" pill color={t.accentFg} bg={t.danger} />
          <DemoBadge t={t} label="New" pill color={t.accentFg} bg={t.accent} />
        </div>
      </Section>

      <Section title="Cards" t={t}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <DemoCard t={t} sh={sh} elevation="low" title="Low elevation" />
          <DemoCard t={t} sh={sh} elevation="medium" title="Medium elevation" />
          <DemoCard t={t} sh={sh} elevation="high" title="High elevation" />
        </div>
      </Section>

      <Section title="Motion" t={t}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {Object.entries(motion.duration).map(([name, value]) => (
            <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <MotionDemo duration={value} t={t} />
              <span style={{ fontFamily: editorialFonts.mono, fontSize: 10, color: t.textSecondary }}>{name}</span>
              <span style={{ fontFamily: editorialFonts.mono, fontSize: 9, color: t.textDisabled }}>{value}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Icons (Lucide)" t={t}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {[Check, ChevronRight, Copy, FileDown, ImageDown, Loader2, MessageCircle, Search, Send, Star, X].map(
            (Icon, i) => (
              <div
                key={i}
                style={{
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  background: t.surface,
                  color: t.textPrimary,
                }}
              >
                <Icon size={18} />
              </div>
            ),
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, t, children }: { title: string; t: SwatchTheme; children: ReactNode }): ReactNode {
  return (
    <section style={{ marginBottom: 56 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
          paddingBottom: 12,
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, color: t.textDisplay, margin: 0 }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ColorSwatch({ name, value, t }: { name: string; value: string; t: SwatchTheme }): ReactNode {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 8,
        border: `1px solid ${t.border}`,
        background: t.surface,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: value,
          border: `1px solid ${t.borderVisible}`,
          flexShrink: 0,
        }}
      />
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: t.textPrimary }}>{name}</div>
        <div style={{ fontFamily: editorialFonts.mono, fontSize: 9, color: t.textDisabled }}>{value}</div>
      </div>
    </div>
  );
}

function DemoButton({
  t,
  variant,
  label,
  icon,
  loading,
  disabled,
}: {
  t: SwatchTheme;
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  label: string;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
}): ReactNode {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: t.accent, color: t.accentFg, border: 'none' },
    secondary: { background: t.surface, color: t.textPrimary, border: `1px solid ${t.border}` },
    ghost: { background: 'transparent', color: t.textPrimary, border: '1px solid transparent' },
    danger: { background: t.danger, color: 'white', border: 'none' },
  };
  return (
    <button
      type="button"
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 16px',
        borderRadius: 8,
        fontFamily: editorialFonts.body,
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: motion.transition.chrome,
        ...styles[variant],
      }}
    >
      {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : icon}
      {label}
    </button>
  );
}

function DemoIconButton({ t, icon }: { t: SwatchTheme; icon: ReactNode }): ReactNode {
  return (
    <button
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: 8,
        border: `1px solid ${t.border}`,
        background: t.surface,
        color: t.textSecondary,
        cursor: 'pointer',
        transition: motion.transition.chrome,
      }}
    >
      {icon}
    </button>
  );
}

function DemoInput({
  t,
  placeholder,
  icon,
  disabled,
}: {
  t: SwatchTheme;
  placeholder: string;
  icon?: ReactNode;
  disabled?: boolean;
}): ReactNode {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 8,
        border: `1px solid ${t.borderVisible}`,
        background: t.surface,
        flex: 1,
        minWidth: 180,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon ? <span style={{ color: t.textDisabled, flexShrink: 0 }}>{icon}</span> : null}
      <input
        disabled={disabled}
        placeholder={placeholder}
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          outline: 'none',
          fontFamily: editorialFonts.body,
          fontSize: 13,
          color: t.textDisplay,
        }}
      />
    </div>
  );
}

function DemoBadge({
  t,
  label,
  color,
  bg,
  pill,
  border,
}: {
  t: SwatchTheme;
  label: string;
  color?: string;
  bg?: string;
  pill?: boolean;
  border?: boolean;
}): ReactNode {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: pill ? '2px 8px' : '3px 10px',
        borderRadius: pill ? 999 : 6,
        background: bg ?? t.surface,
        color: color ?? t.textSecondary,
        border: border ? `1px solid ${color ?? t.border}` : `1px solid transparent`,
        fontFamily: editorialFonts.mono,
        fontSize: pill ? 10 : 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </span>
  );
}

function DemoCard({
  t,
  sh,
  elevation,
  title,
}: {
  t: SwatchTheme;
  sh: ReturnType<typeof getShadow>;
  elevation: 'low' | 'medium' | 'high';
  title: string;
}): ReactNode {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        background: t.surface,
        boxShadow: sh[elevation],
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 500, color: t.textDisplay, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 12, color: t.textSecondary }}>
        Card content with {elevation} shadow elevation.
      </div>
    </div>
  );
}

function MotionDemo({ duration, t }: { duration: string; t: SwatchTheme }): ReactNode {
  const [active, setActive] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { setActive(true); setTimeout(() => setActive(false), 1000); }}
      style={{
        width: 64,
        height: 40,
        borderRadius: 8,
        border: `1px solid ${t.border}`,
        background: active ? t.accent : t.surface,
        cursor: 'pointer',
        transition: `background ${duration} ${motion.easing.out}`,
      }}
    />
  );
}
