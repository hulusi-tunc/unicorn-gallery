'use client';

import { Loader2, Mail, Shield, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { UnicornLogo } from '@/components/brand/unicorn-logo';
import { Eyebrow, PrimaryPill, Rule, TextInput } from '@/components/editorial';
import { editorialFonts, getNd } from '@/lib/tokens';

export function SignUpClient(): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [flavor, setFlavor] = useState<'designer' | 'non-designer'>('designer');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signInUrl, setSignInUrl] = useState<string | null>(null);

  const formValid =
    name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    code.trim().length > 0;

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/sign-up', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, role: 'agency', flavor, code }),
      });
      const data = (await res.json()) as { error?: string; signInUrl?: string };
      if (!res.ok) throw new Error(data.error ?? 'Sign-up failed.');
      setSignInUrl(data.signInUrl ?? '/sign-in');
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
        display: 'flex',
        flexDirection: 'column',
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
        <div style={{ width: '100%', maxWidth: 420 }}>
          {signInUrl ? (
            <SuccessNotice email={email} signInUrl={signInUrl} t={t} />
          ) : (
            <>
              <Eyebrow>Create account</Eyebrow>
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
                Join the studio.
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
                Designers and PMs sign up here with the agency invite code.
                Customers receive an emailed invite from their PM.
              </p>

              <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Field label="Full name" icon={<UserIcon size={11} />} t={t}>
                  <TextInput
                    type="text"
                    size="lg"
                    value={name}
                    onChange={(e) => setName(e.currentTarget.value)}
                    placeholder="Jane Designer"
                    autoFocus
                  />
                </Field>

                <Field label="Email" icon={<Mail size={11} />} t={t}>
                  <TextInput
                    type="email"
                    size="lg"
                    value={email}
                    onChange={(e) => setEmail(e.currentTarget.value)}
                    placeholder="you@studio.com"
                  />
                </Field>

                <FlavorSelector flavor={flavor} setFlavor={setFlavor} t={t} />

                <Field label="Agency invite code" icon={<Shield size={11} />} t={t}>
                  <TextInput
                    type="text"
                    size="lg"
                    value={code}
                    onChange={(e) => setCode(e.currentTarget.value)}
                    placeholder="(ask your team)"
                  />
                </Field>

                <p
                  style={{
                    margin: 0,
                    padding: 12,
                    fontFamily: editorialFonts.body,
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: t.textSecondary,
                    background: t.surface,
                    border: `1px solid ${t.border}`,
                    borderRadius: 8,
                  }}
                >
                  Are you a customer reviewing your app? You don&rsquo;t sign up
                  here — your PM will email you an invite link. Click that link
                  and you&rsquo;re in.
                </p>

                {error ? (
                  <p style={{ fontFamily: editorialFonts.body, fontSize: 13, color: t.danger, margin: 0 }}>
                    {error}
                  </p>
                ) : null}

                <PrimaryPill
                  as="button"
                  type="submit"
                  disabled={!formValid || pending}
                  fullWidth
                >
                  {pending ? <Loader2 size={14} className="animate-spin" /> : null}
                  Create account
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
                  Already signed up?{' '}
                  <Link
                    href="/sign-in"
                    style={{
                      color: t.textDisplay,
                      textDecoration: 'none',
                      borderBottom: `1px solid ${t.borderVisible}`,
                    }}
                  >
                    Sign in
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
        Unicorn Studio · Internal gallery
      </p>
    </div>
  );
}

function Field({
  label,
  icon,
  t,
  children,
}: {
  label: string;
  icon: ReactNode;
  t: ReturnType<typeof getNd>;
  children: ReactNode;
}): ReactNode {
  return (
    <div>
      <span
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
        <span style={{ display: 'inline-flex', color: t.textDisabled }}>{icon}</span>
        {label}
      </span>
      {children}
    </div>
  );
}

function FlavorSelector({
  flavor,
  setFlavor,
  t,
}: {
  flavor: 'designer' | 'non-designer';
  setFlavor: (f: 'designer' | 'non-designer') => void;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  const options = [
    {
      key: 'designer' as const,
      title: 'Designer',
      caption: 'Designs the apps. Sees everything.',
    },
    {
      key: 'non-designer' as const,
      title: 'Non-designer',
      caption: 'PM, ops, anyone else on the agency team.',
    },
  ];
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <legend
        style={{
          fontFamily: editorialFonts.mono,
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: t.textSecondary,
        }}
      >
        I&rsquo;m a
      </legend>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {options.map((opt) => {
          const active = flavor === opt.key;
          return (
            <button
              type="button"
              key={opt.key}
              onClick={() => setFlavor(opt.key)}
              style={{
                textAlign: 'left',
                padding: 14,
                borderRadius: 10,
                background: active ? t.surfaceRaised : t.surface,
                border: `1px solid ${active ? t.borderStrong : t.border}`,
                cursor: 'pointer',
                fontFamily: editorialFonts.body,
                color: active ? t.textDisplay : t.textPrimary,
                transition: 'background 120ms ease-out, border-color 120ms ease-out',
              }}
            >
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{opt.title}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: t.textSecondary }}>{opt.caption}</p>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function SuccessNotice({
  email,
  signInUrl,
  t,
}: {
  email: string;
  signInUrl: string;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  return (
    <div
      style={{
        border: `1px solid ${t.border}`,
        background: t.surface,
        borderRadius: 12,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <Eyebrow tone="muted">Account created</Eyebrow>
      <h2
        style={{
          margin: 0,
          fontFamily: editorialFonts.display,
          fontSize: 24,
          lineHeight: 1.2,
          fontWeight: 500,
          color: t.textDisplay,
        }}
      >
        Welcome aboard.
      </h2>
      <p
        style={{
          margin: 0,
          fontFamily: editorialFonts.body,
          fontSize: 14,
          lineHeight: 1.55,
          color: t.textPrimary,
        }}
      >
        We provisioned <span style={{ color: t.textDisplay, fontWeight: 500 }}>{email}</span>.
        Click below to sign in directly (dev mode bypasses the email step).
      </p>
      <Link
        href={signInUrl}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 18px',
          background: t.textDisplay,
          color: t.black,
          borderRadius: 999,
          textDecoration: 'none',
          fontFamily: editorialFonts.mono,
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 500,
        }}
      >
        Sign in as {email.split('@')[0]}
      </Link>
    </div>
  );
}
