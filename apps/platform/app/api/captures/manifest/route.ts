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

  const { data: frameRows, error: framesErr } = await admin
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

  const manifest: ExportedManifest = {
    app: { id: app.id, slug: app.slug, platform: app.platform },
    flows: Array.from(flowMap.values()),
    frames,
  };
  return NextResponse.json(manifest);
}
