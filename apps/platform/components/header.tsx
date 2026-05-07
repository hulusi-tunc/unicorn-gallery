'use client';

import { ChevronLeft, GitCommit } from 'lucide-react';
import Link from 'next/link';
import type { Manifest } from '@unicorn-studio/gallery-capture';
import type { ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import type { AppRow } from '@/lib/db';
import { editorialFonts, getNd } from '@/lib/tokens';

const PLATFORM_LABEL: Record<AppRow['platform'], string> = {
  web: 'Web',
  ios: 'iOS',
  android: 'Android',
};

export function AppHeader({
  app,
  manifest,
}: {
  app: AppRow;
  manifest: Manifest | null;
}): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const accent = app.accent_color ?? t.accent;
  const captured = manifest ? new Date(manifest.capturedAt) : null;
  const dateLabel =
    captured && !isNaN(captured.getTime())
      ? captured.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : null;

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

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 8,
          background: accent,
          color: 'white',
          fontFamily: editorialFonts.display,
          fontSize: 13,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {app.icon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={app.icon_url}
            alt=""
            style={{ width: '100%', height: '100%', borderRadius: 8, objectFit: 'cover' }}
          />
        ) : (
          app.name.charAt(0).toUpperCase()
        )}
      </div>

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

      {manifest ? (
        <>
          <div
            style={{
              marginLeft: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              border: `1px solid ${t.border}`,
              background: t.surface,
              fontFamily: editorialFonts.mono,
              fontSize: 11,
              color: t.textSecondary,
            }}
          >
            <GitCommit size={11} />
            <span>{manifest.buildSha.slice(0, 8)}</span>
          </div>
          {dateLabel ? (
            <span style={{ fontSize: 12, color: t.textSecondary }}>{dateLabel}</span>
          ) : null}
        </>
      ) : null}

      <span
        style={{
          marginLeft: 'auto',
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
    </header>
  );
}
