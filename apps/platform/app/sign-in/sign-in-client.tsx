'use client';

import { Loader2, Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const valid = EMAIL_RE.test(email.trim()) && password.length > 0;

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!valid) {
      setError('Email and password are required.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) throw err;
      router.push(next ?? '/apps');
      router.refresh();
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
              Sign in with the email + password your PM gave you, or the
              account you created at sign-up.
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
                  autoFocus={!email}
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  placeholder="you@studio.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
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
                  <Lock size={11} /> Password
                </label>
                <TextInput
                  id="password"
                  type="password"
                  size="lg"
                  autoFocus={!!email}
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Link
                  href="/forgot-password"
                  style={{
                    fontFamily: editorialFonts.body,
                    fontSize: 13,
                    color: t.textSecondary,
                    textDecoration: 'none',
                    borderBottom: `1px solid transparent`,
                    transition: 'border-color 150ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = t.borderVisible; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
                >
                  Forgot password?
                </Link>
              </div>

              {error ? (
                <p style={{ fontFamily: editorialFonts.body, fontSize: 13, color: t.danger, margin: 0 }}>
                  {error}
                </p>
              ) : null}

              <PrimaryPill as="button" type="submit" disabled={!valid || pending} fullWidth>
                {pending ? <Loader2 size={14} className="animate-spin" /> : null}
                Sign in
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

