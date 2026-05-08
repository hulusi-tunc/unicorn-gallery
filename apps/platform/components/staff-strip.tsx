'use client';

import { Pencil } from 'lucide-react';
import { useState, useTransition, type ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { assignStaff } from '@/lib/actions/assign-staff';
import type { AppRowWithStaff, ProfileLite } from '@/lib/db';
import { editorialFonts, getNd } from '@/lib/tokens';

type Field = 'designer_id' | 'pm_id';

export function StaffStrip({
  app,
  agencyProfiles,
  canEdit,
}: {
  app: AppRowWithStaff;
  agencyProfiles: ProfileLite[];
  canEdit: boolean;
}): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        padding: '10px 24px',
        borderBottom: `1px solid ${t.border}`,
        background: t.surface,
        fontFamily: editorialFonts.body,
      }}
    >
      <Slot
        appId={app.id}
        appSlug={app.slug}
        field="designer_id"
        label="Designer"
        person={app.designer}
        agencyProfiles={agencyProfiles}
        canEdit={canEdit}
        t={t}
      />
      <span style={{ width: 1, height: 18, background: t.border }} aria-hidden />
      <Slot
        appId={app.id}
        appSlug={app.slug}
        field="pm_id"
        label="PM"
        person={app.pm}
        agencyProfiles={agencyProfiles}
        canEdit={canEdit}
        t={t}
      />
    </div>
  );
}

function Slot({
  appId,
  appSlug,
  field,
  label,
  person,
  agencyProfiles,
  canEdit,
  t,
}: {
  appId: string;
  appSlug: string;
  field: Field;
  label: string;
  person: ProfileLite | null;
  agencyProfiles: ProfileLite[];
  canEdit: boolean;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const display = person ? person.name ?? person.email : null;
  const initials =
    display
      ?.split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? '··';

  function onChange(profileId: string): void {
    setError(null);
    startTransition(async () => {
      const res = await assignStaff({ appId, appSlug, field, profileId: profileId || null });
      if (res.error) setError(res.error);
      setEditing(false);
    });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          fontFamily: editorialFonts.mono,
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: t.textSecondary,
        }}
      >
        {label}
      </span>

      {editing && canEdit ? (
        <select
          autoFocus
          disabled={pending}
          defaultValue={person?.id ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          style={{
            fontFamily: editorialFonts.body,
            fontSize: 13,
            padding: '4px 8px',
            borderRadius: 6,
            border: `1px solid ${t.borderVisible}`,
            background: t.black,
            color: t.textDisplay,
            outline: 'none',
          }}
        >
          <option value="">— Unassigned —</option>
          {agencyProfiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name ?? p.email}
              {p.flavor ? ` · ${p.flavor}` : ''}
            </option>
          ))}
        </select>
      ) : (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 8px 4px 4px',
            borderRadius: 999,
            border: `1px solid ${t.border}`,
            background: t.black,
            color: person ? t.textDisplay : t.textSecondary,
            fontSize: 13,
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              background: person ? t.accentSubtle : t.surfaceInk,
              color: person ? t.accent : t.textDisabled,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: editorialFonts.body,
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {person ? initials : '?'}
          </span>
          <span>{display ?? 'Unassigned'}</span>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={pending}
              aria-label={`Change ${label.toLowerCase()}`}
              style={{
                marginLeft: 2,
                width: 22,
                height: 22,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                border: 'none',
                background: 'transparent',
                color: t.textSecondary,
                cursor: 'pointer',
              }}
            >
              <Pencil size={12} />
            </button>
          ) : null}
        </div>
      )}

      {error ? (
        <span style={{ fontSize: 11, color: t.danger }}>{error}</span>
      ) : null}
    </div>
  );
}
