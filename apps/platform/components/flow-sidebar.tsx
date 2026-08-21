'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { Manifest, ManifestFlow } from '@unicorn-studio/gallery-capture';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { editorialFonts, getNd } from '@/lib/tokens';

const SIDEBAR_WIDTH_KEY = 'flow-sidebar-width';
const DEFAULT_SIDEBAR_WIDTH = 240;
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 480;

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
  unreadByFlow,
}: {
  manifest: Manifest;
  appSlug: string;
  unreadByFlow?: Map<string, number>;
}): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const versionParam = searchParams?.get('v');
  // Preserve `?v=N` across sidebar nav so browsing flows inside a past
  // version stays scoped to that version.
  const versionQuery = versionParam ? `?v=${versionParam}` : '';
  const segs = pathname.split('/').filter(Boolean);
  const activeFlowId = segs.length >= 3 ? decodeURIComponent(segs[2] ?? '') : '';
  // "on overview" = exactly /app/<slug> — we use this to decide whether
  // a sidebar click should smooth-scroll in place vs route back to the
  // overview with a hash that the page then scrolls to on mount.
  const onOverview = segs.length === 2 && segs[0] === 'app';

  // Resizable width, persisted in localStorage so it survives nav. SSR
  // gets the default to avoid hydration drift; the stored value applies
  // on the first effect tick.
  const [width, setWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [resizing, setResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY);
      if (stored) {
        const n = Number(stored);
        if (Number.isFinite(n) && n >= MIN_SIDEBAR_WIDTH && n <= MAX_SIDEBAR_WIDTH) {
          setWidth(n);
        }
      }
    } catch {
      /* localStorage unavailable — keep default */
    }
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: PointerEvent): void => {
      const delta = e.clientX - startXRef.current;
      const next = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, startWidthRef.current + delta),
      );
      setWidth(next);
    };
    const onUp = (): void => {
      setResizing(false);
      try {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
      } catch {
        /* persistence best-effort */
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [resizing, width]);

  const isScreensTab = searchParams?.get('tab') === 'screens';

  // Hide sidebar entirely on Screens tab (Mobbin shows full-width grid)
  if (isScreensTab) return null;

  return (
    <aside
      style={{
        width,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: t.black,
        fontFamily: editorialFonts.body,
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        maxHeight: 'calc(100vh - 60px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        userSelect: resizing ? 'none' : undefined,
      }}
    >
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 20, padding: '6px 20px 10px' }}>
        {(['screens', 'flows'] as const).map((tab) => {
          const tabParam = searchParams?.get('tab');
          const isActive = tab === 'flows' ? tabParam !== 'screens' : tabParam === 'screens';
          const href = tab === 'flows'
            ? `/app/${encodeURIComponent(appSlug)}${versionQuery}`
            : `/app/${encodeURIComponent(appSlug)}?tab=screens${versionParam ? `&v=${versionParam}` : ''}`;
          return (
            <Link
              key={tab}
              href={href}
              style={{
                position: 'relative',
                fontFamily: editorialFonts.body,
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? t.textDisplay : t.textSecondary,
                textDecoration: 'none',
                paddingBottom: 8,
                transition: 'color 120ms ease-out',
              }}
            >
              {tab === 'screens' ? 'Screens' : 'Flows'}
              {isActive ? (
                <span style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  borderRadius: 1,
                  background: t.textDisplay,
                }} />
              ) : null}
            </Link>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ padding: '2px 12px 6px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 8,
          background: t.surface,
          fontSize: 13,
          color: t.textDisabled,
        }}>
          Search...
        </div>
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
              onOverview={onOverview}
              t={t}
              unreadByFlow={unreadByFlow}
              versionQuery={versionQuery}
            />
          ))
        )}
      </nav>
      {/* Resize handle — a thin vertical strip on the right border.
          Hovering shows a subtle accent line; dragging adjusts width
          live. Width persists to localStorage on pointerup. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onPointerDown={(e) => {
          e.preventDefault();
          startXRef.current = e.clientX;
          startWidthRef.current = width;
          setResizing(true);
        }}
        style={{
          position: 'absolute',
          top: 0,
          right: -3,
          width: 6,
          height: '100%',
          cursor: 'col-resize',
          background: resizing ? t.accent : 'transparent',
          transition: resizing ? undefined : 'background 120ms ease-out',
          zIndex: 1,
        }}
        onMouseEnter={(e) => {
          if (!resizing) e.currentTarget.style.background = t.border;
        }}
        onMouseLeave={(e) => {
          if (!resizing) e.currentTarget.style.background = 'transparent';
        }}
      />
    </aside>
  );
}

function FlowTreeNode({
  node,
  depth,
  appSlug,
  activeFlowId,
  onOverview,
  t,
  unreadByFlow,
  versionQuery,
}: {
  node: FlowNode;
  depth: number;
  appSlug: string;
  activeFlowId: string;
  onOverview: boolean;
  t: ReturnType<typeof getNd>;
  unreadByFlow?: Map<string, number>;
  versionQuery: string;
}): ReactNode {
  const active = node.flow.id === activeFlowId;
  const unread = unreadByFlow?.get(node.flow.id) ?? 0;
  return (
    <>
      <FlowLink
        href={`/app/${encodeURIComponent(appSlug)}${versionQuery}#flow-${encodeURIComponent(node.flow.id)}`}
        flowId={node.flow.id}
        name={node.flow.name}
        count={node.flow.frames.length}
        active={active}
        depth={depth}
        onOverview={onOverview}
        t={t}
        unread={unread}
      />
      {node.children.map((child) => (
        <FlowTreeNode
          key={child.flow.id}
          node={child}
          depth={depth + 1}
          appSlug={appSlug}
          activeFlowId={activeFlowId}
          onOverview={onOverview}
          t={t}
          unreadByFlow={unreadByFlow}
          versionQuery={versionQuery}
        />
      ))}
    </>
  );
}

function FlowLink({
  href,
  flowId,
  name,
  count,
  active,
  depth,
  onOverview,
  t,
  unread,
}: {
  href: string;
  flowId: string;
  name: string;
  count: number;
  active: boolean;
  depth: number;
  onOverview: boolean;
  t: ReturnType<typeof getNd>;
  unread: number;
}): ReactNode {
  const indent = depth * 14;
  return (
    <Link
      href={href}
      onClick={(e) => {
        // Already on the overview — don't push a new route, just smooth-
        // scroll the anchor into view. The default Link behavior would
        // re-render and lose the smooth-scroll feel.
        if (!onOverview) return;
        e.preventDefault();
        const target = document.getElementById(`flow-${flowId}`);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Update the hash without scrolling/reloading so back-button still
        // works and the URL reflects the section.
        history.replaceState(null, '', `#flow-${flowId}`);
      }}
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
        fontWeight: active ? 600 : 400,
        transition: 'background 120ms ease-out, color 120ms ease-out',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = t.surfaceRaised;
          e.currentTarget.style.color = t.textDisplay;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = t.textPrimary;
        }
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
          gap: 6,
          flexShrink: 0,
        }}
      >
        {unread > 0 ? (
          <span
            aria-label={`${unread} unresolved`}
            title={`${unread} unresolved comment${unread === 1 ? '' : 's'} in this flow`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 999,
              // Orange — matches the unresolved-comment badge on frame
              // cards so "comments need attention" reads as one signal
              // across the UI.
              background: 'oklch(0.7 0.18 55)',
              fontFamily: editorialFonts.mono,
              fontSize: 10,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              color: 'white',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
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
      </span>
    </Link>
  );
}
