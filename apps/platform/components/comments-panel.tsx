'use client';

import { Loader2, MessageCircle, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { UserAvatar } from '@/components/user-avatar';
import { editorialFonts, getNd } from '@/lib/tokens';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { CommentWithAuthor } from '@/lib/comments';

export function CommentsPanel({
  frameRowId,
  comments,
}: {
  frameRowId: string;
  comments: CommentWithAuthor[];
}): ReactNode {
  const router = useRouter();
  const { theme } = useTheme();
  const t = getNd(theme);
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in.');
      const { error: err } = await supabase.from('comments').insert({
        frame_id: frameRowId,
        author_id: user.id,
        body: body.trim(),
      });
      if (err) throw err;
      setBody('');
      router.refresh();
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
        width: 320,
        flexShrink: 0,
        flexDirection: 'column',
        borderLeft: `1px solid ${t.border}`,
        background: t.black,
        fontFamily: editorialFonts.body,
      }}
    >
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
          {comments.length}
        </span>
      </div>

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
        {comments.length === 0 ? (
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
              Start a discussion
            </p>
            <p style={{ margin: 0, maxWidth: '12rem', fontSize: 12, color: t.textSecondary }}>
              Drop a comment for the agency or customer to see.
            </p>
          </div>
        ) : (
          comments.map((c) => <CommentItem key={c.id} comment={c} t={t} />)
        )}
      </div>

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
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            rows={2}
            placeholder="Add a comment…"
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
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
              }
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            {error ? (
              <span style={{ marginRight: 'auto', fontSize: 11, color: t.danger }}>{error}</span>
            ) : null}
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
              Post
            </button>
          </div>
        </div>
      </form>
    </aside>
  );
}

function CommentItem({
  comment,
  t,
}: {
  comment: CommentWithAuthor;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  const date = new Date(comment.created_at);
  const dateLabel = isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <UserAvatar
        name={comment.author.name}
        email={comment.author.email}
        avatarUrl={comment.author.avatar_url}
        size={28}
        background={t.accentSubtle}
        color={t.accent}
      />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
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
        </div>
        <p
          style={{
            margin: '4px 0 0',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: 14,
            color: t.textPrimary,
          }}
        >
          {comment.body}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 10, color: t.textDisabled }}>{dateLabel}</p>
      </div>
    </div>
  );
}
