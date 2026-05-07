'use client';

import { useState, type CSSProperties } from 'react';

interface UnicornLogoProps {
  variant?: 'mark' | 'wordmark';
  height?: number;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
  /** Hover color (animates on hover). */
  hoverColor?: string;
  /** Override base color. Defaults to currentColor (inherits from parent). */
  color?: string;
}

/**
 * Brand mark — the H glyph from the Unicorn Studio design system.
 * SVG paths come straight from the design-system source. Uses `currentColor`
 * by default so it adapts to surrounding theme; pass `color` to force the
 * Hubera blue (#1072F5).
 */
export function UnicornLogo({
  variant = 'mark',
  height = 24,
  className,
  style,
  'aria-label': ariaLabel = 'Unicorn Studio',
  hoverColor,
  color,
}: UnicornLogoProps) {
  const [hovered, setHovered] = useState(false);
  const interactive = Boolean(hoverColor);

  const animatedStyle: CSSProperties = interactive
    ? {
        color: hovered ? hoverColor : color,
        transform: hovered ? 'scale(1.05)' : 'scale(1)',
        transformOrigin: 'center',
        transition:
          'color 220ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      }
    : color
      ? { color }
      : {};

  const handlers = interactive
    ? {
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
        onFocus: () => setHovered(true),
        onBlur: () => setHovered(false),
      }
    : {};

  if (variant === 'mark') {
    return (
      <svg
        height={height}
        viewBox="0 0 520 594"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ display: 'block', ...animatedStyle, ...style }}
        role="img"
        aria-label={ariaLabel}
        tabIndex={interactive ? 0 : undefined}
        {...handlers}
      >
        <path d="M488.14 91.2295V230.203H519.979V358.224L477.896 390.053V459.722L424.082 506.05V593.374H69.4199V396.873L0 356.794V230.406H34.6191V91.418L126.036 0H396.909L488.14 91.2295ZM372.262 96.9375H239.772L212.123 69.2871H137.619V166.062L98.0635 205.618V290.871L179.094 346.17V459.458L233.63 491.332H380.326L421.417 457.537V346.17L447.531 320.057V234.034H365.733V346.17H270.879V313.912H333.091V181.423H447.531V107.306L404.712 64.4873L372.262 96.9375ZM383.047 418.194H231.901V386.798H383.047V418.194ZM282.547 181.551V233.847H142.19V213.108L173.747 181.551H282.547Z" />
      </svg>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(height * 0.45),
        height,
        ...animatedStyle,
        ...style,
      }}
      className={className}
      role="img"
      aria-label={ariaLabel}
      tabIndex={interactive ? 0 : undefined}
      {...handlers}
    >
      <svg
        height={height}
        viewBox="0 0 520 594"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <path d="M488.14 91.2295V230.203H519.979V358.224L477.896 390.053V459.722L424.082 506.05V593.374H69.4199V396.873L0 356.794V230.406H34.6191V91.418L126.036 0H396.909L488.14 91.2295ZM372.262 96.9375H239.772L212.123 69.2871H137.619V166.062L98.0635 205.618V290.871L179.094 346.17V459.458L233.63 491.332H380.326L421.417 457.537V346.17L447.531 320.057V234.034H365.733V346.17H270.879V313.912H333.091V181.423H447.531V107.306L404.712 64.4873L372.262 96.9375ZM383.047 418.194H231.901V386.798H383.047V418.194ZM282.547 181.551V233.847H142.19V213.108L173.747 181.551H282.547Z" />
      </svg>
      <span
        style={{
          fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
          fontWeight: 600,
          fontSize: Math.round(height * 0.62),
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
        }}
      >
        Unicorn Studio
      </span>
    </span>
  );
}
