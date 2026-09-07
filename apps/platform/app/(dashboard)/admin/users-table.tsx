'use client';

import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition, type CSSProperties, type FormEvent, type ReactNode } from 'react';
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
import { addTeammate, createAccount, kickUser, setRole, updateAccount } from '@/lib/actions/admin';
import type { Profile, Role } from '@/lib/db';
import { editorialFonts, getNd } from '@/lib/tokens';

const HARDCODED_FOUNDER = 'hulusitunc1@gmail.com';
const MIN_PASSWORD = 8;

type Flavor = 'designer' | 'non-designer';
type Tokens = ReturnType<typeof getNd>;

export function UsersTable({
  profiles,
  currentUserId,
  currentUserEmail,
}: {
  profiles: Profile[];
  currentUserId: string;
  currentUserEmail: string;
}): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const [panel, setPanel] = useState<'none' | 'create' | 'invite'>('none');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const iAmFounder = currentUserEmail.toLowerCase() === HARDCODED_FOUNDER;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        p.email.toLowerCase().includes(q) ||
        (p.name ?? '').toLowerCase().includes(q),
    );
  }, [profiles, query]);

  const unicorns = filtered.filter((p) => p.role === 'agency');
  const customers = filtered.filter((p) => p.role === 'customer');

  function renderRow(p: Profile): ReactNode {
    return (
      <Row
        key={p.id}
        profile={p}
        currentUserId={currentUserId}
        iAmFounder={iAmFounder}
        isEditing={editingId === p.id}
        onEdit={() => {
          setEditingId(p.id);
          setPanel('none');
        }}
        onCloseEdit={() => setEditingId(null)}
        t={t}
      />
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-4xl px-6 py-12"
      style={{ fontFamily: editorialFonts.body }}
    >
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
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
            Accounts &amp; access
          </h1>
          <p className="mt-1 text-sm" style={{ color: t.textSecondary }}>
            Create accounts with an email and password, edit anyone&rsquo;s login details,
            or remove people who&rsquo;ve left.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPanel(panel === 'invite' ? 'none' : 'invite');
              setEditingId(null);
            }}
            style={ghostButton(t)}
          >
            <Mail size={14} /> Invite by email
          </button>
          <button
            type="button"
            onClick={() => {
              setPanel(panel === 'create' ? 'none' : 'create');
              setEditingId(null);
            }}
            style={primaryButton(t)}
          >
            <Plus size={14} /> New account
          </button>
        </div>
      </div>

      {panel === 'create' ? <CreateForm t={t} onClose={() => setPanel('none')} /> : null}
      {panel === 'invite' ? <InviteForm t={t} onClose={() => setPanel('none')} /> : null}

      <div
        className="mb-6 flex items-center gap-2 rounded-xl border px-3.5 py-2.5"
        style={{ background: t.black, borderColor: t.border }}
      >
        <Search size={14} style={{ color: t.textSecondary, flexShrink: 0 }} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search by name or email"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: editorialFonts.body,
            fontSize: 14,
            color: t.textDisplay,
          }}
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            style={{
              border: 'none',
              background: 'transparent',
              color: t.textSecondary,
              cursor: 'pointer',
              display: 'inline-flex',
            }}
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      <Section title="Unicorns" count={unicorns.length} t={t}>
        {unicorns.length === 0 ? (
          <Empty t={t}>No Unicorns match &ldquo;{query}&rdquo;.</Empty>
        ) : (
          unicorns.map(renderRow)
        )}
      </Section>

      <Section title="Customers" count={customers.length} t={t}>
        {customers.length === 0 ? (
          <Empty t={t}>
            {query
              ? `No customers match “${query}”.`
              : 'No customers yet. Create one above, or invite them per-app from the project page.'}
          </Empty>
        ) : (
          customers.map(renderRow)
        )}
      </Section>
    </div>
  );
}

function Empty({ t, children }: { t: Tokens; children: ReactNode }): ReactNode {
  return (
    <p className="px-5 py-4 text-sm" style={{ color: t.textSecondary }}>
      {children}
    </p>
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
  t: Tokens;
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
  iAmFounder,
  isEditing,
  onEdit,
  onCloseEdit,
  t,
}: {
  profile: Profile;
  currentUserId: string;
  iAmFounder: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCloseEdit: () => void;
  t: Tokens;
}): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isMe = profile.id === currentUserId;
  const isFounder = profile.email.toLowerCase() === HARDCODED_FOUNDER;
  const display = profile.name?.trim() || profile.email.split('@')[0];
  // Anyone but the founder could otherwise rotate the owner's password and
  // lock them out — the server action enforces this too.
  const canEditCredentials = !isFounder || iAmFounder;

  function run(action: () => Promise<{ ok?: true; error?: string }>): void {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: t.border }}>
      <div className="flex items-center gap-4 px-5 py-3">
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
            {isFounder ? <Tag t={t} tone="accent">Founder</Tag> : null}
            {profile.role === 'agency' && profile.flavor ? <Tag t={t}>{profile.flavor}</Tag> : null}
            {isMe ? <Tag t={t}>You</Tag> : null}
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

        <button
          type="button"
          onClick={isEditing ? onCloseEdit : onEdit}
          aria-label={isEditing ? 'Close editor' : 'Edit account'}
          title={isEditing ? 'Close editor' : 'Edit account'}
          style={iconButton(t, isEditing)}
        >
          {isEditing ? <X size={15} /> : <Pencil size={15} />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={pending}
              aria-label="User actions"
              style={{ ...iconButton(t, false), opacity: pending ? 0.4 : 1 }}
            >
              {pending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <MoreHorizontal size={16} />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6}>
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuItem onSelect={onEdit} disabled={!canEditCredentials}>
              <Pencil size={14} className="mr-2" style={{ color: t.textSecondary }} />
              Edit email &amp; password
            </DropdownMenuItem>

            <DropdownMenuSeparator />
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
                disabled={isFounder || isMe}
                onSelect={() => {
                  if (isFounder) {
                    setError('Cannot change the founder\'s role.');
                    return;
                  }
                  if (isMe) {
                    setError('You can\'t demote yourself — ask another Unicorn.');
                    return;
                  }
                  run(() => setRole({ profileId: profile.id, role: 'customer' }));
                }}
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
                if (isFounder) {
                  setError('Cannot remove the founder.');
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
              disabled={isMe || isFounder}
            >
              <Trash2 size={14} className="mr-2" style={{ color: t.danger }} />
              <span style={{ color: t.danger }}>Remove from team</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isEditing ? (
        <EditForm
          profile={profile}
          canEditCredentials={canEditCredentials}
          tierLocked={isFounder || isMe}
          onClose={onCloseEdit}
          t={t}
        />
      ) : null}
    </div>
  );
}

function EditForm({
  profile,
  canEditCredentials,
  tierLocked,
  onClose,
  t,
}: {
  profile: Profile;
  canEditCredentials: boolean;
  /** Founder, or yourself — demoting either locks someone out of /admin. */
  tierLocked: boolean;
  onClose: () => void;
  t: Tokens;
}): ReactNode {
  const router = useRouter();
  const [email, setEmail] = useState(profile.email);
  const [password, setPassword] = useState('');
  const [name, setName] = useState(profile.name ?? '');
  const [role, setRoleValue] = useState<Role>(profile.role);
  const [flavor, setFlavor] = useState<Flavor>(
    profile.flavor === 'non-designer' ? 'non-designer' : 'designer',
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const emailChanged = email.trim().toLowerCase() !== profile.email.toLowerCase();
  const dirty =
    emailChanged ||
    password.length > 0 ||
    name.trim() !== (profile.name ?? '').trim() ||
    role !== profile.role ||
    (role === 'agency' &&
      flavor !== (profile.flavor === 'non-designer' ? 'non-designer' : 'designer'));

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    setError(null);
    setDone(null);
    if (password && password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    startTransition(async () => {
      const res = await updateAccount({
        profileId: profile.id,
        ...(emailChanged ? { email: email.trim() } : {}),
        ...(password ? { password } : {}),
        name,
        role,
        flavor,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      const bits = [
        res.emailChanged ? 'sign-in email' : null,
        res.passwordChanged ? 'password' : null,
      ].filter(Boolean);
      setDone(bits.length > 0 ? `Saved — new ${bits.join(' and ')} in effect.` : 'Saved.');
      setPassword('');
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 border-t px-5 py-5"
      style={{ borderColor: t.border, background: t.surface }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="LOGIN EMAIL" t={t}>
          <input
            type="email"
            value={email}
            disabled={!canEditCredentials}
            onChange={(e) => setEmail(e.currentTarget.value)}
            style={inputStyle(t, !canEditCredentials)}
          />
        </Field>

        <Field label="NEW PASSWORD" hint="Leave blank to keep the current one" t={t}>
          <PasswordInput
            value={password}
            onChange={setPassword}
            disabled={!canEditCredentials}
            placeholder="Unchanged"
            t={t}
          />
        </Field>

        <Field label="NAME" t={t}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Jane Designer"
            style={inputStyle(t)}
          />
        </Field>

        <Field label="TIER" t={t}>
          <Segmented
            value={role}
            onChange={setRoleValue}
            disabled={tierLocked}
            options={[
              { value: 'agency', label: 'Unicorn' },
              { value: 'customer', label: 'Customer' },
            ]}
            t={t}
          />
        </Field>
      </div>

      {role === 'agency' ? (
        <Field label="LABEL" t={t}>
          <Segmented
            value={flavor}
            onChange={setFlavor}
            options={[
              { value: 'designer', label: 'Designer' },
              { value: 'non-designer', label: 'Non-designer (PM, ops)' },
            ]}
            t={t}
          />
        </Field>
      ) : null}

      {!canEditCredentials ? (
        <p style={{ fontSize: 12, color: t.textSecondary }}>
          Only the founder can change the founder&rsquo;s email or password.
        </p>
      ) : null}
      {error ? <p style={{ fontSize: 12, color: t.danger }}>{error}</p> : null}
      {done ? <p style={{ fontSize: 12, color: t.success }}>{done}</p> : null}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} style={ghostButton(t)}>
          Close
        </button>
        <button
          type="submit"
          disabled={pending || !dirty}
          style={{ ...primaryButton(t), opacity: pending || !dirty ? 0.5 : 1 }}
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Save changes
        </button>
      </div>
    </form>
  );
}

function CreateForm({ onClose, t }: { onClose: () => void; t: Tokens }): ReactNode {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRoleValue] = useState<Role>('agency');
  const [flavor, setFlavor] = useState<Flavor>('designer');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string; url: string } | null>(
    null,
  );

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    startTransition(async () => {
      const res = await createAccount({
        email,
        password,
        name: name || undefined,
        role,
        flavor,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setCreated({
        email: email.trim().toLowerCase(),
        password,
        url: res.signInUrl ?? '/sign-in',
      });
      setEmail('');
      setPassword('');
      setName('');
      router.refresh();
    });
  }

  if (created) {
    return (
      <Panel t={t}>
        <PanelHeader title="Account created" onClose={onClose} t={t} />
        <p style={{ fontSize: 13, color: t.textSecondary }}>
          No email was sent — hand these credentials over directly. This password
          is shown once.
        </p>
        <Credentials email={created.email} password={created.password} url={created.url} t={t} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setCreated(null)} style={ghostButton(t)}>
            Create another
          </button>
          <button type="button" onClick={onClose} style={primaryButton(t)}>
            Done
          </button>
        </div>
      </Panel>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <Panel t={t}>
        <PanelHeader title="New account" onClose={onClose} t={t} />

        <div className="grid gap-4 sm:grid-cols-2">
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

          <Field label="PASSWORD" hint={`At least ${MIN_PASSWORD} characters`} t={t}>
            <PasswordInput value={password} onChange={setPassword} t={t} />
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

          <Field label="TIER" t={t}>
            <Segmented
              value={role}
              onChange={setRoleValue}
              options={[
                { value: 'agency', label: 'Unicorn' },
                { value: 'customer', label: 'Customer' },
              ]}
              t={t}
            />
          </Field>
        </div>

        {role === 'agency' ? (
          <Field label="LABEL" t={t}>
            <Segmented
              value={flavor}
              onChange={setFlavor}
              options={[
                { value: 'designer', label: 'Designer' },
                { value: 'non-designer', label: 'Non-designer (PM, ops)' },
              ]}
              t={t}
            />
          </Field>
        ) : null}

        {role === 'customer' ? (
          <p style={{ fontSize: 12, color: t.textSecondary }}>
            Customers only see projects they&rsquo;re added to — add them from the
            project page once the account exists.
          </p>
        ) : null}

        {error ? <p style={{ fontSize: 12, color: t.danger }}>{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} style={ghostButton(t)}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || !email || !password}
            style={{
              ...primaryButton(t),
              opacity: pending || !email || !password ? 0.5 : 1,
            }}
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create account
          </button>
        </div>
      </Panel>
    </form>
  );
}

function Credentials({
  email,
  password,
  url,
  t,
}: {
  email: string;
  password: string;
  url: string;
  t: Tokens;
}): ReactNode {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(
        `Sign in: ${url}\nEmail: ${email}\nPassword: ${password}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border p-4"
      style={{ borderColor: t.borderVisible, background: t.surface }}
    >
      <CredLine label="Email" value={email} t={t} />
      <CredLine label="Password" value={password} t={t} />
      <CredLine label="Sign in" value={url} t={t} />
      <button type="button" onClick={copy} style={{ ...ghostButton(t), alignSelf: 'flex-start' }}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? 'Copied' : 'Copy credentials'}
      </button>
    </div>
  );
}

function CredLine({ label, value, t }: { label: string; value: string; t: Tokens }): ReactNode {
  return (
    <div className="flex items-baseline gap-3">
      <span
        style={{
          fontFamily: editorialFonts.mono,
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: t.textSecondary,
          width: 72,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        className="min-w-0 break-all"
        style={{ fontFamily: editorialFonts.mono, fontSize: 12, color: t.textDisplay }}
      >
        {value}
      </span>
    </div>
  );
}

function InviteForm({ onClose, t }: { onClose: () => void; t: Tokens }): ReactNode {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [flavor, setFlavor] = useState<Flavor>('designer');
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
    <form onSubmit={onSubmit}>
      <Panel t={t}>
        <PanelHeader title="Invite a Unicorn by email" onClose={onClose} t={t} />
        <p style={{ fontSize: 13, color: t.textSecondary }}>
          Sends Supabase&rsquo;s invite email — they pick their own password. Use
          &ldquo;New account&rdquo; instead if you want to set one yourself.
        </p>

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

        <Field label="LABEL" t={t}>
          <Segmented
            value={flavor}
            onChange={setFlavor}
            options={[
              { value: 'designer', label: 'Designer' },
              { value: 'non-designer', label: 'Non-designer (PM, ops)' },
            ]}
            t={t}
          />
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
      </Panel>
    </form>
  );
}

function Panel({ t, children }: { t: Tokens; children: ReactNode }): ReactNode {
  return (
    <div
      className="mb-6 flex flex-col gap-4 rounded-xl border p-5"
      style={{ background: t.black, borderColor: t.border }}
    >
      {children}
    </div>
  );
}

function PanelHeader({
  title,
  onClose,
  t,
}: {
  title: string;
  onClose: () => void;
  t: Tokens;
}): ReactNode {
  return (
    <div className="flex items-baseline justify-between">
      <h2
        style={{
          fontFamily: editorialFonts.display,
          fontSize: 16,
          fontWeight: 500,
          color: t.textDisplay,
        }}
      >
        {title}
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        title="Close"
        style={iconButton(t, false)}
      >
        <X size={15} />
      </button>
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  disabled,
  placeholder,
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  t: Tokens;
}): ReactNode {
  const [reveal, setReveal] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <input
        type={reveal ? 'text' : 'password'}
        value={value}
        disabled={disabled}
        autoComplete="new-password"
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder={placeholder}
        style={{
          ...inputStyle(t, disabled),
          fontFamily: value ? editorialFonts.mono : editorialFonts.body,
          letterSpacing: value && reveal ? '0.02em' : undefined,
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setReveal((v) => !v)}
        aria-label={reveal ? 'Hide password' : 'Show password'}
        title={reveal ? 'Hide password' : 'Show password'}
        style={iconButton(t, reveal)}
      >
        <KeyRound size={15} />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          onChange(generatePassword());
          setReveal(true);
        }}
        aria-label="Generate a password"
        title="Generate a password"
        style={iconButton(t, false)}
      >
        <RefreshCw size={15} />
      </button>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  disabled,
  t,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  disabled?: boolean;
  t: Tokens;
}): ReactNode {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            type="button"
            key={o.value}
            disabled={disabled}
            onClick={() => onChange(o.value)}
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
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Tag({
  t,
  tone,
  children,
}: {
  t: Tokens;
  tone?: 'accent';
  children: ReactNode;
}): ReactNode {
  return (
    <span
      style={{
        fontFamily: editorialFonts.mono,
        fontSize: 9,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        background: tone === 'accent' ? t.accentSubtle : 'transparent',
        color: tone === 'accent' ? t.accent : t.textDisabled,
        padding: tone === 'accent' ? '2px 6px' : 0,
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function Field({
  label,
  hint,
  t,
  children,
}: {
  label: string;
  hint?: string;
  t: Tokens;
  children: ReactNode;
}): ReactNode {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline gap-2">
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
        {hint ? (
          <span style={{ fontSize: 11, color: t.textDisabled }}>{hint}</span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

/** Cryptographically random, ambiguity-free password for handing over. */
function generatePassword(length = 16): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_@#';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) {
    out += alphabet[b % alphabet.length] ?? 'x';
  }
  return out;
}

function inputStyle(t: Tokens, disabled?: boolean): CSSProperties {
  return {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: `1px solid ${t.borderVisible}`,
    background: disabled ? t.surfaceRaised : t.surface,
    fontFamily: editorialFonts.body,
    fontSize: 14,
    color: disabled ? t.textSecondary : t.textDisplay,
    outline: 'none',
    boxSizing: 'border-box',
    cursor: disabled ? 'not-allowed' : 'text',
  };
}

function iconButton(t: Tokens, active: boolean): CSSProperties {
  return {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: 6,
    border: `1px solid ${active ? t.borderVisible : 'transparent'}`,
    background: active ? t.surfaceRaised : 'transparent',
    color: t.textSecondary,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  };
}

function primaryButton(t: Tokens): CSSProperties {
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

function ghostButton(t: Tokens): CSSProperties {
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
