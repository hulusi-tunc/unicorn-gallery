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

  const backLink: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontFamily: editorialFonts.mono,
    fontSize: 11,
    letterSpacing: '0.06em',
    
    color: t.textSecondary,
    textDecoration: 'none',
    transition: 'color 200ms ease-out',
  };

  const tabStyle = (active: boolean): CSSProperties => ({
    position: 'relative',
    paddingBottom: 12,
    marginBottom: -1,
    fontFamily: editorialFonts.body,
    fontSize: 14,
    fontWeight: 500,
    textDecoration: 'none',
    color: active ? t.textDisplay : t.textSecondary,
    borderBottom: `2px solid ${active ? t.textDisplay : 'transparent'}`,
    transition: 'color 160ms ease-out',
  });

  return (
    <header
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 24px 0',
        borderBottom: `1px solid ${t.border}`,
        background: t.black,
        fontFamily: editorialFonts.body,
      }}
    >
      {/* Row 1 — back link + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <Link href="/apps" style={backLink} title="All apps">
          <ChevronLeft size={14} /> Apps
        </Link>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
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

      {/* Row 2 — app icon + name/tagline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 18 }}>
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
            margin: 0,
            fontFamily: editorialFonts.display,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            color: t.textDisplay,
          }}
        >
          {app.name}
          {app.tagline ? (
            <span style={{ color: t.textSecondary, fontWeight: 400 }}> — {app.tagline}</span>
          ) : null}
        </h1>
      </div>

      {/* Row 3 — quiet metadata columns (Mobbin-style) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px 40px',
          flexWrap: 'wrap',
          marginTop: 20,
        }}
      >
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <MetaLabel t={t}>Members</MetaLabel>
          <ProjectMembers
            appId={app.id}
            appSlug={app.slug}
            members={members}
            agencyProfiles={agencyProfiles}
            canEdit={canEdit}
            t={t}
          />
        </div>
      </div>

      {/* Row 3 — tabs + count */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 18 }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Link href={tabHref('screens')} style={tabStyle(activeTab === 'screens')}>
            Screens
          </Link>
          <Link href={tabHref('flows')} style={tabStyle(activeTab === 'flows')}>
            Flows
          </Link>
        </nav>
        <span
          style={{
            paddingBottom: 12,
            fontFamily: editorialFonts.mono,
            fontSize: 11,
            color: t.textSecondary,
          }}
        >
          {activeTab === 'flows'
            ? `${flowCount} flow${flowCount === 1 ? '' : 's'}`
            : `${frameCount} screen${frameCount === 1 ? '' : 's'}`}
        </span>
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
        fontFamily: editorialFonts.mono,
        fontSize: 10,
        letterSpacing: '0.1em',
        
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
