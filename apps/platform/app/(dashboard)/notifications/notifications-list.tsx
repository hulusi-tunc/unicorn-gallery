'use client';

import { Bell, Check, MessageCircle, Reply, AtSign } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { UserAvatar } from '@/components/user-avatar';
import { markAllNotificationsSeen } from '@/lib/actions/notifications';
import type { NotificationFeedItem } from '@/lib/queries';
import { editorialFonts, getNd } from '@/lib/tokens';

export function NotificationsList({
  items,
  filter,
}: {
  items: NotificationFeedItem[];
  currentUserId: string;
  filter: 'all' | 'unread';
}): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const unseenCount = items.filter((i) => i.seen_at == null).length;

  function onMarkAllRead(): void {
    startTransition(async () => {
      await markAllNotificationsSeen();
      router.refresh();
    });
  }

  return (
    <div
      className="mx-auto w-full max-w-3xl px-6 py-10"
      style={{ fontFamily: editorialFonts.body }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 24,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <p
            style={{
              fontFamily: editorialFonts.mono,
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: t.textSecondary,
              margin: 0,
            }}
          >
            Activity
          </p>
          <h1
            style={{
              fontFamily: editorialFonts.display,
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: '-0.015em',
              color: t.textDisplay,
              margin: '4px 0 0',
            }}
          >
            Notifications
          </h1>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 13,
              color: t.textSecondary,
            }}
          >
            {unseenCount > 0
              ? `${unseenCount} unread feedback item${unseenCount === 1 ? '' : 's'}`
              : 'All caught up.'}
          </p>
        </div>
        {unseenCount > 0 ? (
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={pending}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 999,
              border: `1px solid ${t.borderVisible}`,
              background: 'transparent',
              color: t.textPrimary,
              fontFamily: editorialFonts.body,
              fontSize: 13,
              fontWeight: 500,
              cursor: pending ? 'not-allowed' : 'pointer',
              opacity: pending ? 0.5 : 1,
            }}
          >
            <Check size={13} /> Mark all as read
          </button>
        ) : null}
      </header>

      <div
        style={{
          display: 'inline-flex',
          gap: 0,
          marginBottom: 16,
          background: t.surface,
          padding: 3,
          borderRadius: 999,
          border: `1px solid ${t.border}`,
        }}
      >
        {(['all', 'unread'] as const).map((key) => {
          const active = key === filter;
          return (
            <Link
              key={key}
              href={key === 'all' ? '/notifications' : '/notifications?filter=unread'}
              style={{
                padding: '5px 14px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 500,
                textDecoration: 'none',
                background: active ? t.accent : 'transparent',
                color: active ? 'white' : t.textPrimary,
                transition: 'background 120ms ease-out',
              }}
            >
              {key === 'all' ? 'All' : 'Unread'}
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <EmptyState t={t} filter={filter} />
      ) : (
        <ol
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            background: t.black,
            border: `1px solid ${t.border}`,
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          {items.map((item) => (
            <NotificationRow key={item.id} item={item} t={t} />
          ))}
        </ol>
      )}
    </div>
  );
}

function NotificationRow({
  item,
  t,
}: {
  item: NotificationFeedItem;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  const unread = item.seen_at == null;

  // Compose the click-through URL. If the comment's frame is unknown
  // (frame deleted) we just navigate to the app overview.
  const href =
    item.app && item.frame
      ? `/app/${encodeURIComponent(item.app.slug)}/${encodeURIComponent(item.frame.flow_id)}/${encodeURIComponent(item.frame.frame_id)}`
      : item.app
        ? `/app/${encodeURIComponent(item.app.slug)}`
        : '/';

  const actorName =
    item.actor?.name?.trim() ||
    (item.actor?.email ? item.actor.email.split('@')[0] : 'Someone');
  const verb =
    item.kind === 'mention'
      ? 'mentioned you on'
      : item.kind === 'reply'
        ? 'replied to your comment on'
        : 'commented on';
  const where = item.frame
    ? `${item.frame.flow_name} · ${item.frame.frame_name}`
    : item.app?.name ?? 'an app';

  const Icon =
    item.kind === 'mention'
      ? AtSign
      : item.kind === 'reply'
        ? Reply
        : MessageCircle;

  const accent = item.app?.accent_color ?? t.accent;

  return (
    <li>
      <Link
        href={href}
        style={{
          display: 'flex',
          gap: 12,
          padding: '14px 16px',
          alignItems: 'flex-start',
          textDecoration: 'none',
          color: 'inherit',
          borderBottom: `1px solid ${t.border}`,
          background: unread ? t.accentSubtle : 'transparent',
          transition: 'background 120ms ease-out',
        }}
        onMouseEnter={(e) => {
          if (!unread) e.currentTarget.style.background = t.surface;
        }}
        onMouseLeave={(e) => {
          if (!unread) e.currentTarget.style.background = 'transparent';
        }}
      >
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <UserAvatar
            name={item.actor?.name ?? null}
            email={item.actor?.email ?? null}
            avatarUrl={item.actor?.avatar_url ?? null}
            size={36}
            background={t.accentSubtle}
            color={t.accent}
          />
          <span
            aria-hidden
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 18,
              height: 18,
              borderRadius: 999,
              background: t.black,
              border: `2px solid ${t.black}`,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: t.textPrimary,
            }}
          >
            <Icon size={10} />
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: t.textPrimary,
              lineHeight: 1.5,
            }}
          >
            <span style={{ fontWeight: 500, color: t.textDisplay }}>
              {actorName}
            </span>{' '}
            {verb}{' '}
            <span style={{ color: t.textDisplay }}>{where}</span>
            {item.app ? (
              <span
                style={{
                  marginLeft: 8,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '1px 8px',
                  borderRadius: 999,
                  border: `1px solid ${t.border}`,
                  background: t.surface,
                  fontFamily: editorialFonts.mono,
                  fontSize: 9,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: t.textSecondary,
                  verticalAlign: 'middle',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: accent,
                  }}
                />
                {item.app.name}
              </span>
            ) : null}
          </p>
          {item.comment ? (
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 13,
                color: t.textSecondary,
                lineHeight: 1.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              "{item.comment.body}"
            </p>
          ) : null}
          <p
            style={{
              margin: '6px 0 0',
              fontFamily: editorialFonts.mono,
              fontSize: 10,
              color: t.textDisabled,
              letterSpacing: '0.04em',
            }}
          >
            {formatRelative(item.created_at)}
          </p>
        </div>

        {unread ? (
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              width: 8,
              height: 8,
              borderRadius: 999,
              background: t.accent,
              marginTop: 8,
            }}
          />
        ) : null}
      </Link>
    </li>
  );
}

function EmptyState({
  t,
  filter,
}: {
  t: ReturnType<typeof getNd>;
  filter: 'all' | 'unread';
}): ReactNode {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: '64px 24px',
        textAlign: 'center',
        background: t.surface,
        border: `1px dashed ${t.border}`,
        borderRadius: 14,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 999,
          background: t.black,
          border: `1px solid ${t.border}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: t.textDisabled,
        }}
      >
        <Bell size={20} />
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 500,
          color: t.textDisplay,
        }}
      >
        {filter === 'unread' ? 'No unread feedback' : 'No notifications yet'}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: t.textSecondary,
          maxWidth: 320,
        }}
      >
        {filter === 'unread'
          ? "You're all caught up — comments and replies will show here as they come in."
          : 'Comments, replies and @mentions on any app you can see will appear here.'}
      </p>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
