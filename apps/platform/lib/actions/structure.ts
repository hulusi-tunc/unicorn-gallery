'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/queries';
import { getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Structure edits made in the gallery: renaming, reordering, re-parenting,
 * moving a screen between flows, hiding one, and inventing a flow that no
 * capture produced.
 *
 * None of it touches `frames`. Every change is a row in `flow_overrides` /
 * `frame_overrides` that is applied when the manifest is read, which is what
 * lets an edit survive the next capture push — see the note in db/schema.sql.
 */

type Result = { ok?: true; error?: string };

const MAX_NAME = 120;

async function gate(
  slug: string,
): Promise<{ ok: true; appId: string; userId: string } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'agency') {
    return { ok: false, error: 'Only studio members can edit a project’s structure.' };
  }
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from('apps').select('id').eq('slug', slug).maybeSingle();
  if (!data) return { ok: false, error: 'Project not found.' };
  return { ok: true, appId: data.id, userId: profile.id };
}

function done(slug: string): Result {
  // 'layout' so the editor at /app/<slug>/organise refreshes too — a plain
  // path revalidation only covers that exact route, which left the board
  // showing stale names right after writing them.
  revalidatePath(`/app/${slug}`, 'layout');
  return { ok: true };
}

function cleanName(name: string): { ok: true; name: string } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { ok: false, error: 'Name cannot be empty.' };
  if (trimmed.length > MAX_NAME) {
    return { ok: false, error: `Name is too long (max ${MAX_NAME} chars).` };
  }
  return { ok: true, name: trimmed };
}

/**
 * Upserts are how every edit lands: a flow or frame may have no override row
 * yet, and the caller should not have to care which.
 */
async function upsertFlow(
  appId: string,
  userId: string,
  flowId: string,
  patch: Record<string, unknown>,
): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from('flow_overrides').upsert(
    { app_id: appId, flow_id: flowId, ...patch, updated_by: userId, updated_at: new Date().toISOString() },
    { onConflict: 'app_id,flow_id' },
  );
  return error?.message ?? null;
}

async function upsertFrame(
  appId: string,
  userId: string,
  flowId: string,
  frameId: string,
  patch: Record<string, unknown>,
): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from('frame_overrides').upsert(
    {
      app_id: appId,
      flow_id: flowId,
      frame_id: frameId,
      ...patch,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'app_id,flow_id,frame_id' },
  );
  return error?.message ?? null;
}

/* ── naming ──────────────────────────────────────────────────────────────── */

export async function renameFlow(slug: string, flowId: string, name: string): Promise<Result> {
  const g = await gate(slug);
  if (!g.ok) return { error: g.error };
  const n = cleanName(name);
  if (!n.ok) return { error: n.error };
  const err = await upsertFlow(g.appId, g.userId, flowId, { name: n.name });
  return err ? { error: err } : done(slug);
}

export async function renameFrame(
  slug: string,
  flowId: string,
  frameId: string,
  name: string,
): Promise<Result> {
  const g = await gate(slug);
  if (!g.ok) return { error: g.error };
  const n = cleanName(name);
  if (!n.ok) return { error: n.error };
  const err = await upsertFrame(g.appId, g.userId, flowId, frameId, { name: n.name });
  return err ? { error: err } : done(slug);
}

/* ── hiding ──────────────────────────────────────────────────────────────── */

/**
 * Delete is deliberately soft. The frame row stays, so its comments, its
 * capture history and every older version that contained it are untouched —
 * and the screen can come back without re-capturing it.
 */
export async function setFrameHidden(
  slug: string,
  flowId: string,
  frameId: string,
  hidden: boolean,
): Promise<Result> {
  const g = await gate(slug);
  if (!g.ok) return { error: g.error };
  const err = await upsertFrame(g.appId, g.userId, flowId, frameId, { hidden });
  return err ? { error: err } : done(slug);
}

export async function setFlowHidden(
  slug: string,
  flowId: string,
  hidden: boolean,
): Promise<Result> {
  const g = await gate(slug);
  if (!g.ok) return { error: g.error };
  const err = await upsertFlow(g.appId, g.userId, flowId, { hidden });
  return err ? { error: err } : done(slug);
}

/* ── structure ───────────────────────────────────────────────────────────── */

export async function createFlow(
  slug: string,
  name: string,
  parentFlowId?: string | null,
): Promise<{ ok?: true; flowId?: string; error?: string }> {
  const g = await gate(slug);
  if (!g.ok) return { error: g.error };
  const n = cleanName(name);
  if (!n.ok) return { error: n.error };

  const supabase = await getSupabaseServerClient();
  // A web-made flow needs an id no capture will collide with. `web-` plus a
  // slug of the name, then a counter if that is taken — readable in the URL
  // and in the manifest, unlike a uuid.
  const base = `web-${n.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)}`;
  const { data: taken } = await supabase
    .from('flow_overrides')
    .select('flow_id')
    .eq('app_id', g.appId)
    .like('flow_id', `${base}%`);
  const used = new Set((taken ?? []).map((r) => (r as { flow_id: string }).flow_id));
  let flowId = base;
  for (let i = 2; used.has(flowId); i++) flowId = `${base}-${i}`;

  const err = await upsertFlow(g.appId, g.userId, flowId, {
    name: n.name,
    created_on_web: true,
    parent_flow_id: parentFlowId ?? null,
    clear_parent: !parentFlowId,
  });
  if (err) return { error: err };
  revalidatePath(`/app/${slug}`, 'layout');
  return { ok: true, flowId };
}

export async function setFlowParent(
  slug: string,
  flowId: string,
  parentFlowId: string | null,
): Promise<Result> {
  const g = await gate(slug);
  if (!g.ok) return { error: g.error };
  if (parentFlowId === flowId) return { error: 'A flow cannot sit inside itself.' };
  const err = await upsertFlow(g.appId, g.userId, flowId, {
    parent_flow_id: parentFlowId,
    clear_parent: parentFlowId === null,
  });
  return err ? { error: err } : done(slug);
}

/* ── ordering ────────────────────────────────────────────────────────────── */

/** A frame's identity as captured — what the override tables key on. */
export interface FrameKey {
  flowId: string;
  frameId: string;
}

/**
 * Write an explicit position for every screen in the list.
 *
 * Whole-list rather than just the dragged item: capture-assigned positions can
 * be sparse or absent, so nudging one index leaves an order nobody can predict.
 * Rewriting all of them makes what you see what is stored.
 */
export async function reorderFrames(slug: string, ordered: FrameKey[]): Promise<Result> {
  const g = await gate(slug);
  if (!g.ok) return { error: g.error };
  if (ordered.length === 0) return { ok: true };

  const supabase = await getSupabaseServerClient();
  const rows = ordered.map((k, i) => ({
    app_id: g.appId,
    flow_id: k.flowId,
    frame_id: k.frameId,
    position: i,
    updated_by: g.userId,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('frame_overrides')
    .upsert(rows, { onConflict: 'app_id,flow_id,frame_id' });
  return error ? { error: error.message } : done(slug);
}

export async function reorderFlows(slug: string, orderedFlowIds: string[]): Promise<Result> {
  const g = await gate(slug);
  if (!g.ok) return { error: g.error };
  if (orderedFlowIds.length === 0) return { ok: true };

  const supabase = await getSupabaseServerClient();
  const rows = orderedFlowIds.map((flowId, i) => ({
    app_id: g.appId,
    flow_id: flowId,
    position: i,
    updated_by: g.userId,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('flow_overrides')
    .upsert(rows, { onConflict: 'app_id,flow_id' });
  return error ? { error: error.message } : done(slug);
}

/**
 * Move a screen into another flow and place it at `index` there.
 *
 * The screen keeps its captured identity — the override records where it now
 * shows, not a new frame — so its comments and history travel with it.
 */
export async function moveFrameToFlow(
  slug: string,
  frame: FrameKey,
  toFlowId: string,
  destination: FrameKey[],
): Promise<Result> {
  const g = await gate(slug);
  if (!g.ok) return { error: g.error };

  const err = await upsertFrame(g.appId, g.userId, frame.flowId, frame.frameId, {
    move_to_flow_id: toFlowId,
  });
  if (err) return { error: err };
  // The destination's order is rewritten in the same breath, so the dropped
  // screen lands exactly where it was let go rather than at the end.
  if (destination.length > 0) return reorderFrames(slug, destination);
  return done(slug);
}

/** Drop every override for a project — the way back to what capture pushed. */
export async function resetStructure(slug: string): Promise<Result> {
  const g = await gate(slug);
  if (!g.ok) return { error: g.error };
  const supabase = await getSupabaseServerClient();
  const [a, b] = await Promise.all([
    supabase.from('frame_overrides').delete().eq('app_id', g.appId),
    supabase.from('flow_overrides').delete().eq('app_id', g.appId),
  ]);
  const error = a.error ?? b.error;
  return error ? { error: error.message } : done(slug);
}
