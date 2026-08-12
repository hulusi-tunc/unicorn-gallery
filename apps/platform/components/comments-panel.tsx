'use client';

import {
  Check,
  CheckCircle2,
  CornerDownRight,
  Languages,
  Loader2,
  MessageCircle,
  Pencil,
  Reply,
  RotateCcw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { UserAvatar } from '@/components/user-avatar';
import {
  deleteComment,
  postComment,
  setCommentResolved,
  updateComment,
} from '@/lib/actions/comments';
import { editorialFonts, getNd } from '@/lib/tokens';
import type { CommentWithAuthor } from '@/lib/comments';
import type { MentionableProfile } from '@/lib/queries';

const PANEL_WIDTH_KEY = 'comments-panel-width';
const DEFAULT_PANEL_WIDTH = 320;
const MIN_PANEL_WIDTH = 280;
const MAX_PANEL_WIDTH = 640;

export function CommentsPanel({
  frameRowId,
  comments,
  isAgency,
  appSlug,
  appId,
  currentUserId,
  mentionables,
  readOnly = false,
}: {
  frameRowId: string;
  comments: CommentWithAuthor[];
  isAgency: boolean;
  appSlug: string;
  appId: string;
  /** Used for ownership checks (edit/delete on own comments). null when not signed in (won't happen on this route, but typing it kindly). */
  currentUserId: string | null;
  mentionables: MentionableProfile[];
  /**
   * When true, the new-comment composer is hidden. Set by frame pages when
   * viewing a past version (`?v=N`) — new comments belong to the current
   * version, not historical snapshots. Existing comments stay editable
   * since they're anchored to the frame identity and the same DB row
   * appears across every version where the frame existed.
   */
  readOnly?: boolean;
}): ReactNode {
  const router = useRouter();
  const { theme } = useTheme();
  const t = getNd(theme);
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Resizable width, persisted in localStorage so it survives nav.
  // Mirrors the FlowSidebar pattern — handle on the *left* edge here
  // since the panel is anchored to the right of the page.
  const [width, setWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [resizing, setResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_PANEL_WIDTH);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PANEL_WIDTH_KEY);
      if (stored) {
        const n = Number(stored);
        if (Number.isFinite(n) && n >= MIN_PANEL_WIDTH && n <= MAX_PANEL_WIDTH) {
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
      // Dragging left grows the panel — invert the delta.
      const delta = startXRef.current - e.clientX;
      const next = Math.min(
        MAX_PANEL_WIDTH,
        Math.max(MIN_PANEL_WIDTH, startWidthRef.current + delta),
      );
      setWidth(next);
    };
    const onUp = (): void => {
      setResizing(false);
      try {
        localStorage.setItem(PANEL_WIDTH_KEY, String(width));
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

  const threads = useMemo(() => buildThreads(comments), [comments]);
  const visibleThreads = useMemo(
    () =>
      showResolved
        ? threads
        : threads.filter(
            (th) => th.root.resolved_at == null || th.replies.some((r) => r.resolved_at == null),
          ),
    [threads, showResolved],
  );
  const resolvedCount = threads.filter((th) => th.root.resolved_at != null).length;

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    setError(null);
    try {
      const res = await postComment({
        frameRowId,
        appId,
        appSlug,
        body: body.trim(),
      });
      if (res.error) throw new Error(res.error);
      setBody('');
      router.refresh();
      // Keep focus on the composer so successive comments don't need a click.
      requestAnimationFrame(() => composerRef.current?.focus());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <aside
      style={{
        display: 'flex',
        width,
        flexShrink: 0,
        flexDirection: 'column',
        borderLeft: `1px solid ${t.border}`,
        background: t.black,
        fontFamily: editorialFonts.body,
        position: 'relative',
        userSelect: resizing ? 'none' : undefined,
      }}
    >
      {/* Resize handle — thin vertical strip on the LEFT edge of the panel.
          Drag left to grow the panel, right to shrink. Width persists to
          localStorage on pointerup. Mirrors the FlowSidebar pattern. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize comments panel"
        onPointerDown={(e) => {
          e.preventDefault();
          startXRef.current = e.clientX;
          startWidthRef.current = width;
          setResizing(true);
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: -3,
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 20px',
          borderBottom: `1px solid ${t.border}`,
          fontSize: 14,
          fontWeight: 500,
          color: t.textDisplay,
        }}
      >
        <MessageCircle size={14} style={{ color: t.textSecondary }} />
        <span>Comments</span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: editorialFonts.mono,
            fontSize: 11,
            color: t.textSecondary,
          }}
        >
          {visibleThreads.length}
          {resolvedCount > 0 && !showResolved ? (
            <span style={{ color: t.textDisabled }}> · {resolvedCount} resolved</span>
          ) : null}
        </span>
      </div>
      {resolvedCount > 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 20px',
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 999,
              border: `1px solid ${t.border}`,
              background: showResolved ? t.surface : 'transparent',
              color: t.textPrimary,
              fontFamily: editorialFonts.body,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            <CheckCircle2 size={11} />
            {showResolved ? 'Hide resolved' : 'Show resolved'}
          </button>
        </div>
      ) : null}

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: '20px',
        }}
      >
        {visibleThreads.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                background: t.surface,
                border: `1px solid ${t.border}`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: t.textDisabled,
              }}
            >
              <MessageCircle size={16} />
            </div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: t.textPrimary }}>
              {threads.length === 0 ? 'Start a discussion' : 'No active feedback'}
            </p>
            <p style={{ margin: 0, maxWidth: '12rem', fontSize: 12, color: t.textSecondary }}>
              {threads.length === 0
                ? 'Drop a comment for the agency or customer to see.'
                : 'All feedback on this frame has been resolved.'}
            </p>
          </div>
        ) : (
          visibleThreads.map((thread) => (
            <ThreadView
              key={thread.root.id}
              thread={thread}
              t={t}
              isAgency={isAgency}
              appSlug={appSlug}
              frameRowId={frameRowId}
              appId={appId}
              currentUserId={currentUserId}
              mentionables={mentionables}
            />
          ))
        )}
      </div>

      {readOnly ? (
        <div
          style={{
            borderTop: `1px solid ${t.border}`,
            padding: 12,
            fontFamily: editorialFonts.body,
            fontSize: 12,
            color: t.textSecondary,
            textAlign: 'center',
          }}
        >
          Viewing a past version — switch to the latest to add new comments.
        </div>
      ) : (
      <form
        onSubmit={onSubmit}
        style={{ borderTop: `1px solid ${t.border}`, padding: 12 }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            borderRadius: 10,
            border: `1px solid ${focused ? t.accent : t.borderVisible}`,
            background: t.surface,
            padding: 8,
            transition: 'border-color 200ms cubic-bezier(0.165, 0.84, 0.44, 1)',
            boxShadow: focused
              ? `0 0 0 3px ${t.accent.startsWith('oklch(') ? t.accent.replace(')', ' / 0.18)') : t.accent}`
              : 'none',
          }}
        >
          <MentionTextarea
            value={body}
            onChange={setBody}
            mentionables={mentionables}
            t={t}
            placeholder="Add a comment… (use @ to mention)"
            rows={2}
            textareaRef={composerRef}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitShortcut={(form) => form.requestSubmit()}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            {error ? (
              <span style={{ fontSize: 11, color: t.danger }}>{error}</span>
            ) : (
              <span
                style={{
                  fontFamily: editorialFonts.mono,
                  fontSize: 10,
                  color: t.textDisabled,
                  letterSpacing: '0.04em',
                }}
              >
                <kbd
                  style={{
                    padding: '1px 5px',
                    borderRadius: 4,
                    border: `1px solid ${t.border}`,
                    background: t.black,
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                  }}
                >
                  ⌘↵
                </kbd>{' '}
                to post · @ to mention
              </span>
            )}
            <button
              type="submit"
              disabled={pending || !body.trim()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 6,
                border: 'none',
                background: t.accent,
                color: t.accentFg,
                fontFamily: editorialFonts.body,
                fontSize: 12,
                fontWeight: 500,
                padding: '5px 10px',
                cursor: 'pointer',
                opacity: pending || !body.trim() ? 0.5 : 1,
              }}
            >
              {pending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
              {pending ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </form>
      )}
    </aside>
  );
}

function CommentItem({
  comment,
  t,
  isAgency,
  appSlug,
  currentUserId,
  mentionables,
  onReplyClick,
}: {
  comment: CommentWithAuthor;
  t: ReturnType<typeof getNd>;
  isAgency: boolean;
  appSlug: string;
  currentUserId: string | null;
  mentionables: MentionableProfile[];
  /** When set, shows a Reply button — only on thread roots, not on replies. */
  onReplyClick?: () => void;
}): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [editError, setEditError] = useState<string | null>(null);
  // On-demand translation: fetched once, then toggled between original and
  // translated text. Clients write French, the studio reads English (and
  // vice versa) — target follows the viewer's browser language.
  const [translated, setTranslated] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);

  const onToggleTranslate = async (): Promise<void> => {
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }
    if (translated) {
      setShowTranslation(true);
      return;
    }
    setTranslating(true);
    try {
      const target = (navigator.language || 'en').slice(0, 2);
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: comment.body, target }),
      });
      const data = (await res.json()) as { ok?: boolean; translated?: string };
      if (data.ok && data.translated) {
        setTranslated(data.translated);
        setShowTranslation(true);
      }
    } catch {
      // Non-fatal — the original text stays visible.
    } finally {
      setTranslating(false);
    }
  };
  const date = new Date(comment.created_at);
  const dateLabel = isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const resolved = comment.resolved_at != null;
  const isAuthor = currentUserId != null && currentUserId === comment.author_id;
  // Author can always edit + delete; agency can delete anyone's. RLS
  // matches this on the server, we just gate the buttons.
  const canEdit = isAuthor;
  const canDelete = isAuthor || isAgency;

  const onToggleResolve = (): void => {
    startTransition(async () => {
      const res = await setCommentResolved({
        commentId: comment.id,
        resolved: !resolved,
        appSlug,
      });
      if (res.error) {
        // Surface the failure instead of swallowing it — otherwise the UI
        // looks like it worked, then "reappears" after refresh re-fetches
        // the unchanged row.
        alert(res.error);
        return;
      }
      router.refresh();
    });
  };

  const onSaveEdit = (): void => {
    const next = draft.trim();
    if (!next || next === comment.body) {
      setEditing(false);
      return;
    }
    setEditError(null);
    startTransition(async () => {
      const res = await updateComment({ commentId: comment.id, body: next, appSlug });
      if (res.error) {
        setEditError(res.error);
      } else {
        setEditing(false);
        router.refresh();
      }
    });
  };

  const onCancelEdit = (): void => {
    setDraft(comment.body);
    setEditError(null);
    setEditing(false);
  };

  const onDelete = (): void => {
    if (!confirm('Delete this comment? This cannot be undone.')) return;
    startTransition(async () => {
      const res = await deleteComment({ commentId: comment.id, appSlug });
      if (res.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        opacity: resolved ? 0.6 : 1,
        transition: 'opacity 200ms ease-out',
      }}
    >
      <UserAvatar
        name={comment.author.name}
        email={comment.author.email}
        avatarUrl={comment.author.avatar_url}
        size={28}
        background={t.accentSubtle}
        color={t.accent}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: t.textPrimary }}>
            {comment.author.name ?? comment.author.email}
          </span>
          <span
            style={{
              fontFamily: editorialFonts.mono,
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: t.textDisabled,
            }}
          >
            {comment.author.role}
          </span>
          {resolved ? (
            <span
              title={comment.resolved_at ? `Resolved ${new Date(comment.resolved_at).toLocaleString()}` : 'Resolved'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontFamily: editorialFonts.mono,
                fontSize: 9,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: t.success,
                background: 'transparent',
                padding: '1px 6px',
                borderRadius: 999,
                border: `1px solid ${t.border}`,
              }}
            >
              <Check size={9} /> Resolved
            </span>
          ) : null}
        </div>
        {editing ? (
          <div
            style={{
              marginTop: 4,
              padding: 6,
              borderRadius: 8,
              border: `1px solid ${t.borderVisible}`,
              background: t.surface,
            }}
          >
            <MentionTextarea
              value={draft}
              onChange={setDraft}
              mentionables={mentionables}
              t={t}
              placeholder="Edit comment…"
              rows={2}
              autoFocus
              onSubmitShortcut={() => onSaveEdit()}
              onEscape={onCancelEdit}
            />
            {editError ? (
              <p style={{ margin: '4px 0 0', fontSize: 11, color: t.danger }}>{editError}</p>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
              <button
                type="button"
                onClick={onCancelEdit}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: t.textSecondary,
                  fontFamily: editorialFonts.body,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                <X size={10} /> Cancel
              </button>
              <button
                type="button"
                onClick={onSaveEdit}
                disabled={pending || draft.trim().length === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '3px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: t.accent,
                  color: 'white',
                  fontFamily: editorialFonts.body,
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: pending || draft.trim().length === 0 ? 'not-allowed' : 'pointer',
                  opacity: pending || draft.trim().length === 0 ? 0.5 : 1,
                }}
              >
                {pending ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                Save
              </button>
            </div>
          </div>
        ) : (
          <p
            style={{
              margin: '4px 0 0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 14,
              color: t.textPrimary,
              textDecoration: resolved ? 'line-through' : 'none',
              textDecorationColor: t.textDisabled,
            }}
          >
            {renderCommentBody(
              showTranslation && translated ? translated : comment.body,
              t.accent,
            )}
          </p>
        )}
        {!editing ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 6,
              gap: 8,
            }}
          >
            <p style={{ margin: 0, fontSize: 10, color: t.textDisabled }}>{dateLabel}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={() => void onToggleTranslate()}
                title={showTranslation ? 'Show original text' : 'Translate this comment'}
                style={{
                  ...chipBtnStyle(t),
                  ...(showTranslation ? { color: t.accent } : {}),
                }}
                disabled={translating}
              >
                {translating ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <Languages size={10} />
                )}
                {showTranslation ? 'Original' : 'Translate'}
              </button>
              {onReplyClick ? (
                <button
                  type="button"
                  onClick={onReplyClick}
                  title="Reply"
                  style={chipBtnStyle(t)}
                >
                  <Reply size={10} /> Reply
                </button>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  title="Edit your comment"
                  style={chipBtnStyle(t)}
                  disabled={pending}
                >
                  <Pencil size={10} /> Edit
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  onClick={onDelete}
                  title="Delete comment"
                  disabled={pending}
                  style={{
                    ...chipBtnStyle(t),
                    color: t.danger,
                  }}
                >
                  <Trash2 size={10} /> Delete
                </button>
              ) : null}
              {isAgency ? (
                <button
                  type="button"
                  onClick={onToggleResolve}
                  disabled={pending}
                  title={resolved ? 'Mark as unresolved' : 'Mark as resolved'}
                  style={{
                    ...chipBtnStyle(t),
                    color: resolved ? t.textSecondary : t.textPrimary,
                    cursor: pending ? 'not-allowed' : 'pointer',
                    opacity: pending ? 0.5 : 1,
                  }}
                >
                  {pending ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : resolved ? (
                    <RotateCcw size={10} />
                  ) : (
                    <Check size={10} />
                  )}
                  {resolved ? 'Reopen' : 'Resolve'}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function chipBtnStyle(t: ReturnType<typeof getNd>) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    borderRadius: 999,
    border: `1px solid ${t.border}`,
    background: 'transparent',
    color: t.textPrimary,
    fontFamily: editorialFonts.body,
    fontSize: 10,
    fontWeight: 500,
    cursor: 'pointer',
  };
}

interface Thread {
  root: CommentWithAuthor;
  replies: CommentWithAuthor[];
}

function buildThreads(comments: CommentWithAuthor[]): Thread[] {
  const repliesByParent = new Map<string, CommentWithAuthor[]>();
  for (const c of comments) {
    if (c.parent_id) {
      const list = repliesByParent.get(c.parent_id) ?? [];
      list.push(c);
      repliesByParent.set(c.parent_id, list);
    }
  }
  return comments
    .filter((c) => !c.parent_id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((root) => ({
      root,
      replies: (repliesByParent.get(root.id) ?? []).sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      ),
    }));
}

function ThreadView({
  thread,
  t,
  isAgency,
  appSlug,
  frameRowId,
  appId,
  currentUserId,
  mentionables,
}: {
  thread: Thread;
  t: ReturnType<typeof getNd>;
  isAgency: boolean;
  appSlug: string;
  frameRowId: string;
  appId: string;
  currentUserId: string | null;
  mentionables: MentionableProfile[];
}): ReactNode {
  const [replyOpen, setReplyOpen] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <CommentItem
        comment={thread.root}
        t={t}
        isAgency={isAgency}
        appSlug={appSlug}
        currentUserId={currentUserId}
        mentionables={mentionables}
        onReplyClick={() => setReplyOpen((v) => !v)}
      />
      {thread.replies.length > 0 ? (
        <div
          style={{
            marginLeft: 14,
            paddingLeft: 14,
            borderLeft: `2px solid ${t.border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {thread.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              t={t}
              isAgency={isAgency}
              appSlug={appSlug}
              currentUserId={currentUserId}
              mentionables={mentionables}
            />
          ))}
        </div>
      ) : null}
      {replyOpen ? (
        <div
          style={{
            marginLeft: 14,
            paddingLeft: 14,
            borderLeft: `2px solid ${t.border}`,
          }}
        >
          <ReplyForm
            parentId={thread.root.id}
            frameRowId={frameRowId}
            appId={appId}
            appSlug={appSlug}
            mentionables={mentionables}
            t={t}
            onClose={() => setReplyOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

function ReplyForm({
  parentId,
  frameRowId,
  appId,
  appSlug,
  mentionables,
  t,
  onClose,
}: {
  parentId: string;
  frameRowId: string;
  appId: string;
  appSlug: string;
  mentionables: MentionableProfile[];
  t: ReturnType<typeof getNd>;
  onClose: () => void;
}): ReactNode {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    setError(null);
    try {
      const res = await postComment({
        frameRowId,
        appId,
        appSlug,
        body: body.trim(),
        parentId,
      });
      if (res.error) throw new Error(res.error);
      setBody('');
      onClose();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 8,
        borderRadius: 8,
        border: `1px solid ${t.borderVisible}`,
        background: t.surface,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: editorialFonts.mono,
          fontSize: 10,
          color: t.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        <CornerDownRight size={11} /> Reply
      </div>
      <MentionTextarea
        value={body}
        onChange={setBody}
        mentionables={mentionables}
        t={t}
        placeholder="Write a reply… (use @ to mention)"
        rows={2}
        autoFocus
        onSubmitShortcut={(form) => form.requestSubmit()}
        onEscape={onClose}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
        {error ? (
          <span style={{ marginRight: 'auto', fontSize: 11, color: t.danger }}>{error}</span>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: t.textSecondary,
            fontFamily: editorialFonts.body,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          <X size={11} />
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !body.trim()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 6,
            border: 'none',
            background: t.accent,
            color: 'white',
            fontFamily: editorialFonts.body,
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            opacity: pending || !body.trim() ? 0.5 : 1,
          }}
        >
          {pending ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
          Reply
        </button>
      </div>
    </form>
  );
}

/**
 * Textarea with @-mention popup. When the user types `@` followed by a
 * partial query, a small dropdown surfaces filtered profiles. Picking one
 * (click / Enter / Tab) replaces the trigger fragment with `@handle ` so
 * the parser on the server can match it.
 */
function MentionTextarea({
  value,
  onChange,
  mentionables,
  t,
  placeholder,
  rows = 2,
  autoFocus,
  textareaRef,
  onFocus,
  onBlur,
  onSubmitShortcut,
  onEscape,
}: {
  value: string;
  onChange: (next: string) => void;
  mentionables: MentionableProfile[];
  t: ReturnType<typeof getNd>;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  /** Optional external ref so the parent can focus/blur the textarea (e.g. refocus after posting). */
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmitShortcut?: (form: HTMLFormElement) => void;
  onEscape?: () => void;
}): ReactNode {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? internalRef;
  const [trigger, setTrigger] = useState<{ start: number; query: string } | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const filtered = useMemo(() => {
    if (!trigger) return [] as MentionableProfile[];
    const q = trigger.query.toLowerCase();
    return mentionables
      .filter(
        (m) =>
          m.handle.includes(q) ||
          (m.name?.toLowerCase().includes(q) ?? false) ||
          m.email.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [trigger, mentionables]);

  const detectTrigger = (text: string, caret: number): typeof trigger => {
    // Walk backwards from caret to find an `@` that is at the start of the
    // line or preceded by whitespace, with no spaces between it and caret.
    let i = caret - 1;
    while (i >= 0) {
      const ch = text[i];
      if (ch === '@') {
        const prev = i > 0 ? text[i - 1] : ' ';
        if (prev && /\s|[(\[]/.test(prev) || i === 0) {
          return { start: i, query: text.slice(i + 1, caret) };
        }
        return null;
      }
      if (!ch || /\s/.test(ch)) return null;
      i--;
    }
    return null;
  };

  const insertMention = (handle: string): void => {
    const ta = ref.current;
    if (!ta || !trigger) return;
    const before = value.slice(0, trigger.start);
    const after = value.slice(ta.selectionStart);
    const next = `${before}@${handle} ${after}`;
    onChange(next);
    setTrigger(null);
    setActiveIdx(0);
    requestAnimationFrame(() => {
      const pos = before.length + handle.length + 2; // @ + handle + space
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={ref}
        value={value}
        autoFocus={autoFocus}
        rows={rows}
        placeholder={placeholder}
        onFocus={onFocus}
        onBlur={() => {
          // Close popup on blur with a slight delay so click on suggestion can fire.
          setTimeout(() => setTrigger(null), 120);
          onBlur?.();
        }}
        onChange={(e) => {
          const next = e.target.value;
          onChange(next);
          const caret = e.target.selectionStart;
          setTrigger(detectTrigger(next, caret));
          setActiveIdx(0);
        }}
        onKeyDown={(e) => {
          if (trigger && filtered.length > 0) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIdx((i) => (i + 1) % filtered.length);
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length);
              return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              const pick = filtered[activeIdx];
              if (pick) {
                e.preventDefault();
                insertMention(pick.handle);
                return;
              }
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setTrigger(null);
              return;
            }
          }
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            const form = (e.currentTarget.form as HTMLFormElement | null);
            if (form) onSubmitShortcut?.(form);
          }
          if (e.key === 'Escape') onEscape?.();
        }}
        style={{
          width: '100%',
          resize: 'none',
          background: 'transparent',
          fontFamily: editorialFonts.body,
          fontSize: 13,
          color: t.textDisplay,
          border: 'none',
          outline: 'none',
        }}
      />
      {trigger && filtered.length > 0 ? (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 20,
            background: t.black,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            boxShadow: '0 12px 32px -10px rgba(0,0,0,0.35)',
            overflow: 'hidden',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {filtered.map((m, i) => {
            const active = i === activeIdx;
            const display = m.name?.trim() || m.email;
            return (
              <button
                type="button"
                key={m.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(m.handle);
                }}
                onMouseEnter={() => setActiveIdx(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 10px',
                  border: 'none',
                  background: active ? t.surface : 'transparent',
                  color: t.textPrimary,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: editorialFonts.body,
                  fontSize: 13,
                }}
              >
                <UserAvatar
                  name={m.name}
                  email={m.email}
                  avatarUrl={m.avatar_url}
                  size={22}
                  background={t.accentSubtle}
                  color={t.accent}
                />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {display}
                </span>
                <span
                  style={{
                    fontFamily: editorialFonts.mono,
                    fontSize: 10,
                    color: t.textSecondary,
                  }}
                >
                  @{m.handle}
                </span>
                <span
                  style={{
                    fontFamily: editorialFonts.mono,
                    fontSize: 9,
                    color: t.textDisabled,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {m.role === 'agency' ? 'Unicorn' : 'Customer'}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Render a comment body with @handles styled as accent-colored chips. */
function renderCommentBody(body: string, accent: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /@([a-z0-9_.-]+)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) {
      out.push(body.slice(last, m.index));
    }
    out.push(
      <span
        key={`m-${key++}`}
        style={{
          color: accent,
          fontWeight: 500,
        }}
      >
        @{m[1]}
      </span>,
    );
    last = re.lastIndex;
  }
  if (last < body.length) out.push(body.slice(last));
  return out;
}
