'use client';

import type { CSSProperties, ReactNode } from 'react';
import { UnicornLogo } from '@/components/brand/unicorn-logo';
import { useBrand } from '@/components/providers/brand-provider';

interface BrandLogoProps {
  variant?: 'mark' | 'wordmark';
  height?: number;
  className?: string;
  style?: CSSProperties;
  hoverColor?: string;
  color?: string;
}

/**
 * The logo of whichever brand this page is served as (see lib/brand.ts).
 * Same props as UnicornLogo, so a call site swaps in without other changes.
 */
export function BrandLogo(props: BrandLogoProps): ReactNode {
  const brand = useBrand();
  if (brand.id === 'netygo') return <NetygoLogo {...props} />;
  return <UnicornLogo {...props} />;
}

/**
 * Netygo's interim logo: a geometric "n" in a rounded square, and the name
 * set in the app's typeface beside it for the wordmark. Drawn inline so it
 * follows the theme; swap for the real asset when Netygo supplies one.
 */
function NetygoLogo({ variant = 'mark', height = 24, className, style }: BrandLogoProps): ReactNode {
  const mark = (
    <svg
      viewBox="0 0 100 100"
      width={height}
      height={height}
      aria-hidden
      className="shrink-0 text-[#16171a] dark:text-white"
    >
      <rect width="100" height="100" rx="22" fill="currentColor" />
      <path
        d="M35 73V43M35 55c0-9 6.5-13 14.5-13S64 46 64 55v18"
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-white dark:stroke-[#16171a]"
      />
    </svg>
  );

  return (
    <span
      role="img"
      aria-label="Netygo"
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: height * 0.36, height, ...style }}
    >
      {mark}
      {variant === 'wordmark' ? (
        <span
          aria-hidden
          className="text-[#16171a] dark:text-white"
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: height * 0.82,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}
        >
          Netygo
        </span>
      ) : null}
    </span>
  );
}
