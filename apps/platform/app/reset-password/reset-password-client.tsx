'use client';

import { Loader2, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { UnicornLogo } from '@/components/brand/unicorn-logo';
import { Eyebrow, PrimaryPill, Rule, TextInput } from '@/components/editorial';
import { editorialFonts, getNd } from '@/lib/tokens';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export function ResetPasswordClient(): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const valid = password.length >= 8 && password === confirm;

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
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
            {done ? (
              <>
                <Eyebrow>All set</Eyebrow>
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
                  Password updated.
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
                  Your password has been changed. You can now sign in with your
                  new password.
                </p>

                <PrimaryPill as="link" href="/apps" fullWidth>
                  Go to dashboard
                </PrimaryPill>
              </>
            ) : (
              <>
                <Eyebrow>Reset password</Eyebrow>
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
                  Set a new password.
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
                  Choose a new password for your account. Must be at least 8
                  characters.
                </p>

                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                      <Lock size={11} /> New password
                    </label>
                    <TextInput
                      id="password"
                      type="password"
                      size="lg"
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.currentTarget.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="confirm"
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
                      <Lock size={11} /> Confirm password
                    </label>
                    <TextInput
                      id="confirm"
                      type="password"
                      size="lg"
                      value={confirm}
                      onChange={(e) => setConfirm(e.currentTarget.value)}
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                    />
                  </div>

                  {error ? (
                    <p style={{ fontFamily: editorialFonts.body, fontSize: 13, color: t.danger, margin: 0 }}>
                      {error}
                    </p>
                  ) : null}

                  <PrimaryPill as="button" type="submit" disabled={!valid || pending} fullWidth>
                    {pending ? <Loader2 size={14} className="animate-spin" /> : null}
                    Update password
                  </PrimaryPill>
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
