'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentProfile, getMentionableProfilesForApp } from '@/lib/queries';
import { getSupabaseAdminClient, getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Insert a new comment and fan out @mention notifications for any profile
 * handles found in the body. The DB trigger already creates the generic
 * `comment` and `reply` notifications; this action adds `mention` rows
 * for explicit @handles.
 */
export async function postComment(input: {
  frameRowId: string;
  appId: string;
  appSlug: string;
  body: string;
  parentId?: string | null;
  pinX?: number | null;
  pinY?: number | null;
  pinW?: number | null;
  pinH?: number | null;
}): Promise<{ ok?: true; error?: string; commentId?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: 'Not signed in.' };

  const body = input.body.trim();
  if (!body) return { error: 'Empty comment.' };

  const supabase = await getSupabaseServerClient();
  const { data: inserted, error } = await supabase
    .from('comments')
    .insert({
      frame_id: input.frameRowId,
      author_id: profile.id,
      parent_id: input.parentId ?? null,
      body,
      pin_x: input.pinX ?? null,
      pin_y: input.pinY ?? null,
      pin_w: input.pinW ?? null,
      pin_h: input.pinH ?? null,
    })
    .select('id, frame_id')
    .single();
  if (error || !inserted) {
    return { error: error?.message ?? 'Failed to post comment.' };
  }

  // Parse explicit @handles and add 'mention' notification rows for each
  // matched profile. We use the admin client so we can insert into
  // notifications without the user-scoped RLS getting in the way.
  const mentionedHandles = parseMentionHandles(body);
  if (mentionedHandles.length > 0) {
    const audience = await getMentionableProfilesForApp(input.appId);
    const matched = audience.filter(
      (p) =>
        mentionedHandles.includes(p.handle) &&
        p.id !== profile.id, // never ping the author
    );
    if (matched.length > 0) {
      const admin = getSupabaseAdminClient();
      await admin.from('notifications').insert(
        matched.map((m) => ({
          user_id: m.id,
          kind: 'mention' as const,
          comment_id: inserted.id,
          frame_id: inserted.frame_id,
          app_id: input.appId,
          actor_id: profile.id,
        })),
      );
    }
  }

  revalidatePath(`/app/${input.appSlug}`);
  return { ok: true, commentId: inserted.id };
}

/**
 * Edit an existing comment. Only the author can edit their own comment
 * (RLS enforces this anyway, but we check up front for a friendlier error).
 * Body changes don't re-fan-out @mention notifications — we treat edits as
 * typo fixes rather than re-pings.
 */
export async function updateComment(input: {
  commentId: string;
  body: string;
  appSlug: string;
}): Promise<{ ok?: true; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: 'Not signed in.' };

  const body = input.body.trim();
  if (!body) return { error: 'Comment cannot be empty.' };
  if (body.length > 9999) return { error: 'Comment is too long (max 10k chars).' };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from('comments')
    .update({ body })
    .eq('id', input.commentId)
    .eq('author_id', profile.id);
  if (error) return { error: error.message };

  revalidatePath(`/app/${input.appSlug}`);
  return { ok: true };
}

/**
 * Delete a comment. Author can always delete their own; agency can delete
 * anyone's. RLS allows both via the `comments_author_delete` policy.
 * Cascades to child replies via the comments.parent_id FK on delete cascade.
 */
export async function deleteComment(input: {
  commentId: string;
  appSlug: string;
}): Promise<{ ok?: true; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: 'Not signed in.' };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', input.commentId);
  if (error) return { error: error.message };

  revalidatePath(`/app/${input.appSlug}`);
  return { ok: true };
}

/** Extract unique lowercase handles from a comment body's @mentions. */
function parseMentionHandles(body: string): string[] {
  const re = /@([a-z0-9_.-]+)/gi;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    out.add(m[1]!.toLowerCase());
  }
  return Array.from(out);
}

/**
 * Mark a comment as resolved (or unresolve). Agency-only — customers can't
 * close out feedback on their own. Resolved comments stay queryable but
 * are hidden by default in the UI to keep the active list focused.
 */
export async function setCommentResolved(input: {
  commentId: string;
  resolved: boolean;
  appSlug: string;
}): Promise<{ ok?: true; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: 'Not signed in.' };
  if (profile.role !== 'agency') {
    return { error: 'Only agency members can resolve feedback.' };
  }

  const supabase = await getSupabaseServerClient();
  // .select() so we can tell the difference between "update succeeded" and
  // "RLS filtered the row out and 0 rows changed" — the latter returns no
  // error from Supabase but means the action effectively failed.
  const { data, error } = await supabase
    .from('comments')
    .update(
      input.resolved
        ? { resolved_at: new Date().toISOString(), resolved_by: profile.id }
        : { resolved_at: null, resolved_by: null },
    )
    .eq('id', input.commentId)
    .select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: 'Could not update this comment. It may have been deleted, or you may not have permission.' };
  }

  revalidatePath(`/app/${input.appSlug}`);
  return { ok: true };
}
