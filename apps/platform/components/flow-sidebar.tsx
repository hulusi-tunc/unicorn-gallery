'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Manifest } from '@unicorn-studio/gallery-capture';
import type { ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { editorialFonts, getNd } from '@/lib/tokens';

export function FlowSidebar({
  manifest,
  appSlug,
}: {
  manifest: Manifest;
  appSlug: string;
}): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const pathname = usePathname();
  const segs = pathname.split('/').filter(Boolean);
  const activeFlowId = segs.length >= 3 ? decodeURIComponent(segs[2] ?? '') : '';

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: `1px solid ${t.border}`,
        background: t.black,
        fontFamily: editorialFonts.body,
      }}
    >
      <div
        style={{
          padding: '20px 20px 8px',
          fontFamily: editorialFonts.mono,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: t.textSecondary,
        }}
      >
        Flows
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 8px 16px' }}>
        {manifest.flows.length === 0 ? (
          <p style={{ padding: '8px 12px', fontSize: 12, color: t.textSecondary, margin: 0 }}>
            No flows captured yet.
          </p>
        ) : (
          manifest.flows.map((flow) => {
            const active = flow.id === activeFlowId;
            return (
              <FlowLink
                key={flow.id}
                href={`/app/${encodeURIComponent(appSlug)}/${encodeURIComponent(flow.id)}`}
                name={flow.name}
                count={flow.frames.length}
                active={active}
                t={t}
              />
            );
          })
        )}
      </nav>
    </aside>
  );
}

function FlowLink({
  href,
  name,
  count,
  active,
  t,
}: {
  href: string;
  name: string;
  count: number;
  active: boolean;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 6,
        textDecoration: 'none',
        background: active ? t.surface : 'transparent',
        color: active ? t.textDisplay : t.textPrimary,
        fontSize: 14,
        fontWeight: active ? 500 : 400,
        transition: 'background 120ms ease-out, color 120ms ease-out',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = t.surfaceInk;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 22,
          height: 18,
          padding: '0 6px',
          borderRadius: 999,
          background: active ? t.surfaceRaised : 'transparent',
          fontFamily: editorialFonts.mono,
          fontSize: 10,
          fontVariantNumeric: 'tabular-nums',
          color: active ? t.textPrimary : t.textSecondary,
        }}
      >
        {count}
      </span>
    </Link>
  );
}
