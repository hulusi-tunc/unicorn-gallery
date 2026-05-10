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
 * Brand mark — Prisma triangle (the shared mark used across desktop Capture
 * + this gallery). Uses `currentColor` by default so it adapts to the
 * surrounding theme; pass `color` to force the Hubera blue.
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
        viewBox="0 0 512 429"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ display: 'block', ...animatedStyle, ...style }}
        role="img"
        aria-label={ariaLabel}
        tabIndex={interactive ? 0 : undefined}
        {...handlers}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M255.254 0L0 429H512L255.254 0ZM255.254 279.523V86.6969L83.5918 379.672L255.254 279.523Z"
        />
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
        viewBox="0 0 512 429"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M255.254 0L0 429H512L255.254 0ZM255.254 279.523V86.6969L83.5918 379.672L255.254 279.523Z"
        />
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
