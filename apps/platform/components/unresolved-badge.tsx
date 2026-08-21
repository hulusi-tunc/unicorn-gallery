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
      className={`absolute z-20 inline-flex items-center gap-1 rounded-full bg-[oklch(0.7_0.18_55)] px-2 py-0.5 font-mono text-[13px] font-semibold tabular-nums text-white shadow-md dark:bg-[oklch(0.65_0.19_55)] ${
        offsetForUpdated ? 'right-1 top-5' : '-top-2 right-1'
      }`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      role="status"
      aria-label={`${count} unresolved comment${count === 1 ? '' : 's'}`}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
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
                width: 340,
                background: '#ffffff',
                border: `1px solid ${t.border}`,
                borderRadius: 10,
                boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
                padding: 14,
                zIndex: 9999,
                textAlign: 'left',
                cursor: 'default',
                fontFamily: editorialFonts.body,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: t.textPrimary,
                  }}
                >
                  {count} open comment{count === 1 ? '' : 's'}
                </span>
                {count > preview.length ? (
                  <span style={{ fontSize: 11, color: t.textDisabled }}>
                    showing {preview.length}
                  </span>
                ) : null}
              </div>
              <ul
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                }}
              >
                {preview.map((p, i) => (
                  <li
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    style={{ display: 'flex', gap: 12 }}
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
                            fontSize: 12,
                            fontWeight: 500,
                            color: t.textPrimary,
                          }}
                        >
                          {p.authorName ?? p.authorEmail}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: t.textDisabled,
                          }}
                        >
                          {p.authorRole === 'agency' ? 'Agency' : 'Customer'}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: '4px 0 0',
                          fontSize: 14,
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
                          fontSize: 10,
                          color: t.textDisabled,
                        }}
                      >
                        {formatDateLabel(p.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              {count > preview.length ? (
                <p
                  style={{
                    margin: '12px 0 0',
                    fontSize: 11,
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
