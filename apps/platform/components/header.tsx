'use client';

import { ChevronDown, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
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
import { ArchiveAppButton } from '@/components/archive-app-button';
import { DownloadPdfButton } from '@/components/download-pdf-button';
import { EditProjectButton } from '@/components/edit-project-button';
import { ShareButton } from '@/components/share-button';
import { VersionSwitcher } from '@/components/version-switcher';
import type { AppRowWithStaff, ProfileLite } from '@/lib/db';
import type { AppCustomerWithProfile, BuildSummary, EligibleCustomer } from '@/lib/queries';
import { editorialFonts, getNd } from '@/lib/tokens';

const PLATFORM_LABEL: Record<AppRowWithStaff['platform'], string> = {
  web: 'Web',
  ios: 'Mobile',
  android: 'Mobile',
};

export function AppHeader({
  app,
  manifest: _manifest,
  agencyProfiles,
  canEdit,
  customers,
  eligibleCustomers,
  builds,
}: {
  app: AppRowWithStaff;
  // Manifest used to be displayed (build SHA + capture date) — no longer shown.
  manifest: Manifest | null;
  agencyProfiles: ProfileLite[];
  canEdit: boolean;
  customers: AppCustomerWithProfile[];
  eligibleCustomers: EligibleCustomer[];
  builds: BuildSummary[];
}): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const accent = app.accent_color ?? t.accent;

  return (
    <header
      style={{
        display: 'flex',
        height: 56,
        alignItems: 'center',
        gap: 16,
        padding: '0 24px',
        borderBottom: `1px solid ${t.border}`,
        background: t.black,
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        fontFamily: editorialFonts.body,
      }}
    >
      <Link
        href="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: editorialFonts.mono,
          fontSize: 11,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: t.textSecondary,
          textDecoration: 'none',
          transition: 'color 200ms ease-out',
        }}
        title="All apps"
      >
        <ChevronLeft size={14} /> Apps
      </Link>

      <span style={{ width: 1, height: 16, background: t.border }} aria-hidden />

      <EditProjectButton
        appSlug={app.slug}
        appName={app.name}
        iconUrl={app.icon_url}
        accent={accent}
        canEdit={canEdit}
      />

      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <span
          style={{
            fontFamily: editorialFonts.display,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: t.textDisplay,
          }}
        >
          {app.name}
        </span>
        {app.tagline ? (
          <span style={{ fontSize: 11, color: t.textSecondary }}>{app.tagline}</span>
        ) : null}
      </div>

      <span style={{ width: 1, height: 16, background: t.border, marginLeft: 8 }} aria-hidden />

      <StaffChip
        appId={app.id}
        appSlug={app.slug}
        field="designer_id"
        label="Designer"
        person={app.designer}
        agencyProfiles={agencyProfiles}
        canEdit={canEdit}
        t={t}
      />

      <StaffChip
        appId={app.id}
        appSlug={app.slug}
        field="pm_id"
        label="PM"
        person={app.pm}
        agencyProfiles={agencyProfiles}
        canEdit={canEdit}
        t={t}
      />

      <div
        style={{
          marginLeft: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
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
            <DownloadPdfButton appSlug={app.slug} appName={app.name} builds={builds} />
            <ArchiveAppButton appSlug={app.slug} appName={app.name} />
          </>
        ) : null}

        {builds.length > 0 ? (
          <VersionSwitcher appSlug={app.slug} builds={builds} />
        ) : null}

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 22,
            padding: '0 10px',
            borderRadius: 999,
            border: `1px solid ${t.border}`,
            background: t.surface,
            fontFamily: editorialFonts.mono,
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: t.textSecondary,
          }}
        >
          {PLATFORM_LABEL[app.platform]}
        </span>
      </div>
    </header>
  );
}

function StaffChip({
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

  function onPick(profileId: string | null): void {
    startTransition(async () => {
      await assignStaff({ appId, appSlug, field, profileId });
    });
  }

  const chipStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 10px 4px 4px',
    borderRadius: 999,
    border: `1px solid ${t.border}`,
    background: t.surface,
    color: person ? t.textDisplay : t.textSecondary,
    fontFamily: editorialFonts.body,
    fontSize: 12,
    cursor: canEdit ? 'pointer' : 'default',
    opacity: pending ? 0.6 : 1,
    transition: 'opacity 200ms ease-out',
  };

  const inner = (
    <>
      <UserAvatar
        name={person?.name ?? null}
        email={person?.email ?? null}
        avatarUrl={person?.avatar_url ?? null}
        size={22}
        background={person ? t.accentSubtle : t.surfaceInk}
        color={person ? t.accent : t.textDisabled}
      />
      <span
        style={{
          fontFamily: editorialFonts.mono,
          fontSize: 9,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: t.textDisabled,
        }}
      >
        {label}
      </span>
      <span style={{ color: person ? t.textDisplay : t.textSecondary }}>{display}</span>
      {canEdit ? <ChevronDown size={11} style={{ color: t.textSecondary }} /> : null}
    </>
  );

  if (!canEdit) {
    return <span style={chipStyle}>{inner}</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={pending} style={{ ...chipStyle, border: `1px solid ${t.border}` }}>
          {inner}
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
                  textTransform: 'uppercase',
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
  );
}
