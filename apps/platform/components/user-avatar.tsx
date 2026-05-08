import type { CSSProperties, ReactNode } from 'react';

/**
 * Renders the user's photo if `avatarUrl` is present, otherwise their initials
 * inside a colored circle. Used everywhere a person is shown (top nav, comments,
 * staff chips, profile header).
 */
export function UserAvatar({
  name,
  email,
  avatarUrl,
  size = 28,
  fontSize,
  background = 'oklch(0.95 0.04 254)',
  color = 'oklch(0.5 0.22 254)',
  border,
  style,
}: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: number;
  fontSize?: number;
  /** Background color for the initials state. Defaults to accent-subtle. */
  background?: string;
  /** Text color for the initials state. Defaults to accent. */
  color?: string;
  /** Optional border (e.g. `1px solid oklch(...)`). */
  border?: string;
  style?: CSSProperties;
}): ReactNode {
  const display = name?.trim() || email?.split('@')[0] || '';
  const initials =
    display
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .join('')
      .slice(0, 2)
      .toUpperCase() || '··';

  const baseStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 999,
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border,
    background,
    color,
    fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
    fontSize: fontSize ?? Math.max(9, Math.round(size * 0.4)),
    fontWeight: 600,
    letterSpacing: '-0.01em',
    ...style,
  };

  if (avatarUrl) {
    return (
      <span style={baseStyle} aria-label={display}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </span>
    );
  }

  return (
    <span style={baseStyle} aria-label={display}>
      {initials}
    </span>
  );
}
