'use client';

import {
  Check,
  Copy,
  Globe,
  Loader2,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Shuffle,
  Share2,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/components/providers/theme-provider';
import { UserAvatar } from '@/components/user-avatar';
import {
  addExistingCustomer,
  inviteCustomer,
  removeCustomer,
  setPublicShareToken,
} from '@/lib/actions/customers';
import type { AppCustomerWithProfile, EligibleCustomer } from '@/lib/queries';
import { editorialFonts, getNd } from '@/lib/tokens';

interface ShareButtonProps {
  appId: string;
  appSlug: string;
  appName: string;
  publicShareToken: string | null;
  customers: AppCustomerWithProfile[];
  eligibleCustomers: EligibleCustomer[];
}

export function ShareButton(props: ShareButtonProps): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Share with customers"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 34,
          padding: '0 14px',
          borderRadius: 999,
          border: `1px solid ${t.borderVisible}`,
          background: t.surface,
          color: t.textPrimary,
          fontFamily: editorialFonts.body,
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background 120ms ease-out',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceRaised; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = t.surface; }}
      >
        <Share2 size={12} /> Share
      </button>
      {open ? <ShareDialog {...props} onClose={() => setOpen(false)} t={t} /> : null}
    </>
  );
}

function ShareDialog({
  appId,
  appSlug,
  appName,
  publicShareToken,
  customers,
  eligibleCustomers,
  onClose,
  t,
}: ShareButtonProps & {
  onClose: () => void;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Render to body to escape the AppHeader's `backdrop-filter` containing
  // block — fixed positioning otherwise gets pinned to the header height.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflow: 'auto',
          background: t.black,
          borderRadius: 16,
          border: `1px solid ${t.border}`,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4)',
          fontFamily: editorialFonts.body,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 22px',
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: editorialFonts.mono,
                fontSize: 11,
                letterSpacing: '0.12em',
                
                color: t.textSecondary,
                margin: 0,
              }}
            >
              Share
            </p>
            <h2
              style={{
                fontFamily: editorialFonts.display,
                fontSize: 18,
                fontWeight: 500,
                color: t.textDisplay,
                margin: '2px 0 0',
              }}
            >
              {appName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: t.textSecondary,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <CustomerList
            appId={appId}
            appSlug={appSlug}
            customers={customers}
            t={t}
          />
          <AddCustomerArea
            appId={appId}
            appSlug={appSlug}
            eligibleCustomers={eligibleCustomers}
            hasCustomers={customers.length > 0}
            t={t}
          />
          <PublicLinkSection
            appId={appId}
            appSlug={appSlug}
            token={publicShareToken}
            t={t}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function InviteSection({
  appId,
  appSlug,
  t,
}: {
  appId: string;
  appSlug: string;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    | {
        email: string;
        password: string;
        signInUrl: string;
        created: boolean;
        passwordUpdated: boolean;
      }
    | null
  >(null);

  const generatePassword = (): void => {
    setPassword(randomPassword());
  };

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await inviteCustomer({
        appId,
        appSlug,
        email,
        password,
        name: name || undefined,
      });
      if (res.error) {
        setError(res.error);
      } else if (res.signInUrl) {
        setResult({
          email,
          password,
          signInUrl: res.signInUrl,
          created: !!res.created,
          passwordUpdated: !!res.passwordUpdated,
        });
        setEmail('');
        setName('');
        setPassword('');
        router.refresh();
      }
    });
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionLabel t={t} icon={<Mail size={11} />}>
        Create new customer
      </SectionLabel>
      <form
        onSubmit={onSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          placeholder="customer@email.com"
          style={inputStyle(t)}
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Name (optional)"
          style={inputStyle(t)}
        />
        <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
          <input
            type="text"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            placeholder="Password (min 8 chars)"
            style={{ ...inputStyle(t), fontFamily: editorialFonts.mono, flex: 1 }}
          />
          <button
            type="button"
            onClick={generatePassword}
            title="Generate random password"
            style={{
              ...ghostButton(t),
              padding: '0 12px',
              minWidth: 44,
              justifyContent: 'center',
            }}
          >
            <Shuffle size={13} />
          </button>
        </div>
        <button
          type="submit"
          disabled={pending || !email || password.length < 8}
          style={{
            ...primaryButton(t),
            opacity: pending || !email || password.length < 8 ? 0.5 : 1,
            justifyContent: 'center',
          }}
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
          {pending ? 'Adding…' : 'Add customer'}
        </button>
      </form>
      {error ? (
        <p style={{ fontSize: 12, color: t.danger, margin: 0 }}>{error}</p>
      ) : null}
      {result ? (
        <CredentialsResult
          email={result.email}
          password={result.password}
          signInUrl={result.signInUrl}
          created={result.created}
          passwordUpdated={result.passwordUpdated}
          onClear={() => setResult(null)}
          t={t}
        />
      ) : null}
    </section>
  );
}

function randomPassword(): string {
  // 12-char URL-safe random — enough entropy for the gallery use case.
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < arr.length; i++) {
    out += alphabet[arr[i]! % alphabet.length];
  }
  return out;
}

function CredentialsResult({
  email,
  password,
  signInUrl,
  created,
  passwordUpdated,
  onClear,
  t,
}: {
  email: string;
  password: string;
  signInUrl: string;
  created: boolean;
  passwordUpdated: boolean;
  onClear: () => void;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  const blob = `URL: ${signInUrl}\nEmail: ${email}\nPassword: ${password}`;
  const note = created
    ? 'Customer created. Share these credentials:'
    : passwordUpdated
      ? 'Customer already had access — password was reset:'
      : 'Customer added.';
  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <p style={{ fontSize: 12, color: t.success, margin: 0 }}>{note}</p>
        <button
          type="button"
          onClick={onClear}
          style={{
            background: 'transparent',
            border: 'none',
            color: t.textSecondary,
            fontSize: 11,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Dismiss
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          rowGap: 4,
          columnGap: 8,
          fontFamily: editorialFonts.mono,
          fontSize: 12,
          color: t.textPrimary,
        }}
      >
        <span style={{ color: t.textSecondary }}>URL</span>
        <span style={{ wordBreak: 'break-all' }}>{signInUrl}</span>
        <span style={{ color: t.textSecondary }}>Email</span>
        <span>{email}</span>
        <span style={{ color: t.textSecondary }}>Password</span>
        <span>{password}</span>
      </div>
      <CopyableLink link={blob} t={t} />
    </div>
  );
}

function CopyableLink({
  link,
  t,
}: {
  link: string;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  const [copied, setCopied] = useState(false);
  const onCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — fallback prompt
      window.prompt('Copy this link:', link);
    }
  };
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        alignItems: 'stretch',
      }}
    >
      <input
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        style={{
          ...inputStyle(t),
          fontFamily: editorialFonts.mono,
          fontSize: 12,
          flex: 1,
        }}
      />
      <button
        type="button"
        onClick={onCopy}
        style={{
          ...ghostButton(t),
          padding: '0 12px',
          minWidth: 90,
          justifyContent: 'center',
        }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/**
 * Collapsed-by-default add-customer affordance. Sits below the "People
 * with access" list and shows two compact trigger buttons; clicking one
 * expands the matching inline form. Keeps the dialog minimal at rest so
 * the existing customer list isn't buried under a wall of inputs.
 */
function AddCustomerArea({
  appId,
  appSlug,
  eligibleCustomers,
  hasCustomers,
  t,
}: {
  appId: string;
  appSlug: string;
  eligibleCustomers: EligibleCustomer[];
  hasCustomers: boolean;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  const [mode, setMode] = useState<'idle' | 'existing' | 'create'>('idle');

  if (mode === 'idle') {
    return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!hasCustomers ? (
          <p
            style={{
              fontSize: 12,
              color: t.textSecondary,
              margin: 0,
              padding: '14px 10px',
              textAlign: 'center',
              border: `1px dashed ${t.border}`,
              borderRadius: 10,
            }}
          >
            No customers yet — add one below.
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setMode('existing')}
            style={triggerButton(t)}
          >
            <UserPlus size={12} />
            Add existing customer
          </button>
          <button
            type="button"
            onClick={() => setMode('create')}
            style={triggerButton(t)}
          >
            <Plus size={12} />
            Create new customer
          </button>
        </div>
      </section>
    );
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {mode === 'existing' ? (
        <ExistingCustomersSection
          appId={appId}
          appSlug={appSlug}
          eligibleCustomers={eligibleCustomers}
          t={t}
        />
      ) : (
        <InviteSection appId={appId} appSlug={appSlug} t={t} />
      )}
      <button
        type="button"
        onClick={() => setMode('idle')}
        style={{
          alignSelf: 'flex-start',
          background: 'transparent',
          border: 'none',
          padding: '2px 0',
          fontFamily: editorialFonts.mono,
          fontSize: 10,
          letterSpacing: '0.08em',
          
          color: t.textSecondary,
          cursor: 'pointer',
        }}
      >
        ← Back
      </button>
    </section>
  );
}

function triggerButton(t: ReturnType<typeof getNd>): CSSProperties {
  return {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 34,
    borderRadius: 10,
    border: `1px dashed ${t.borderVisible}`,
    background: 'transparent',
    color: t.textSecondary,
    fontFamily: editorialFonts.body,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 120ms ease-out, color 120ms ease-out, border-color 120ms ease-out',
  };
}

function ExistingCustomersSection({
  appId,
  appSlug,
  eligibleCustomers,
  t,
}: {
  appId: string;
  appSlug: string;
  eligibleCustomers: EligibleCustomer[];
  t: ReturnType<typeof getNd>;
}): ReactNode {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // Only show customers who aren't already on this app — once added, they
  // appear in the "People with access" list below and don't need to be
  // selectable again.
  const candidates = useMemo(
    () => eligibleCustomers.filter((c) => !c.alreadyOnThisApp),
    [eligibleCustomers],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => {
      const name = c.profile.name?.toLowerCase() ?? '';
      const email = c.profile.email.toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [candidates, query]);

  const onAdd = async (c: EligibleCustomer): Promise<void> => {
    setError(null);
    setPendingId(c.user_id);
    const res = await addExistingCustomer({
      appId,
      appSlug,
      userId: c.user_id,
    });
    setPendingId(null);
    if (res.error) {
      setError(res.error);
    } else {
      setJustAddedId(c.user_id);
      router.refresh();
    }
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionLabel t={t} icon={<UserPlus size={11} />}>
        Existing customers ({candidates.length})
      </SectionLabel>
      <div style={{ position: 'relative' }}>
        <Search
          size={13}
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: t.textSecondary,
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search by name or email"
          style={{ ...inputStyle(t), paddingLeft: 30 }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 10,
          padding: 4,
          maxHeight: 240,
          overflow: 'auto',
        }}
      >
        {filtered.length === 0 ? (
          <p
            style={{
              fontSize: 12,
              color: t.textSecondary,
              margin: 0,
              padding: '12px 10px',
              textAlign: 'center',
            }}
          >
            No matching customers.
          </p>
        ) : (
          filtered.map((c) => {
            const display =
              c.profile.name?.trim() || c.profile.email.split('@')[0] || c.profile.email;
            const pending = pendingId === c.user_id;
            const justAdded = justAddedId === c.user_id;
            const otherAppsLabel =
              c.otherApps.length > 0
                ? `Also on ${c.otherApps
                    .slice(0, 2)
                    .map((a) => a.name)
                    .join(', ')}${c.otherApps.length > 2 ? ` +${c.otherApps.length - 2}` : ''}`
                : null;
            return (
              <div
                key={c.user_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 8,
                }}
              >
                <UserAvatar
                  name={c.profile.name}
                  email={c.profile.email}
                  avatarUrl={c.profile.avatar_url}
                  size={28}
                  background={t.accentSubtle}
                  color={t.accent}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: t.textDisplay,
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {display}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: t.textSecondary,
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.profile.email}
                    {otherAppsLabel ? ` · ${otherAppsLabel}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onAdd(c)}
                  disabled={pending || justAdded}
                  style={{
                    ...ghostButton(t),
                    padding: '6px 10px',
                    fontSize: 12,
                    opacity: pending ? 0.5 : 1,
                    color: justAdded ? t.success : t.textPrimary,
                  }}
                >
                  {pending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : justAdded ? (
                    <Check size={12} />
                  ) : (
                    <Plus size={12} />
                  )}
                  {pending ? 'Adding…' : justAdded ? 'Added' : 'Add'}
                </button>
              </div>
            );
          })
        )}
      </div>
      {error ? (
        <p style={{ fontSize: 12, color: t.danger, margin: 0 }}>{error}</p>
      ) : null}
    </section>
  );
}

function CustomerList({
  appId,
  appSlug,
  customers,
  t,
}: {
  appId: string;
  appSlug: string;
  customers: AppCustomerWithProfile[];
  t: ReturnType<typeof getNd>;
}): ReactNode {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (customers.length === 0) {
    return null;
  }

  const onRemove = async (userId: string, displayName: string): Promise<void> => {
    if (!confirm(`Remove ${displayName} from this app? They won't be able to access it anymore.`)) return;
    setPendingId(userId);
    const res = await removeCustomer({ appId, appSlug, userId });
    setPendingId(null);
    if (res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionLabel t={t}>People with access ({customers.length})</SectionLabel>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 10,
          padding: 4,
        }}
      >
        {customers.map((c) => {
          const display = c.profile.name?.trim() || c.profile.email.split('@')[0] || c.profile.email;
          const pending = pendingId === c.user_id;
          return (
            <div
              key={c.user_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
              }}
            >
              <UserAvatar
                name={c.profile.name}
                email={c.profile.email}
                avatarUrl={c.profile.avatar_url}
                size={28}
                background={t.accentSubtle}
                color={t.accent}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: t.textDisplay,
                    margin: 0,
                  }}
                >
                  {display}
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: t.textSecondary,
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.profile.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(c.user_id, display)}
                disabled={pending}
                aria-label={`Remove ${display}`}
                title="Remove access"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  color: pending ? t.textDisabled : t.textSecondary,
                  cursor: pending ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {pending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PublicLinkSection({
  appId,
  appSlug,
  token,
  t,
}: {
  appId: string;
  appSlug: string;
  token: string | null;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localToken, setLocalToken] = useState<string | null>(token);

  const enabled = !!localToken;
  const url = localToken ? `${getOrigin()}/shared/${localToken}` : null;

  const run = (action: 'enable' | 'rotate' | 'disable'): void => {
    startTransition(async () => {
      const res = await setPublicShareToken({ appId, appSlug, action });
      if (res.error) {
        alert(res.error);
      } else {
        setLocalToken(res.token ?? null);
        router.refresh();
      }
    });
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionLabel t={t} icon={<Globe size={11} />}>
        Public link
      </SectionLabel>
      {!enabled ? (
        <button
          type="button"
          onClick={() => run('enable')}
          disabled={pending}
          style={{
            ...ghostButton(t),
            justifyContent: 'center',
            opacity: pending ? 0.5 : 1,
          }}
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
          {pending ? 'Creating…' : 'Create public link'}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 12, color: t.textSecondary, margin: 0 }}>
            Anyone with this link can view the app read-only — no sign-in needed.
          </p>
          {url ? <CopyableLink link={url} t={t} /> : null}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => run('rotate')}
              disabled={pending}
              style={{
                ...ghostButton(t),
                fontSize: 12,
                padding: '6px 10px',
                opacity: pending ? 0.5 : 1,
              }}
            >
              <RefreshCw size={12} /> Rotate
            </button>
            <button
              type="button"
              onClick={() => run('disable')}
              disabled={pending}
              style={{
                ...ghostButton(t),
                fontSize: 12,
                padding: '6px 10px',
                color: t.danger,
                borderColor: t.border,
                opacity: pending ? 0.5 : 1,
              }}
            >
              <X size={12} /> Disable
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function SectionLabel({
  t,
  icon,
  children,
}: {
  t: ReturnType<typeof getNd>;
  icon?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <p
      style={{
        fontFamily: editorialFonts.mono,
        fontSize: 11,
        letterSpacing: '0.08em',
        
        color: t.textSecondary,
        margin: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {icon ? <span style={{ display: 'inline-flex' }}>{icon}</span> : null}
      {children}
    </p>
  );
}

function inputStyle(t: ReturnType<typeof getNd>) {
  return {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 8,
    border: `1px solid ${t.borderVisible}`,
    background: t.surface,
    fontFamily: editorialFonts.body,
    fontSize: 13,
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
    padding: '9px 14px',
    borderRadius: 8,
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
    padding: '9px 14px',
    borderRadius: 8,
    border: `1px solid ${t.borderVisible}`,
    background: 'transparent',
    color: t.textPrimary,
    fontFamily: editorialFonts.body,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  };
}

function getOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}
