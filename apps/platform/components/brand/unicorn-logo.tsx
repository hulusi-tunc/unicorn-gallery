'use client';

import { useState, type CSSProperties } from 'react';

interface UnicornLogoProps {
  variant?: 'mark' | 'wordmark';
  height?: number;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
  /** When set, the logo scales up slightly on hover/focus. */
  hoverColor?: string;
  /** Retained for API compatibility — the brand asset carries its own colors. */
  color?: string;
}

/**
 * Brand logo — the holographic Unicorn Studio asset (PNG, theme-aware).
 * Light mode shows the cyan/dark-text variant; dark mode the chrome/white-text
 * variant. The swap is driven by the `.dark` class (set before paint), so it's
 * flash-free and hydration-safe.
 *
 *   `mark`     = icon only (mark-{light,dark}.png)
 *   `wordmark` = full lockup, mark + "Unicorn Studio" baked in (logo-{light,dark}.png)
 *
 * Source masters live in the design Downloads; web copies are downscaled into
 * /public/brand.
 */
const ASSET = {
  mark: { light: '/brand/mark-light.png', dark: '/brand/mark-dark.png', ratio: 799 / 912 },
  wordmark: { light: '/brand/logo-light.png', dark: '/brand/logo-dark.png', ratio: 2664 / 912 },
} as const;

export function UnicornLogo({
  variant = 'mark',
  height = 24,
  className,
  style,
  'aria-label': ariaLabel = 'Unicorn Studio',
  hoverColor,
  color: _color,
}: UnicornLogoProps) {
  void _color;
  const [hovered, setHovered] = useState(false);
  const interactive = Boolean(hoverColor);
  const asset = ASSET[variant];
  const width = Math.round(height * asset.ratio);

  const handlers = interactive
    ? {
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
        onFocus: () => setHovered(true),
        onBlur: () => setHovered(false),
      }
    : {};

  // NB: no `display` here — the `block`/`hidden`/`dark:*` classes control it.
  // An inline `display` would beat the classes (specificity) and show both.
  const imgStyle: CSSProperties = {
    height,
    width,
    objectFit: 'contain',
  };

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height,
        transformOrigin: 'center',
        transform: interactive && hovered ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        ...style,
      }}
      role="img"
      aria-label={ariaLabel}
      tabIndex={interactive ? 0 : undefined}
      {...handlers}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset.light} alt="" aria-hidden className="block dark:hidden" style={{ ...imgStyle, filter: 'brightness(0)' }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset.dark} alt="" aria-hidden className="hidden dark:block" style={imgStyle} />
    </span>
  );
}
