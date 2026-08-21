'use client';

import { createPortal } from 'react-dom';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { UserAvatar } from '@/components/user-avatar';
import { editorialFonts, getNd } from '@/lib/tokens';

interface PreviewItem {
  authorName: string | null;
  authorEmail: string;
  authorRole: 'agency' | 'customer';
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Orange "N unresolved comments" pill rendered on top of a frame card.
 * Hovering opens a popover with the most recent unresolved comments —
 * each row is a stripped-down CommentItem (avatar + name + role chip +
 * body + date) so it reads as the same component family.
 *
 * The popover renders into a portal at `position: fixed` against the
 * viewport so it can't get clipped by parent overflows (the journey
 * strip's `overflow-x-auto`) or pushed behind sibling stacking contexts
 * like the left sidebar. We compute the anchor position from the
 * badge's bounding rect each open and on scroll/resize.
 */
export function UnresolvedBadge({
  count,
  preview,
  offsetForUpdated,
}: {
  count: number;
  preview: PreviewItem[];
  /** When true, the "Updated" pill is also on this card — shift down so they don't overlap. */
  offsetForUpdated: boolean;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const { theme } = useTheme();
  const t = getNd(theme);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const POPOVER_WIDTH = 340;
    const update = (): void => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      // Anchor the popover's top-right to the badge's bottom-right so
      // it extends down and to the left, matching the badge's corner.
      // Clamp inside viewport so it never sticks under the sidebar.
      const top = r.bottom + 8;
      let left = r.right - POPOVER_WIDTH;
      if (left < 12) left = 12;
      setPos({ top, left });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  return (
    <span
      ref={anchorRef}
      className={`absolute z-20 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium tabular-nums text-white shadow-lg backdrop-blur-sm ${
        offsetForUpdated ? 'right-2 top-6' : 'right-2.5 top-2.5'
      }`}
      style={{
        background: 'rgba(0, 0, 0, 0.60)',
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      role="status"
      aria-label={`${count} unresolved comment${count === 1 ? '' : 's'}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="oklch(0.75 0.18 55)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {count}
      {mounted && open && pos && preview.length > 0
        ? createPortal(
            <div
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={() => setOpen(false)}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                width: 320,
                background: t.black,
                borderRadius: 14,
                boxShadow: '0 16px 48px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)',
                padding: 16,
                zIndex: 9999,
                textAlign: 'left',
                cursor: 'default',
                fontFamily: editorialFonts.body,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="oklch(0.75 0.18 55)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.textDisplay }}>
                  {count} open comment{count === 1 ? '' : 's'}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {preview.map((p, i) => (
                  <div
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 10, background: t.surface }}
                  >
                    <UserAvatar
                      name={p.authorName}
                      email={p.authorEmail}
                      avatarUrl={p.authorAvatarUrl}
                      size={28}
                      background={t.accentSubtle}
                      color={t.accent}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: t.textPrimary,
                          }}
                        >
                          {p.authorName ?? p.authorEmail}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            color: t.textDisabled,
                          }}
                        >
                          {p.authorRole === 'agency' ? 'Agency' : 'Customer'}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: '4px 0 0',
                          fontSize: 13,
                          color: t.textPrimary,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.4,
                        }}
                      >
                        {p.body}
                      </p>
                      <p
                        style={{
                          margin: '6px 0 0',
                          fontSize: 13,
                          color: t.textDisabled,
                        }}
                      >
                        {formatDateLabel(p.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {count > preview.length ? (
                <p
                  style={{
                    margin: '12px 0 0',
                    fontSize: 13,
                    color: t.textSecondary,
                  }}
                >
                  + {count - preview.length} more — open the screen to see all
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
