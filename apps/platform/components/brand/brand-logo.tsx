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
 * Netygo has no logo mark: its name, set in the app's typeface, is the logo
 * wherever the Unicorn mark or wordmark would go.
 */
function NetygoLogo({ height = 24, className, style }: BrandLogoProps): ReactNode {
  return (
    <span
      className={`text-[#16171a] dark:text-white ${className ?? ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height,
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        fontSize: Math.round(height * 0.82),
        fontWeight: 600,
        letterSpacing: '-0.03em',
        lineHeight: 1,
        ...style,
      }}
    >
      Netygo
    </span>
  );
}
