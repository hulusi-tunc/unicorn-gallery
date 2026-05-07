'use client';

import { Loader2, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { UnicornLogo } from '@/components/brand/unicorn-logo';
import { Eyebrow, PrimaryPill, Rule, TextInput } from '@/components/editorial';
import { editorialFonts, getNd } from '@/lib/tokens';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInClient({
  next,
  initialError,
}: {
  next?: string;
  initialError: string | null;
}): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);

  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [sent, setSent] = useState(false);

  const valid = EMAIL_RE.test(email.trim());

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!valid) {
      setError('Please enter a valid email.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const callback = new URL('/auth/callback', window.location.origin);
      if (next) callback.searchParams.set('next', next);
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: callback.toString() },
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
            <Eyebrow>Sign in</Eyebrow>
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
              Welcome back.
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
              Sign in with the email your team or PM invited you with. We&rsquo;ll
              send you a one-time link.
            </p>

            {sent ? (
              <SentNotice email={email} t={t} />
            ) : (
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
                  />
                </div>

                {error ? (
                  <p style={{ fontFamily: editorialFonts.body, fontSize: 13, color: t.danger, margin: 0 }}>
                    {error}
                  </p>
                ) : null}

                <PrimaryPill as="button" type="submit" disabled={!valid || pending} fullWidth>
                  {pending ? <Loader2 size={14} className="animate-spin" /> : null}
                  Send magic link
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
                  New to the agency?{' '}
                  <Link
                    href="/sign-up"
                    style={{
                      color: t.textDisplay,
                      textDecoration: 'none',
                      borderBottom: `1px solid ${t.borderVisible}`,
                    }}
                  >
                    Create an account
                  </Link>
                </p>
              </form>
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
          Unicorn Studio · Internal gallery
        </p>
      </div>
    </div>
  );
}

function SentNotice({ email, t }: { email: string; t: ReturnType<typeof getNd> }): ReactNode {
  return (
    <div
      style={{
        border: `1px solid ${t.border}`,
        background: t.surface,
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <Eyebrow tone="muted">Check your inbox</Eyebrow>
      <p
        style={{
          margin: 0,
          fontFamily: editorialFonts.body,
          fontSize: 14,
          color: t.textPrimary,
        }}
      >
        We sent a magic link to{' '}
        <span style={{ color: t.textDisplay, fontWeight: 500 }}>{email}</span>. Click it to sign in.
      </p>
      <p
        style={{
          margin: 0,
          fontFamily: editorialFonts.body,
          fontSize: 12,
          color: t.textSecondary,
        }}
      >
        Dev tip: if it doesn&rsquo;t arrive, you can sign in directly via{' '}
        <code>/api/dev/sign-in?email={email}</code>.
      </p>
    </div>
  );
}
