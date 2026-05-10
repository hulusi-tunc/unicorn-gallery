'use client';

import { Loader2, Mail, MoreHorizontal, Plus, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/user-avatar';
import { addTeammate, kickUser, setRole } from '@/lib/actions/admin';
import type { Profile } from '@/lib/db';
import { editorialFonts, getNd } from '@/lib/tokens';

const HARDCODED_FOUNDER = 'hulusitunc1@gmail.com';

export function UsersTable({
  profiles,
  currentUserId,
}: {
  profiles: Profile[];
  currentUserId: string;
}): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const [showInvite, setShowInvite] = useState(false);

  const unicorns = profiles.filter((p) => p.role === 'agency');
  const customers = profiles.filter((p) => p.role === 'customer');

  return (
    <div
      className="mx-auto w-full max-w-4xl px-6 py-12"
      style={{ fontFamily: editorialFonts.body }}
    >
      <div className="mb-8 flex items-baseline justify-between">
        <div>
          <p
            className="font-mono text-[11px] uppercase tracking-[0.12em]"
            style={{ color: t.textSecondary }}
          >
            Team
          </p>
          <h1
            className="mt-1 text-3xl"
            style={{
              fontFamily: editorialFonts.display,
              fontWeight: 500,
              letterSpacing: '-0.015em',
              color: t.textDisplay,
            }}
          >
            Team & access
          </h1>
          <p className="mt-1 text-sm" style={{ color: t.textSecondary }}>
            Add Unicorns, remove people who&rsquo;ve left. Customers are invited per-app from the project page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          style={primaryButton(t)}
        >
          <Plus size={14} /> Add Unicorn
        </button>
      </div>

      {showInvite ? (
        <InviteForm t={t} onClose={() => setShowInvite(false)} />
      ) : null}

      <Section title="Unicorns" count={unicorns.length} t={t}>
        {unicorns.map((p) => (
          <Row
            key={p.id}
            profile={p}
            currentUserId={currentUserId}
            t={t}
          />
        ))}
      </Section>

      <Section title="Customers" count={customers.length} t={t}>
        {customers.length === 0 ? (
          <p
            className="px-3 py-4 text-sm"
            style={{ color: t.textSecondary }}
          >
            No customers yet. Customers are invited per-app from the project page.
          </p>
        ) : (
          customers.map((p) => (
            <Row
              key={p.id}
              profile={p}
              currentUserId={currentUserId}
              t={t}
            />
          ))
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  t,
  children,
}: {
  title: string;
  count: number;
  t: ReturnType<typeof getNd>;
  children: ReactNode;
}): ReactNode {
  return (
    <section
      className="mb-8 overflow-hidden rounded-xl border"
      style={{
        background: t.black,
        borderColor: t.border,
      }}
    >
      <div
        className="flex items-baseline justify-between px-5 py-4 border-b"
        style={{ borderColor: t.border }}
      >
        <h2
          style={{
            fontFamily: editorialFonts.display,
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: '-0.005em',
            color: t.textDisplay,
          }}
        >
          {title}
        </h2>
        <span
          style={{
            fontFamily: editorialFonts.mono,
            fontSize: 11,
            color: t.textSecondary,
          }}
        >
          {count}
        </span>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Row({
  profile,
  currentUserId,
  t,
}: {
  profile: Profile;
  currentUserId: string;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isMe = profile.id === currentUserId;
  const isFounder = profile.email === HARDCODED_FOUNDER;
  const display = profile.name?.trim() || profile.email.split('@')[0];

  function run(action: () => Promise<{ ok?: true; error?: string }>): void {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div
      className="flex items-center gap-4 border-b px-5 py-3 last:border-b-0"
      style={{ borderColor: t.border }}
    >
      <UserAvatar
        name={profile.name}
        email={profile.email}
        avatarUrl={profile.avatar_url}
        size={40}
        background={t.accentSubtle}
        color={t.accent}
        border={`1px solid ${t.border}`}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="truncate"
            style={{ fontSize: 14, fontWeight: 500, color: t.textDisplay }}
          >
            {display}
          </span>
          {isFounder ? (
            <span
              style={{
                fontFamily: editorialFonts.mono,
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: t.accentSubtle,
                color: t.accent,
                padding: '2px 6px',
                borderRadius: 999,
              }}
            >
              Founder
            </span>
          ) : null}
          {profile.flavor ? (
            <span
              style={{
                fontFamily: editorialFonts.mono,
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: t.textDisabled,
              }}
            >
              {profile.flavor}
            </span>
          ) : null}
          {isMe ? (
            <span
              style={{
                fontFamily: editorialFonts.mono,
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: t.textDisabled,
              }}
            >
              You
            </span>
          ) : null}
        </div>
        <p
          className="mt-0.5 truncate"
          style={{ fontSize: 12, color: t.textSecondary }}
        >
          {profile.email}
        </p>
        {error ? (
          <p style={{ fontSize: 11, color: t.danger, marginTop: 4 }}>{error}</p>
        ) : null}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={pending || isFounder}
            aria-label="User actions"
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: t.textSecondary,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: pending || isFounder ? 'not-allowed' : 'pointer',
              opacity: pending || isFounder ? 0.4 : 1,
            }}
            title={isFounder ? 'Founder — actions disabled' : 'User actions'}
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <MoreHorizontal size={16} />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6}>
          <DropdownMenuLabel>Tier</DropdownMenuLabel>
          {profile.role === 'customer' ? (
            <DropdownMenuItem
              onSelect={() => run(() => setRole({ profileId: profile.id, role: 'agency' }))}
            >
              <UserPlus size={14} className="mr-2" style={{ color: t.textSecondary }} />
              Make Unicorn
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() => run(() => setRole({ profileId: profile.id, role: 'customer' }))}
            >
              <UserMinus size={14} className="mr-2" style={{ color: t.textSecondary }} />
              Make customer
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              if (isMe) {
                setError('You can\'t kick yourself.');
                return;
              }
              if (
                !confirm(
                  `Kick ${display} (${profile.email})? This deletes their account and any comments they've left.`,
                )
              ) {
                return;
              }
              run(() => kickUser(profile.id));
            }}
            disabled={isMe}
          >
            <Trash2 size={14} className="mr-2" style={{ color: t.danger }} />
            <span style={{ color: t.danger }}>Remove from team</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function InviteForm({
  onClose,
  t,
}: {
  onClose: () => void;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [flavor, setFlavor] = useState<'designer' | 'non-designer'>('designer');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    setError(null);
    setSignedUrl(null);
    startTransition(async () => {
      const res = await addTeammate({
        email,
        name: name || undefined,
        flavor,
      });
      if (res.error) setError(res.error);
      else {
        setSignedUrl(res.signInUrl ?? null);
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-8 flex flex-col gap-4 rounded-xl border p-5"
      style={{
        background: t.black,
        borderColor: t.border,
      }}
    >
      <div className="flex items-baseline justify-between">
        <h2
          style={{
            fontFamily: editorialFonts.display,
            fontSize: 16,
            fontWeight: 500,
            color: t.textDisplay,
          }}
        >
          Add Unicorn
        </h2>
        <button
          type="button"
          onClick={onClose}
          style={{
            fontFamily: editorialFonts.mono,
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            background: 'transparent',
            border: 'none',
            color: t.textSecondary,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>

      <Field label="EMAIL" t={t}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          placeholder="teammate@studio.com"
          style={inputStyle(t)}
        />
      </Field>

      <Field label="NAME (optional)" t={t}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Jane Designer"
          style={inputStyle(t)}
        />
      </Field>

      <Field label="ROLE" t={t}>
        <div className="grid grid-cols-2 gap-2">
          {(['designer', 'non-designer'] as const).map((f) => {
            const active = flavor === f;
            return (
              <button
                type="button"
                key={f}
                onClick={() => setFlavor(f)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${active ? t.borderStrong : t.border}`,
                  background: active ? t.surfaceRaised : t.surface,
                  color: active ? t.textDisplay : t.textPrimary,
                  fontFamily: editorialFonts.body,
                  fontSize: 13,
                  fontWeight: 500,
                  textAlign: 'left',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {f === 'designer' ? 'Designer' : 'Non-designer (PM, ops)'}
              </button>
            );
          })}
        </div>
      </Field>

      {error ? <p style={{ fontSize: 12, color: t.danger }}>{error}</p> : null}
      {signedUrl ? (
        <p style={{ fontSize: 12, color: t.success }}>
          Invited. Dev shortcut:{' '}
          <a href={signedUrl} style={{ color: t.accent, textDecoration: 'underline' }}>
            sign in as them
          </a>
          .
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} style={ghostButton(t)}>
          Close
        </button>
        <button
          type="submit"
          disabled={pending || !email}
          style={{ ...primaryButton(t), opacity: pending || !email ? 0.5 : 1 }}
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
          Send invite
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  t,
  children,
}: {
  label: string;
  t: ReturnType<typeof getNd>;
  children: ReactNode;
}): ReactNode {
  return (
    <label className="flex flex-col gap-2">
      <span
        style={{
          fontFamily: editorialFonts.mono,
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: t.textSecondary,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function inputStyle(t: ReturnType<typeof getNd>) {
  return {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: `1px solid ${t.borderVisible}`,
    background: t.surface,
    fontFamily: editorialFonts.body,
    fontSize: 14,
    color: t.textDisplay,
    outline: 'none',
    boxSizing: 'border-box' as const,
  };
}

function primaryButton(t: ReturnType<typeof getNd>) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 999,
    border: 'none',
    background: t.accent,
    color: 'white',
    fontFamily: editorialFonts.body,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  };
}

function ghostButton(t: ReturnType<typeof getNd>) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 999,
    border: `1px solid ${t.borderVisible}`,
    background: 'transparent',
    color: t.textPrimary,
    fontFamily: editorialFonts.body,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  };
}
