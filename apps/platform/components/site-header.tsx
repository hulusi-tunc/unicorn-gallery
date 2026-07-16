'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { UnicornLogo } from '@/components/brand/unicorn-logo';
import { editorialFonts, getNd } from '@/lib/tokens';

const NAV_LINKS = [
  { href: '/apps', label: 'Apps' },
  { href: '/admin', label: 'Admin' },
] as const;

/**
 * SiteHeader — floating pill nav, ported from Hubera. Shows on the marketing
 * landing and any unauthenticated page.
 */
export function SiteHeader({ active, signedIn }: { active?: string; signedIn?: boolean }): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);

  const monoLabel: React.CSSProperties = {
    fontFamily: editorialFonts.mono,
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 400,
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <nav
        style={{
          pointerEvents: 'auto',
          marginTop: 14,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 6px 6px 16px',
          borderRadius: 999,
          border: `1px solid ${t.borderVisible}`,
          background:
            theme === 'dark' ? 'rgba(22, 22, 26, 0.68)' : 'rgba(255, 255, 255, 0.72)',
          backdropFilter: 'blur(20px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
          boxShadow:
            theme === 'dark'
              ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.32)'
              : '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(15,15,20,0.08)',
        }}
      >
        <Link
          href="/"
          aria-label="Unicorn Studio home"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            color: t.textDisplay,
            textDecoration: 'none',
            lineHeight: 0,
            paddingRight: 4,
          }}
        >
          <UnicornLogo variant="wordmark" height={20} color={t.accent} />
        </Link>

        {signedIn
          ? NAV_LINKS.map((link) => {
              const isActive = active === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    ...monoLabel,
                    padding: '6px 10px',
                    color: isActive ? t.textDisplay : t.textSecondary,
                    textDecoration: 'none',
                    transition: 'color 240ms cubic-bezier(0.165, 0.84, 0.44, 1)',
                  }}
                >
                  {link.label}
                </Link>
              );
            })
          : null}

        <Link
          href={signedIn ? '/auth/sign-out' : '/sign-in'}
          style={{
            ...monoLabel,
            fontWeight: 500,
            color: t.black,
            background: t.textDisplay,
            padding: '8px 16px',
            marginLeft: 6,
            borderRadius: 999,
            textDecoration: 'none',
            transition: 'opacity 240ms cubic-bezier(0.165, 0.84, 0.44, 1)',
          }}
        >
          {signedIn ? 'Sign out' : 'Sign in'}
        </Link>
      </nav>
    </div>
  );
}
