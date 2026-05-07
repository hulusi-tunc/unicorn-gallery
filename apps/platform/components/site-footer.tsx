'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { Eyebrow, Rule } from '@/components/editorial';
import { UnicornLogo } from '@/components/brand/unicorn-logo';
import { editorialFonts, getNd } from '@/lib/tokens';

export function SiteFooter(): ReactNode {
  const { theme, toggle } = useTheme();
  const t = getNd(theme);

  const columnLinkStyle: CSSProperties = {
    fontFamily: editorialFonts.body,
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.8,
    color: t.textPrimary,
    textDecoration: 'none',
    transition: 'color 200ms cubic-bezier(0.165, 0.84, 0.44, 1)',
  };

  return (
    <footer
      style={{
        borderTop: `1px solid ${t.border}`,
        padding:
          'clamp(56px, 7vw, 96px) clamp(24px, 5vw, 72px) clamp(32px, 3vw, 48px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(40px, 5vw, 72px)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: 32,
          alignItems: 'start',
        }}
      >
        <div
          style={{
            gridColumn: 'span 5',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
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
            }}
          >
            <UnicornLogo variant="wordmark" height={24} />
          </Link>
          <p
            style={{
              margin: 0,
              maxWidth: '36ch',
              fontFamily: editorialFonts.body,
              fontSize: 14,
              lineHeight: 1.55,
              color: t.textSecondary,
            }}
          >
            Internal Mobbin-style gallery for the apps Unicorn Studio
            ships for its customers. Replaces Figma as the design-review
            deliverable.
          </p>
        </div>

        <FooterColumn
          label="Product"
          links={[
            { href: '/', label: 'Apps' },
            { href: '/admin', label: 'Admin' },
          ]}
          style={{ gridColumn: 'span 2' }}
          linkStyle={columnLinkStyle}
        />

        <FooterColumn
          label="Account"
          links={[
            { href: '/sign-in', label: 'Sign in' },
            { href: '/sign-up', label: 'Sign up' },
          ]}
          style={{ gridColumn: 'span 2' }}
          linkStyle={columnLinkStyle}
        />

        <FooterColumn
          label="For developers"
          links={[
            { href: '#', label: 'Capture CLI' },
            { href: '#', label: 'API docs' },
          ]}
          style={{ gridColumn: 'span 3' }}
          linkStyle={columnLinkStyle}
        />
      </div>

      <Rule tone="subtle" />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <Eyebrow tone="muted">
          © {new Date().getFullYear()} Unicorn Studio · Internal tool
        </Eyebrow>

        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle theme"
          style={{
            fontFamily: editorialFonts.mono,
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            background: 'transparent',
            border: `1px solid ${t.border}`,
            borderRadius: 999,
            padding: '8px 14px',
            cursor: 'pointer',
            color: t.textSecondary,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            transition:
              'color 200ms cubic-bezier(0.165, 0.84, 0.44, 1), border-color 200ms cubic-bezier(0.165, 0.84, 0.44, 1)',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: t.textDisplay,
            }}
          />
          <span suppressHydrationWarning>
            {theme === 'dark' ? 'Dark' : 'Light'} · switch
          </span>
        </button>
      </div>
    </footer>
  );
}

function FooterColumn({
  label,
  links,
  style,
  linkStyle,
}: {
  label: string;
  links: { href: string; label: string }[];
  style?: CSSProperties;
  linkStyle: CSSProperties;
}): ReactNode {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, ...style }}>
      <Eyebrow>{label}</Eyebrow>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link href={link.href} style={linkStyle}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
