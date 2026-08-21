'use client';

import { ChevronDown, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Manifest } from '@unicorn-studio/gallery-capture';
import { useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { UserAvatar } from '@/components/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { assignStaff } from '@/lib/actions/assign-staff';
import { ProjectMembers } from '@/components/project-members-inline';
import { AppActionsMenu } from '@/components/app-actions-menu';
import { EditProjectButton } from '@/components/edit-project-button';
import { ShareButton } from '@/components/share-button';
import { VersionSwitcher } from '@/components/version-switcher';
import type { AppRowWithStaff, ProfileLite } from '@/lib/db';
import type {
  AppCustomerWithProfile,
  BuildSummary,
  EligibleCustomer,
  ProjectMemberWithProfile,
} from '@/lib/queries';
import { editorialFonts, getNd } from '@/lib/tokens';

const PLATFORM_LABEL: Record<AppRowWithStaff['platform'], string> = {
  web: 'Web',
  ios: 'Mobile',
  android: 'Mobile',
};

export type DetailTab = 'flows' | 'screens';

export function AppHeader({
  app,
  manifest: _manifest,
  agencyProfiles,
  canEdit,
  customers,
  eligibleCustomers,
  builds,
  members,
  flowCount,
  frameCount,
}: {
  app: AppRowWithStaff;
  // Manifest used to be displayed (build SHA + capture date) — no longer shown.
  manifest: Manifest | null;
  agencyProfiles: ProfileLite[];
  canEdit: boolean;
  customers: AppCustomerWithProfile[];
  eligibleCustomers: EligibleCustomer[];
  builds: BuildSummary[];
  members: ProjectMemberWithProfile[];
  flowCount: number;
  frameCount: number;
}): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const accent = app.accent_color ?? t.accent;

  // Tabs read the current `?tab`/`?v` so the header (a layout-level component)
  // stays in sync without prop drilling from the page.
  const searchParams = useSearchParams();
  const activeTab: DetailTab = searchParams.get('tab') === 'screens' ? 'screens' : 'flows';
  const versionParam = searchParams.get('v');
  const basePath = `/app/${encodeURIComponent(app.slug)}`;
  const tabHref = (tab: DetailTab): string => {
    const p = new URLSearchParams();
    if (versionParam) p.set('v', versionParam);
    if (tab !== 'flows') p.set('tab', tab);
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const tabStyle = (active: boolean): CSSProperties => ({
    position: 'relative',
    padding: '8px 0',
    fontFamily: editorialFonts.body,
    fontSize: 14,
    fontWeight: active ? 500 : 400,
    textDecoration: 'none',
    color: active ? t.textDisplay : t.textSecondary,
    transition: 'color 160ms ease-out',
  });

  const tabUnderline: CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    background: t.textDisplay,
    borderRadius: 1,
  };

  return (
    <header
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: t.black,
        fontFamily: editorialFonts.body,
      }}
    >
      {/* Hero area - Mobbin style: icon above name */}
      <div style={{ width: '80%', margin: '0 auto', paddingTop: 32, paddingBottom: 24 }}>
        <EditProjectButton
          appSlug={app.slug}
          appName={app.name}
          iconUrl={app.icon_url}
          accent={accent}
          canEdit={canEdit}
          size={56}
        />

        <h1
          style={{
            margin: '20px 0 0',
            fontFamily: editorialFonts.display,
            fontSize: 32,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            color: t.textDisplay,
          }}
        >
          {app.name}
          {app.tagline ? (
            <>
              <br />
              <span style={{ fontWeight: 400 }}>{app.tagline}</span>
            </>
          ) : null}
        </h1>

        {/* Metadata row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, marginTop: 20, flexWrap: 'wrap' }}>
          <MetaField label="Platform" t={t}>
            {PLATFORM_LABEL[app.platform]}
          </MetaField>
          <StaffField
            appId={app.id}
            appSlug={app.slug}
            field="designer_id"
            label="Designer"
            person={app.designer}
            agencyProfiles={agencyProfiles}
            canEdit={canEdit}
            t={t}
          />
          <StaffField
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

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
          {builds.length > 0 ? <VersionSwitcher appSlug={app.slug} builds={builds} /> : null}
          {canEdit ? (
            <>
              <ShareButton
                appId={app.id}
                appSlug={app.slug}
                appName={app.name}
                publicShareToken={app.public_share_token}
                customers={customers}
                eligibleCustomers={eligibleCustomers}
              />
              <AppActionsMenu appSlug={app.slug} appName={app.name} canArchive={canEdit} />
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function MetaLabel({
  children,
  t,
}: {
  children: ReactNode;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  return (
    <span
      style={{
        fontFamily: editorialFonts.body,
        fontSize: 13,
        color: t.textDisabled,
      }}
    >
      {children}
    </span>
  );
}

function MetaField({
  label,
  children,
  t,
}: {
  label: string;
  children: ReactNode;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <MetaLabel t={t}>{label}</MetaLabel>
      <span
        style={{ fontFamily: editorialFonts.body, fontSize: 14, fontWeight: 500, color: t.textDisplay }}
      >
        {children}
      </span>
    </div>
  );
}

/**
 * Quiet metadata field for an editable staff slot (designer/PM). Reads as a
 * plain labeled value; click reveals the assignment dropdown — no loud pill.
 */
function StaffField({
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
  field: 'designer_id' | 'pm_id';
  label: string;
  person: ProfileLite | null;
  agencyProfiles: ProfileLite[];
  canEdit: boolean;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  const [pending, startTransition] = useTransition();
  const display = person?.name?.trim() || person?.email?.split('@')[0] || 'Unassigned';
  const valueColor = person ? t.textDisplay : t.textDisabled;

  function onPick(profileId: string | null): void {
    startTransition(async () => {
      await assignStaff({ appId, appSlug, field, profileId });
    });
  }

  const value: CSSProperties = {
    fontFamily: editorialFonts.body,
    fontSize: 14,
    fontWeight: 500,
    color: valueColor,
  };

  if (!canEdit) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <MetaLabel t={t}>{label}</MetaLabel>
        <span style={value}>{display}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <MetaLabel t={t}>{label}</MetaLabel>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={pending}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
              opacity: pending ? 0.6 : 1,
              ...value,
            }}
          >
            {display}
            <ChevronDown size={12} style={{ color: t.textDisabled }} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6}>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onPick(null)}>
            <span style={{ color: t.textSecondary, fontStyle: 'italic' }}>Unassigned</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {agencyProfiles.map((p) => (
            <DropdownMenuItem key={p.id} onSelect={() => onPick(p.id)}>
              <UserAvatar
                name={p.name}
                email={p.email}
                avatarUrl={p.avatar_url}
                size={20}
                background={t.accentSubtle}
                color={t.accent}
              />
              <span style={{ marginLeft: 6 }}>{p.name ?? p.email.split('@')[0]}</span>
              {p.flavor ? (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontFamily: editorialFonts.mono,
                    fontSize: 9,
                    letterSpacing: '0.08em',
                    
                    color: t.textDisabled,
                  }}
                >
                  {p.flavor}
                </span>
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
