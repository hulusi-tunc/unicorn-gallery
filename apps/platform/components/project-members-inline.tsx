'use client';

import { Plus, X } from 'lucide-react';
import { useState, useTransition, type ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import {
  assignProjectMember,
  unassignProjectMember,
} from '@/lib/actions/project-members';
import type { ProfileLite } from '@/lib/db';
import type { ProjectMemberWithProfile } from '@/lib/queries';
import { editorialFonts, getNd } from '@/lib/tokens';

/**
 * Compact multi-person assignment shown in the project header next to
 * Designer / PM. Everyone listed here is a "Capture member" — they see (and can
 * push to) this project in the Capture desktop app. Unlike Designer / PM (one
 * each), this supports any number of people.
 */
export function ProjectMembers({
  appId,
  appSlug,
  members,
  agencyProfiles,
  canEdit,
  t,
}: {
  appId: string;
  appSlug: string;
  members: ProjectMemberWithProfile[];
  agencyProfiles: ProfileLite[];
  canEdit: boolean;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);

  const assignedIds = new Set(members.map((m) => m.user_id));
  const assignable = agencyProfiles.filter((p) => !assignedIds.has(p.id));

  function add(userId: string): void {
    setAdding(false);
    if (!userId) return;
    startTransition(async () => {
      await assignProjectMember({ appId, appSlug, userId });
    });
  }
  function remove(userId: string): void {
    startTransition(async () => {
      await unassignProjectMember({ appId, appSlug, userId });
    });
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span
        title="People who can see and capture this project in the Capture desktop app"
        style={{
          fontFamily: editorialFonts.mono,
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: t.textSecondary,
        }}
      >
        Members
      </span>

      {members.length === 0 && !adding ? (
        <span style={{ fontSize: 12, color: t.textSecondary }}>None</span>
      ) : null}

      {members.map((m) => {
        const name = m.profile.name ?? m.profile.email;
        return (
          <span
            key={m.user_id}
            title={m.profile.email}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: canEdit ? '3px 4px 3px 10px' : '3px 10px',
              borderRadius: 999,
              border: `1px solid ${t.border}`,
              background: t.black,
              color: t.textDisplay,
              fontSize: 12,
              whiteSpace: 'nowrap',
            }}
          >
            {name}
            {canEdit ? (
              <button
                type="button"
                onClick={() => remove(m.user_id)}
                disabled={pending}
                aria-label={`Remove ${name}`}
                style={{
                  width: 18,
                  height: 18,
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
                <X size={11} />
              </button>
            ) : null}
          </span>
        );
      })}

      {canEdit && adding ? (
        <select
          // biome-ignore lint/a11y/noAutofocus: focus the picker the moment it opens
          autoFocus
          disabled={pending}
          defaultValue=""
          onChange={(e) => add(e.target.value)}
          onBlur={() => setAdding(false)}
          style={{
            fontFamily: editorialFonts.body,
            fontSize: 12,
            padding: '3px 6px',
            borderRadius: 6,
            border: `1px solid ${t.borderVisible}`,
            background: t.black,
            color: t.textDisplay,
            outline: 'none',
          }}
        >
          <option value="">Add member…</option>
          {assignable.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name ?? p.email}
            </option>
          ))}
        </select>
      ) : canEdit && assignable.length > 0 ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={pending}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 10px 3px 8px',
            borderRadius: 999,
            border: `1px dashed ${t.borderVisible}`,
            background: 'transparent',
            color: t.textSecondary,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <Plus size={12} /> Add
        </button>
      ) : null}
    </div>
  );
}
