import { NextResponse, type NextRequest } from 'next/server';
import { findAppByToken } from '@/lib/intake';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ExportedFlow {
  id: string;
  name: string;
  parentFlowId?: string;
  position?: number;
  autoRoute?: string;
}

interface ExportedFrame {
  id: string;
  flow_id: string;
  flow_name: string;
  frame_name: string;
  latest_image_url: string | null;
  flow_position?: number | null;
  frame_position?: number | null;
  created_at: string;
}

interface ExportedManifest {
  app: { id: string; slug: string; platform: string };
  flows: ExportedFlow[];
  frames: ExportedFrame[];
}

/**
 * Pull the gallery's current state for a project as a remote-only manifest.
 *
 * Capture (desktop) calls this when a project has no local manifest, or
 * when the user clicks "Sync from gallery". Frames come back with their
 * Supabase Storage URLs — Capture treats them as remote refs and lazily
 * downloads the bytes when a frame is actually viewed.
 *
 * Auth: same project_token bearer the upload endpoint uses, so the same
 * Capture install has automatic read access to its own project.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth.trim();

  const app = await findAppByToken(token);
  if ('status' in app) {
    return NextResponse.json({ error: app.message }, { status: app.status });
  }

  const admin = getSupabaseAdminClient();

  // Scope the pull to the latest version. After the version-history rewrite
  // we no longer delete orphan frames on replace pushes — old versions stay
  // in `frames` so the gallery's version switcher can render them — so a
  // raw `select * where app_id` would return the union of every push ever
  // made and pollute the Capture-side sidebar with ghost flows. Use the
  // latest build's `frame_versions` as the source of truth for "current".
  const { data: latestBuild } = await admin
    .from('builds')
    .select('id, flow_tree')
    .eq('app_id', app.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentKeys = new Set<string>();
  if (latestBuild) {
    const { data: fvRows } = await admin
      .from('frame_versions')
      .select('flow_id, frame_id')
      .eq('build_id', latestBuild.id);
    for (const r of (fvRows ?? []) as Array<{ flow_id: string; frame_id: string }>) {
      currentKeys.add(`${r.flow_id}::${r.frame_id}`);
    }
  }

  const { data: frameRowsAll, error: framesErr } = await admin
    .from('frames')
    .select(
      'flow_id, frame_id, flow_name, frame_name, parent_flow_id, flow_position, frame_position, latest_image_url, created_at',
    )
    .eq('app_id', app.id)
    .order('flow_position', { ascending: true, nullsFirst: false })
    .order('flow_id', { ascending: true })
    .order('frame_position', { ascending: true, nullsFirst: false })
    .order('frame_id', { ascending: true });

  if (framesErr) {
    return NextResponse.json({ error: framesErr.message }, { status: 500 });
  }

  // Filter to the current version. If `frame_versions` is empty (pre-migration
  // legacy data) fall back to returning every frame so the endpoint doesn't
  // start handing Capture an empty manifest.
  const frameRows =
    currentKeys.size > 0
      ? (frameRowsAll ?? []).filter((row) =>
          currentKeys.has(
            `${(row as { flow_id: string }).flow_id}::${(row as { frame_id: string }).frame_id}`,
          ),
        )
      : frameRowsAll;

  // Collapse rows into the flow tree + frame list. The gallery doesn't
  // store autoRoute on frames (it's a capture-side bridge concept), so
  // we skip it here — the desktop will keep its existing autoRoute hints
  // intact when merging.
  const flowMap = new Map<string, ExportedFlow>();
  const frames: ExportedFrame[] = [];
  for (const row of (frameRows ?? []) as Array<{
    flow_id: string;
    frame_id: string;
    flow_name: string;
    frame_name: string;
    parent_flow_id: string | null;
    flow_position: number | null;
    frame_position: number | null;
    latest_image_url: string | null;
    created_at: string;
  }>) {
    if (!flowMap.has(row.flow_id)) {
      flowMap.set(row.flow_id, {
        id: row.flow_id,
        name: row.flow_name,
        parentFlowId: row.parent_flow_id ?? undefined,
        position: row.flow_position ?? undefined,
      });
    }
    frames.push({
      id: row.frame_id,
      flow_id: row.flow_id,
      flow_name: row.flow_name,
      frame_name: row.frame_name,
      latest_image_url: row.latest_image_url,
      flow_position: row.flow_position,
      frame_position: row.frame_position,
      created_at: row.created_at,
    });
  }

  // Inject frameless container flows (e.g. "Site public" holding only
  // sub-flows) from the latest build's flow_tree. The frames-derived map
  // can't represent them, and without the parent rows Capture renders
  // every sub-flow flat at the top level.
  const treeMeta = ((latestBuild as { flow_tree?: unknown } | null)?.flow_tree ?? []) as Array<{
    id: string;
    name: string;
    parentFlowId: string | null;
    position: number | null;
  }>;
  if (treeMeta.length > 0) {
    const metaById = new Map(treeMeta.map((m) => [m.id, m]));
    for (const f of Array.from(flowMap.values())) {
      let pid = f.parentFlowId;
      while (pid && !flowMap.has(pid)) {
        const m = metaById.get(pid);
        if (!m) break;
        flowMap.set(pid, {
          id: m.id,
          name: m.name,
          parentFlowId: m.parentFlowId ?? undefined,
          position: m.position ?? undefined,
        });
        pid = m.parentFlowId ?? undefined;
      }
    }
  }

  // Order flows the way the desktop should display them: by position, with
  // frameless containers inheriting the smallest position among their
  // descendants (old builds stored null positions for containers). Capture
  // preserves import order in its local flow list, and push re-derives
  // positions from that order — so a sensible order here round-trips.
  const flowsOut = Array.from(flowMap.values());
  const childrenOf = new Map<string, ExportedFlow[]>();
  for (const f of flowsOut) {
    if (!f.parentFlowId) continue;
    const list = childrenOf.get(f.parentFlowId) ?? [];
    list.push(f);
    childrenOf.set(f.parentFlowId, list);
  }
  const effMemo = new Map<string, number>();
  const eff = (f: ExportedFlow): number => {
    const hit = effMemo.get(f.id);
    if (hit !== undefined) return hit;
    effMemo.set(f.id, Number.POSITIVE_INFINITY);
    let p = f.position ?? Number.POSITIVE_INFINITY;
    for (const c of childrenOf.get(f.id) ?? []) p = Math.min(p, eff(c));
    effMemo.set(f.id, p);
    return p;
  };
  flowsOut.sort((a, b) => eff(a) - eff(b));

  const manifest: ExportedManifest = {
    app: { id: app.id, slug: app.slug, platform: app.platform },
    flows: flowsOut,
    frames,
  };
  return NextResponse.json(manifest);
}
