'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { BrandLogo } from '@/components/brand/brand-logo';
import { useBrand } from '@/components/providers/brand-provider';
import { Eyebrow, Rule } from '@/components/editorial';
import { editorialFonts, getNd } from '@/lib/tokens';

export function ForgotPasswordClient(): ReactNode {
  const { theme } = useTheme();
  const brand = useBrand();
  const t = getNd(theme);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: t.black,
        color: t.textPrimary,
        fontFamily: editorialFonts.body,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          padding: 'clamp(24px, 4vw, 48px)',
        }}
      >
        <Link
          href="/"
          aria-label={`${brand.name} home`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            color: t.textDisplay,
            textDecoration: 'none',
            marginBottom: 'clamp(40px, 8vw, 96px)',
          }}
        >
          <BrandLogo variant="wordmark" height={22} color={t.accent} />
        </Link>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 400 }}>
            {/* Our outgoing mail is blocked, so no reset email is sent. A
                password is reset by whoever set up the account, from the
                admin page or the project's Share dialog. */}
            <Eyebrow>Forgot password</Eyebrow>
            <h1
              style={{
                margin: '12px 0 16px',
                fontFamily: editorialFonts.display,
                fontSize: 'clamp(32px, 4vw, 42px)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                fontWeight: 500,
                color: t.textDisplay,
              }}
            >
              Ask for a new password.
            </h1>
            <p
              style={{
                margin: '0 0 32px',
                fontFamily: editorialFonts.body,
                fontSize: 15,
                lineHeight: 1.55,
                color: t.textSecondary,
              }}
            >
              Passwords are reset by the person who gave you your login. Ask your
              project manager and they will set a new one for you.
            </p>

            <Rule tone="subtle" />

            <p
              style={{
                margin: '16px 0 0',
                fontFamily: editorialFonts.body,
                fontSize: 13,
                color: t.textSecondary,
                textAlign: 'center',
              }}
            >
              <Link
                href="/sign-in"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  color: t.textDisplay,
                  textDecoration: 'none',
                  borderBottom: `1px solid ${t.borderVisible}`,
                }}
              >
                <ArrowLeft size={12} />
                Back to sign in
              </Link>
            </p>
          </div>
        </div>

        <p
          style={{
            margin: 0,
            fontFamily: editorialFonts.mono,
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: t.textDisabled,
            textAlign: 'center',
          }}
        >
          {brand.authFooter}
        </p>
      </div>
    </div>
  );
}
