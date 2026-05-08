'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Manifest, ManifestFlow } from '@unicorn-studio/gallery-capture';
import type { ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { editorialFonts, getNd } from '@/lib/tokens';

interface FlowNode {
  flow: ManifestFlow;
  children: FlowNode[];
}

function buildFlowTree(flows: readonly ManifestFlow[]): FlowNode[] {
  const ids = new Set(flows.map((f) => f.id));
  const childrenOf = new Map<string | undefined, ManifestFlow[]>();
  for (const f of flows) {
    const key = f.parentFlowId && ids.has(f.parentFlowId) ? f.parentFlowId : undefined;
    const list = childrenOf.get(key) ?? [];
    list.push(f);
    childrenOf.set(key, list);
  }
  const build = (parent: string | undefined): FlowNode[] =>
    (childrenOf.get(parent) ?? []).map((f) => ({ flow: f, children: build(f.id) }));
  return build(undefined);
}

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
          buildFlowTree(manifest.flows).map((node) => (
            <FlowTreeNode
              key={node.flow.id}
              node={node}
              depth={0}
              appSlug={appSlug}
              activeFlowId={activeFlowId}
              t={t}
            />
          ))
        )}
      </nav>
    </aside>
  );
}

function FlowTreeNode({
  node,
  depth,
  appSlug,
  activeFlowId,
  t,
}: {
  node: FlowNode;
  depth: number;
  appSlug: string;
  activeFlowId: string;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  const active = node.flow.id === activeFlowId;
  return (
    <>
      <FlowLink
        href={`/app/${encodeURIComponent(appSlug)}/${encodeURIComponent(node.flow.id)}`}
        name={node.flow.name}
        count={node.flow.frames.length}
        active={active}
        depth={depth}
        t={t}
      />
      {node.children.map((child) => (
        <FlowTreeNode
          key={child.flow.id}
          node={child}
          depth={depth + 1}
          appSlug={appSlug}
          activeFlowId={activeFlowId}
          t={t}
        />
      ))}
    </>
  );
}

function FlowLink({
  href,
  name,
  count,
  active,
  depth,
  t,
}: {
  href: string;
  name: string;
  count: number;
  active: boolean;
  depth: number;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  const indent = depth * 14;
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '8px 12px',
        paddingLeft: 12 + indent,
        borderRadius: 6,
        textDecoration: 'none',
        background: active ? t.surface : 'transparent',
        color: active ? t.textDisplay : t.textPrimary,
        fontSize: depth === 0 ? 14 : 13,
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
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {depth > 0 && (
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              color: t.textDisabled,
              fontFamily: editorialFonts.mono,
              fontSize: 11,
              lineHeight: 1,
            }}
          >
            ↳
          </span>
        )}
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </span>
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
