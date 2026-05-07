/**
 * Design token system — ported from the Unicorn Studio "Hubera" design system.
 * Aesthetic: Linear / Vercel / Mobbin. Cool neutrals, subtle borders,
 * single electric-blue accent (#1072F5), Space Grotesk everywhere.
 */

export const swatchTokens = {
  dark: {
    black: 'oklch(0.145 0.006 260)',
    surface: 'oklch(0.175 0.007 260)',
    surfaceRaised: 'oklch(0.21 0.008 260)',
    surfaceInk: 'oklch(0.125 0.006 260)',
    border: 'oklch(0.24 0.008 260)',
    borderVisible: 'oklch(0.3 0.01 260)',
    borderStrong: 'oklch(0.38 0.012 260)',
    textDisabled: 'oklch(0.42 0.008 260)',
    textSecondary: 'oklch(0.62 0.01 260)',
    textPrimary: 'oklch(0.82 0.012 260)',
    textDisplay: 'oklch(0.97 0.005 260)',
    accent: 'oklch(0.6 0.21 254)',
    accentHover: 'oklch(0.66 0.2 254)',
    accentSoft: 'oklch(0.5 0.18 254)',
    accentSubtle: 'oklch(0.24 0.06 254)',
    accentFg: 'oklch(0.98 0.005 260)',
    success: 'oklch(0.72 0.16 155)',
    warning: 'oklch(0.78 0.15 80)',
    danger: 'oklch(0.64 0.21 25)',
    interactive: 'oklch(0.68 0.18 240)',
  },
  light: {
    black: 'oklch(1 0 0)',
    surface: 'oklch(0.965 0.004 260)',
    surfaceRaised: 'oklch(0.945 0.005 260)',
    surfaceInk: 'oklch(0.92 0.006 260)',
    border: 'oklch(0.9 0.007 260)',
    borderVisible: 'oklch(0.83 0.009 260)',
    borderStrong: 'oklch(0.68 0.011 260)',
    textDisabled: 'oklch(0.68 0.008 260)',
    textSecondary: 'oklch(0.48 0.01 260)',
    textPrimary: 'oklch(0.24 0.01 260)',
    textDisplay: 'oklch(0.15 0.008 260)',
    accent: 'oklch(0.5 0.22 254)',
    accentHover: 'oklch(0.42 0.22 254)',
    accentSoft: 'oklch(0.62 0.18 254)',
    accentSubtle: 'oklch(0.95 0.04 254)',
    accentFg: 'oklch(1 0 0)',
    success: 'oklch(0.58 0.15 155)',
    warning: 'oklch(0.65 0.15 80)',
    danger: 'oklch(0.58 0.2 25)',
    interactive: 'oklch(0.55 0.18 240)',
  },
} as const;

export interface SwatchTheme {
  black: string;
  surface: string;
  surfaceRaised: string;
  surfaceInk: string;
  border: string;
  borderVisible: string;
  borderStrong: string;
  textDisabled: string;
  textSecondary: string;
  textPrimary: string;
  textDisplay: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  accentSubtle: string;
  accentFg: string;
  success: string;
  warning: string;
  danger: string;
  interactive: string;
}

export function getNd(theme: string): SwatchTheme {
  return theme === 'dark' ? swatchTokens.dark : swatchTokens.light;
}

export const editorialFonts = {
  display: 'var(--font-space-grotesk), system-ui, sans-serif',
  body: 'var(--font-space-grotesk), system-ui, sans-serif',
  mono: "var(--font-space-mono), ui-monospace, 'SFMono-Regular', Menlo, monospace",
} as const;

export const swatchRadii = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  full: 9999,
} as const;

export const motion = {
  duration: { instant: '0ms', chrome: '120ms', hero: '220ms', slow: '400ms' },
  easing: {
    out: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    outQuart: 'cubic-bezier(0.165, 0.84, 0.44, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    linear: 'linear',
  },
  transition: {
    chrome: '120ms cubic-bezier(0.2, 0.8, 0.2, 1)',
    hero: '220ms cubic-bezier(0.165, 0.84, 0.44, 1)',
  },
} as const;

export const space = {
  0: 0, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24,
  8: 32, 10: 40, 12: 48, 14: 56, 16: 64, 20: 80, 24: 96,
} as const;

import type { CSSProperties } from 'react';

export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: number;
  letterSpacing: string;
  textTransform?: 'none' | 'uppercase';
}

export const type = {
  display1: { fontFamily: editorialFonts.display, fontSize: 56, lineHeight: 1.05, fontWeight: 500, letterSpacing: '-0.02em' } satisfies TypeStyle,
  display2: { fontFamily: editorialFonts.display, fontSize: 42, lineHeight: 1.1, fontWeight: 500, letterSpacing: '-0.02em' } satisfies TypeStyle,
  display3: { fontFamily: editorialFonts.display, fontSize: 32, lineHeight: 1.15, fontWeight: 500, letterSpacing: '-0.015em' } satisfies TypeStyle,
  display4: { fontFamily: editorialFonts.display, fontSize: 24, lineHeight: 1.2, fontWeight: 500, letterSpacing: '-0.01em' } satisfies TypeStyle,
  display5: { fontFamily: editorialFonts.display, fontSize: 18, lineHeight: 1.3, fontWeight: 600, letterSpacing: '-0.005em' } satisfies TypeStyle,
  bodyLg: { fontFamily: editorialFonts.body, fontSize: 16, lineHeight: 1.55, fontWeight: 400, letterSpacing: '0' } satisfies TypeStyle,
  bodyMd: { fontFamily: editorialFonts.body, fontSize: 14, lineHeight: 1.55, fontWeight: 400, letterSpacing: '0' } satisfies TypeStyle,
  bodySm: { fontFamily: editorialFonts.body, fontSize: 13, lineHeight: 1.5, fontWeight: 400, letterSpacing: '0' } satisfies TypeStyle,
  bodyXs: { fontFamily: editorialFonts.body, fontSize: 12, lineHeight: 1.5, fontWeight: 400, letterSpacing: '0' } satisfies TypeStyle,
  monoMd: { fontFamily: editorialFonts.mono, fontSize: 13, lineHeight: 1.55, fontWeight: 400, letterSpacing: '0' } satisfies TypeStyle,
  monoSm: { fontFamily: editorialFonts.mono, fontSize: 12, lineHeight: 1.5, fontWeight: 400, letterSpacing: '0' } satisfies TypeStyle,
  label: { fontFamily: editorialFonts.mono, fontSize: 11, lineHeight: 1.2, fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase' } satisfies TypeStyle,
  labelSm: { fontFamily: editorialFonts.mono, fontSize: 10, lineHeight: 1.2, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase' } satisfies TypeStyle,
} as const;
export type TypeKey = keyof typeof type;

export function applyType(key: TypeKey): CSSProperties {
  return type[key] as CSSProperties;
}

export const shadow = {
  dark: {
    none: 'none',
    low: '0 1px 0 rgba(255,255,255,0.04) inset, 0 2px 6px rgba(0,0,0,0.22)',
    medium: '0 2px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.36)',
    high: '0 4px 0 rgba(255,255,255,0.04) inset, 0 18px 54px rgba(0,0,0,0.52)',
    focus: '0 0 0 3px oklch(0.6 0.21 254 / 0.35)',
  },
  light: {
    none: 'none',
    low: '0 1px 2px rgba(15,15,20,0.06)',
    medium: '0 1px 0 rgba(255,255,255,0.6) inset, 0 6px 18px rgba(15,15,20,0.08)',
    high: '0 1px 0 rgba(255,255,255,0.8) inset, 0 18px 48px rgba(15,15,20,0.14)',
    focus: '0 0 0 3px oklch(0.5 0.22 254 / 0.25)',
  },
} as const;
export function getShadow(theme: string) {
  return theme === 'dark' ? shadow.dark : shadow.light;
}

export const zLayer = {
  base: 1,
  dropdown: 30,
  nav: 50,
  popover: 60,
  modal: 80,
  toast: 100,
} as const;
