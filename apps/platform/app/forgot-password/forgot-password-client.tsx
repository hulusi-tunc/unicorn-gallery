'use client';

import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { UnicornLogo } from '@/components/brand/unicorn-logo';
import { Eyebrow, PrimaryPill, Rule, TextInput } from '@/components/editorial';
import { editorialFonts, getNd } from '@/lib/tokens';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordClient(): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);

  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const valid = EMAIL_RE.test(email.trim());

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!valid) {
      setError('Please enter a valid email address.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

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
          aria-label="Unicorn Studio home"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            color: t.textDisplay,
            textDecoration: 'none',
            marginBottom: 'clamp(40px, 8vw, 96px)',
          }}
        >
          <UnicornLogo variant="wordmark" height={22} color={t.accent} />
        </Link>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 400 }}>
            {sent ? (
              <>
                <Eyebrow>Check your inbox</Eyebrow>
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
                  Reset link sent.
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
                  We sent a password reset link to{' '}
                  <strong style={{ color: t.textDisplay }}>{email}</strong>.
                  Click the link in the email to set a new password.
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
                      color: t.textDisplay,
                      textDecoration: 'none',
                      borderBottom: `1px solid ${t.borderVisible}`,
                    }}
                  >
                    Back to sign in
                  </Link>
                </p>
              </>
            ) : (
              <>
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
                  Reset your password.
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
                  Enter the email address associated with your account and
                  we'll send you a link to reset your password.
                </p>

                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label
                      htmlFor="email"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontFamily: editorialFonts.mono,
                        fontSize: 11,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: t.textSecondary,
                        marginBottom: 8,
                      }}
                    >
                      <Mail size={11} /> Email
                    </label>
                    <TextInput
                      id="email"
                      type="email"
                      size="lg"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.currentTarget.value)}
                      placeholder="you@studio.com"
                      autoComplete="email"
                    />
                  </div>

                  {error ? (
                    <p style={{ fontFamily: editorialFonts.body, fontSize: 13, color: t.danger, margin: 0 }}>
                      {error}
                    </p>
                  ) : null}

                  <PrimaryPill as="button" type="submit" disabled={!valid || pending} fullWidth>
                    {pending ? <Loader2 size={14} className="animate-spin" /> : null}
                    Send reset link
                  </PrimaryPill>

                  <Rule tone="subtle" />

                  <p
                    style={{
                      margin: 0,
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
                </form>
              </>
            )}
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
          Unicorn Studio - Internal gallery
        </p>
      </div>
    </div>
  );
}
