'use client';

import { Loader2, LogOut, Mail, Moon, Sun, User as UserIcon } from 'lucide-react';
import { useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { AvatarUpload } from '@/components/avatar-upload';
import { useTheme } from '@/components/providers/theme-provider';
import { UserAvatar } from '@/components/user-avatar';
import { updateProfile } from '@/lib/actions/update-profile';
import type { Profile } from '@/lib/db';
import { editorialFonts, getNd } from '@/lib/tokens';

export function ProfileForm({ profile }: { profile: Profile }): ReactNode {
  const { theme, toggle } = useTheme();
  const t = getNd(theme);

  const [name, setName] = useState(profile.name ?? '');
  const flavorInitial: 'designer' | 'non-designer' =
    profile.flavor === 'non-designer' ? 'non-designer' : 'designer';
  const [flavor, setFlavor] = useState<'designer' | 'non-designer'>(flavorInitial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty = name.trim() !== (profile.name ?? '').trim() || flavor !== flavorInitial;
  const isAgency = profile.role === 'agency';

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateProfile({ name: name.trim(), flavor: isAgency ? flavor : null });
      if (res.error) setError(res.error);
      else setSavedAt(Date.now());
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12" style={{ fontFamily: editorialFonts.body }}>
      {/* Header */}
      <div className="mb-8 flex items-center gap-5">
        <UserAvatar
          name={name || profile.email}
          email={profile.email}
          avatarUrl={profile.avatar_url}
          size={72}
          fontSize={24}
          background={t.accent}
          color="white"
        />
        <div>
          <p
            style={{
              fontFamily: editorialFonts.mono,
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: t.textSecondary,
            }}
          >
            Profile
          </p>
          <h1
            style={{
              margin: '4px 0 0',
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: '-0.015em',
              color: t.textDisplay,
            }}
          >
            {name || 'Set your name'}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: t.textSecondary }}>
            {profile.email}
            <span
              style={{
                marginLeft: 10,
                padding: '2px 8px',
                borderRadius: 999,
                background: t.accentSubtle,
                color: t.accent,
                fontFamily: editorialFonts.mono,
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {isAgency ? 'AGENCY' : 'CUSTOMER'}
              {profile.flavor ? ` · ${profile.flavor.toUpperCase()}` : ''}
            </span>
          </p>
        </div>
      </div>

      {/* Avatar upload — separate card so it stands out */}
      <div
        style={{
          padding: 20,
          borderRadius: 12,
          background: t.black,
          border: `1px solid ${t.border}`,
          marginBottom: 16,
        }}
      >
        <AvatarUpload profile={{ ...profile, name: name || profile.name }} />
      </div>

      {/* Edit form */}
      <form
        onSubmit={onSubmit}
        style={{
          padding: 24,
          borderRadius: 12,
          background: t.black,
          border: `1px solid ${t.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 500,
              color: t.textDisplay,
              letterSpacing: '-0.005em',
            }}
          >
            Edit profile
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: t.textSecondary }}>
            What teammates and customers see when you comment.
          </p>
        </div>

        <Field label="FULL NAME" icon={<UserIcon size={11} />} t={t}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Your name"
            style={inputStyle(t)}
          />
        </Field>

        <Field label="EMAIL" icon={<Mail size={11} />} t={t}>
          <input
            type="email"
            value={profile.email}
            disabled
            style={{ ...inputStyle(t), opacity: 0.6, cursor: 'not-allowed' }}
          />
        </Field>

        {isAgency ? <FlavorChooser flavor={flavor} setFlavor={setFlavor} t={t} /> : null}

        {error ? (
          <p style={{ margin: 0, fontSize: 13, color: t.danger }}>{error}</p>
        ) : null}
        {savedAt && !dirty && !error ? (
          <p style={{ margin: 0, fontSize: 13, color: t.success }}>Saved.</p>
        ) : null}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
          <button
            type="submit"
            disabled={pending || !dirty || name.trim().length < 2}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 999,
              border: 'none',
              background: t.accent,
              color: 'white',
              fontFamily: editorialFonts.body,
              fontSize: 14,
              fontWeight: 500,
              cursor: pending || !dirty ? 'not-allowed' : 'pointer',
              opacity: pending || !dirty || name.trim().length < 2 ? 0.5 : 1,
              transition: 'opacity 200ms cubic-bezier(0.165, 0.84, 0.44, 1)',
            }}
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : null}
            Save changes
          </button>
        </div>
      </form>

      {/* Settings — anchored from /profile#settings */}
      <section
        id="settings"
        style={{
          marginTop: 24,
          padding: 24,
          borderRadius: 12,
          background: t.black,
          border: `1px solid ${t.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 500,
              color: t.textDisplay,
              letterSpacing: '-0.005em',
            }}
          >
            Preferences
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: t.textSecondary }}>
            Tweak how the gallery feels for you.
          </p>
        </div>

        <Row
          label="Theme"
          caption="Light or dark — saved on this device."
          t={t}
          right={
            <button
              type="button"
              onClick={toggle}
              style={pillButtonStyle(t)}
            >
              {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          }
        />

        <Row
          label="Sign out"
          caption="Ends your session on this device only."
          t={t}
          right={
            <form action="/auth/sign-out" method="POST" style={{ margin: 0 }}>
              <button type="submit" style={pillButtonStyle(t)}>
                <LogOut size={13} />
                Sign out
              </button>
            </form>
          }
        />
      </section>
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
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: editorialFonts.mono,
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: t.textSecondary,
        }}
      >
        <span style={{ color: t.textDisabled, display: 'inline-flex' }}>{icon}</span>
        {label}
      </span>
      {children}
    </label>
  );
}

function FlavorChooser({
  flavor,
  setFlavor,
  t,
}: {
  flavor: 'designer' | 'non-designer';
  setFlavor: (f: 'designer' | 'non-designer') => void;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  const opts = [
    { key: 'designer' as const, title: 'Designer', caption: 'Designs the apps.' },
    { key: 'non-designer' as const, title: 'Non-designer', caption: 'PM, ops, etc.' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span
        style={{
          fontFamily: editorialFonts.mono,
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: t.textSecondary,
        }}
      >
        I AM A
      </span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {opts.map((o) => {
          const active = flavor === o.key;
          return (
            <button
              type="button"
              key={o.key}
              onClick={() => setFlavor(o.key)}
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
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{o.title}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: t.textSecondary }}>
                {o.caption}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Row({
  label,
  caption,
  right,
  t,
}: {
  label: string;
  caption: string;
  right: ReactNode;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        background: t.surface,
        border: `1px solid ${t.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: t.textDisplay }}>{label}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: t.textSecondary }}>{caption}</p>
      </div>
      {right}
    </div>
  );
}

function inputStyle(t: ReturnType<typeof getNd>) {
  return {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 10,
    border: `1px solid ${t.borderVisible}`,
    background: t.surface,
    fontFamily: editorialFonts.body,
    fontSize: 15,
    color: t.textDisplay,
    outline: 'none',
    transition: 'border-color 200ms ease-out',
    boxSizing: 'border-box' as const,
  };
}

function pillButtonStyle(t: ReturnType<typeof getNd>) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    borderRadius: 999,
    border: `1px solid ${t.borderVisible}`,
    background: t.black,
    color: t.textPrimary,
    fontFamily: editorialFonts.body,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 120ms ease-out',
  };
}
