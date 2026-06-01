'use client';

import { Frame, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import type { SearchAppHit, SearchFrameHit, SearchResults } from '@/lib/queries';
import { editorialFonts, getNd, motion, space, swatchRadii } from '@/lib/tokens';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

type Row =
  | { kind: 'app'; hit: SearchAppHit; href: string }
  | { kind: 'frame'; hit: SearchFrameHit; href: string };

const EMPTY: SearchResults = { apps: [], frames: [] };

export function CommandPalette({ open, onClose }: CommandPaletteProps): ReactNode {
  const router = useRouter();
  const { theme } = useTheme();
  const t = getNd(theme);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Reset state when the palette closes so reopening doesn't flash stale data.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults(EMPTY);
      setError(null);
      setSelected(0);
      abortRef.current?.abort();
    } else {
      // Defer focus so the dialog has actually mounted.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(EMPTY);
      setLoading(false);
      setError(null);
      return;
    }
    const handle = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
        credentials: 'same-origin',
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return (await res.json()) as SearchResults;
        })
        .then((data) => {
          setResults(data);
          setSelected(0);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setLoading(false);
          setError('Search failed. Try again.');
        });
    }, 150);
    return () => window.clearTimeout(handle);
  }, [query, open]);

  const rows = useMemo<Row[]>(() => {
    const r: Row[] = [];
    for (const app of results.apps) {
      r.push({ kind: 'app', hit: app, href: `/app/${encodeURIComponent(app.slug)}` });
    }
    for (const frame of results.frames) {
      r.push({
        kind: 'frame',
        hit: frame,
        href: `/app/${encodeURIComponent(frame.app_slug)}/${encodeURIComponent(frame.flow_id)}/${encodeURIComponent(frame.frame_id)}`,
      });
    }
    return r;
  }, [results]);

  const navigate = useCallback(
    (row: Row) => {
      router.push(row.href);
      onClose();
    },
    [router, onClose],
  );

  // Keyboard handling on the input — palette-scoped (not global).
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (rows.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((i) => (i + 1) % rows.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((i) => (i - 1 + rows.length) % rows.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[selected];
      if (row) navigate(row);
    }
  };

  if (!open) return null;

  const backdrop: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'oklch(0 0 0 / 0.5)',
    backdropFilter: 'blur(4px)',
    zIndex: 100,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingTop: 96,
  };

  const sheet: CSSProperties = {
    width: 'min(560px, 92vw)',
    maxHeight: 'min(560px, 70vh)',
    background: t.black,
    border: `1px solid ${t.border}`,
    borderRadius: swatchRadii.xl,
    boxShadow: '0 24px 60px oklch(0 0 0 / 0.35)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: editorialFonts.body,
  };

  const inputRow: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: `${space[3]}px ${space[4]}px`,
    borderBottom: `1px solid ${t.border}`,
  };

  const inputStyle: CSSProperties = {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: t.textDisplay,
    fontFamily: editorialFonts.body,
    fontSize: 15,
    minWidth: 0,
  };

  const listStyle: CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: `${space[2]}px 0`,
  };

  const sectionLabel: CSSProperties = {
    fontFamily: editorialFonts.mono,
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: t.textDisabled,
    padding: `${space[2]}px ${space[4]}px ${space[1]}px`,
  };

  let cursor = 0;
  const appsStart = cursor;
  cursor += results.apps.length;
  const framesStart = cursor;

  return (
    <div
      style={backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Search apps and frames"
    >
      <div style={sheet} onMouseDown={(e) => e.stopPropagation()}>
        <div style={inputRow}>
          <Search size={16} color={t.textSecondary} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search apps, frames…"
            style={inputStyle}
            autoComplete="off"
            spellCheck={false}
            aria-label="Search apps and frames"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              border: 'none',
              background: 'transparent',
              color: t.textSecondary,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              borderRadius: swatchRadii.sm,
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={listStyle}>
          {error ? (
            <Empty text={error} t={t} tone="danger" />
          ) : query.trim() === '' ? (
            <Empty text="Type to search apps and frames." t={t} />
          ) : loading && rows.length === 0 ? (
            <Empty text="Searching…" t={t} />
          ) : rows.length === 0 ? (
            <Empty text={`No results for "${query.trim()}"`} t={t} />
          ) : (
            <>
              {results.apps.length > 0 ? (
                <>
                  <div style={sectionLabel}>Apps</div>
                  {results.apps.map((app, i) => {
                    const idx = appsStart + i;
                    return (
                      <AppRowItem
                        key={app.id}
                        app={app}
                        active={idx === selected}
                        onHover={() => setSelected(idx)}
                        onSelect={() => navigate(rows[idx]!)}
                        t={t}
                      />
                    );
                  })}
                </>
              ) : null}
              {results.frames.length > 0 ? (
                <>
                  <div style={sectionLabel}>Frames</div>
                  {results.frames.map((frame, i) => {
                    const idx = framesStart + i;
                    return (
                      <FrameRowItem
                        key={frame.id}
                        frame={frame}
                        active={idx === selected}
                        onHover={() => setSelected(idx)}
                        onSelect={() => navigate(rows[idx]!)}
                        t={t}
                      />
                    );
                  })}
                </>
              ) : null}
            </>
          )}
        </div>

        <Footer t={t} />
      </div>
    </div>
  );
}

function Empty({
  text,
  t,
  tone,
}: {
  text: string;
  t: ReturnType<typeof getNd>;
  tone?: 'danger';
}): ReactNode {
  return (
    <div
      style={{
        padding: `${space[6]}px ${space[4]}px`,
        textAlign: 'center',
        color: tone === 'danger' ? t.danger : t.textSecondary,
        fontFamily: editorialFonts.body,
        fontSize: 13,
      }}
    >
      {text}
    </div>
  );
}

function rowStyle(active: boolean, t: ReturnType<typeof getNd>): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: space[3],
    padding: `${space[2]}px ${space[4]}px`,
    cursor: 'pointer',
    background: active ? t.surfaceInk : 'transparent',
    borderLeft: `2px solid ${active ? t.accent : 'transparent'}`,
    transition: `background ${motion.transition.chrome}`,
  };
}

function AppRowItem({
  app,
  active,
  onHover,
  onSelect,
  t,
}: {
  app: SearchAppHit;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  return (
    <div
      role="option"
      aria-selected={active}
      onMouseMove={onHover}
      onClick={onSelect}
      style={rowStyle(active, t)}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: swatchRadii.md,
          background: app.accent_color ?? t.surfaceRaised,
          flexShrink: 0,
          overflow: 'hidden',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {app.icon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={app.icon_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span
            style={{
              fontFamily: editorialFonts.display,
              fontSize: 12,
              fontWeight: 600,
              color: t.textDisplay,
            }}
          >
            {app.name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span
          style={{
            color: t.textDisplay,
            fontSize: 13,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {app.name}
        </span>
        {app.tagline ? (
          <span
            style={{
              color: t.textSecondary,
              fontSize: 11,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {app.tagline}
          </span>
        ) : null}
      </div>
      <span
        style={{
          fontFamily: editorialFonts.mono,
          fontSize: 9,
          color: t.textDisabled,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        App
      </span>
    </div>
  );
}

function FrameRowItem({
  frame,
  active,
  onHover,
  onSelect,
  t,
}: {
  frame: SearchFrameHit;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  return (
    <div
      role="option"
      aria-selected={active}
      onMouseMove={onHover}
      onClick={onSelect}
      style={rowStyle(active, t)}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: swatchRadii.sm,
          background: t.surfaceRaised,
          flexShrink: 0,
          overflow: 'hidden',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {frame.latest_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={frame.latest_image_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Frame size={12} color={t.textSecondary} />
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span
          style={{
            color: t.textDisplay,
            fontSize: 13,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {frame.frame_name}
        </span>
        <span
          style={{
            color: t.textSecondary,
            fontSize: 11,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {frame.app_name} · {frame.flow_name}
        </span>
      </div>
      <span
        style={{
          fontFamily: editorialFonts.mono,
          fontSize: 9,
          color: t.textDisabled,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        Frame
      </span>
    </div>
  );
}

function Footer({ t }: { t: ReturnType<typeof getNd> }): ReactNode {
  const kbd: CSSProperties = {
    fontFamily: editorialFonts.mono,
    fontSize: 9,
    padding: '2px 5px',
    border: `1px solid ${t.border}`,
    borderRadius: swatchRadii.sm,
    color: t.textSecondary,
  };
  return (
    <div
      style={{
        display: 'flex',
        gap: space[3],
        padding: `${space[2]}px ${space[4]}px`,
        borderTop: `1px solid ${t.border}`,
        color: t.textDisabled,
        fontSize: 11,
      }}
    >
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <span style={kbd}>↑↓</span> Navigate
      </span>
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <span style={kbd}>↵</span> Open
      </span>
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <span style={kbd}>Esc</span> Close
      </span>
    </div>
  );
}
