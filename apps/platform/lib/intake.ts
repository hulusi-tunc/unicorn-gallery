import 'server-only';
import { getSupabaseAdminClient } from './supabase/server';
import type { ManifestSnapshot } from './db';

const SCREENSHOTS_BUCKET = 'screenshots';

export interface IntakeResult {
  appId: string;
  appSlug: string;
  buildId: string;
  buildSha: string;
  framesCount: number;
}

export interface IntakeError {
  status: number;
  message: string;
}

/**
 * Authenticate a project token and return the matching app, or an error.
 * Uses service role (bypasses RLS) since the CLI is unauthenticated as a user.
 */
export async function findAppByToken(
  token: string,
): Promise<{ id: string; slug: string; platform: string } | IntakeError> {
  if (!token || !token.trim()) {
    return { status: 401, message: 'Missing project token.' };
  }
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('apps')
    .select('id, slug, platform, project_token')
    .eq('project_token', token.trim())
    .maybeSingle();
  if (error) return { status: 500, message: error.message };
  if (!data) return { status: 403, message: 'Invalid project token.' };
  return { id: data.id, slug: data.slug, platform: data.platform };
}

/**
 * Persist an uploaded capture: storage upload, build insert, frame upsert,
 * preview-image refresh.
 *
 * `replace=true` wipes the app's existing frames + builds first, so the
 * incoming manifest becomes the new source of truth. Used by capture's
 * "Push to web" sync flow.
 */
export async function ingestCapture({
  appId,
  appSlug,
  manifest,
  screenshots,
  replace,
}: {
  appId: string;
  appSlug: string;
  manifest: ManifestSnapshot;
  /** Map from manifest image path → PNG bytes */
  screenshots: Map<string, ArrayBuffer>;
  replace?: boolean;
}): Promise<IntakeResult | IntakeError> {
  const admin = getSupabaseAdminClient();

  if (replace) {
    // Wipe everything for this app — frames cascade to comments. We keep
    // builds.is_visible=true on the new build that follows so the app
    // doesn't blink to "empty" mid-push for any concurrent reader.
    const { error: delFramesErr } = await admin
      .from('frames')
      .delete()
      .eq('app_id', appId);
    if (delFramesErr) {
      return { status: 500, message: `Replace failed (frames): ${delFramesErr.message}` };
    }
    const { error: delBuildsErr } = await admin
      .from('builds')
      .delete()
      .eq('app_id', appId);
    if (delBuildsErr) {
      return { status: 500, message: `Replace failed (builds): ${delBuildsErr.message}` };
    }
  }

  // 1. Upload each screenshot to Storage and rewrite manifest URLs.
  const newFlows: ManifestSnapshot['flows'] = [];
  let uploaded = 0;
  for (const flow of manifest.flows) {
    const newFrames: typeof flow.frames = [];
    for (const frame of flow.frames) {
      const bytes = screenshots.get(frame.image);
      if (!bytes) {
        return {
          status: 400,
          message: `Manifest references "${frame.image}" but no screenshot for that path was uploaded.`,
        };
      }
      const storagePath = `${appId}/${manifest.buildSha}/${flow.id}/${frame.id}.png`;
      const { error: upErr } = await admin.storage
        .from(SCREENSHOTS_BUCKET)
        .upload(storagePath, bytes, { contentType: 'image/png', upsert: true });
      if (upErr) return { status: 500, message: `Storage upload failed: ${upErr.message}` };
      const { data: pub } = admin.storage.from(SCREENSHOTS_BUCKET).getPublicUrl(storagePath);
      newFrames.push({ ...frame, image: pub.publicUrl });
      uploaded++;
    }
    newFlows.push({ ...flow, frames: newFrames });
  }

  const rewritten: ManifestSnapshot = { ...manifest, flows: newFlows };

  // 2. Upsert build by (app_id, sha).
  const { data: existing } = await admin
    .from('builds')
    .select('id')
    .eq('app_id', appId)
    .eq('sha', manifest.buildSha)
    .maybeSingle();

  let buildId: string;
  if (existing) {
    const { error: updErr } = await admin
      .from('builds')
      .update({
        manifest: rewritten,
        captured_at: manifest.capturedAt,
        platform: manifest.platform,
      })
      .eq('id', existing.id);
    if (updErr) return { status: 500, message: `Build update failed: ${updErr.message}` };
    buildId = existing.id;
  } else {
    // Assign next per-app version number. Upload chunking goes through the
    // `existing` branch above for chunks 2+, so version is only stamped once.
    const { data: maxRow } = await admin
      .from('builds')
      .select('version')
      .eq('app_id', appId)
      .order('version', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (maxRow?.version ?? 0) + 1;

    const { data: build, error: insErr } = await admin
      .from('builds')
      .insert({
        app_id: appId,
        sha: manifest.buildSha,
        captured_at: manifest.capturedAt,
        platform: manifest.platform,
        manifest: rewritten,
        is_visible: true,
        version: nextVersion,
        message: manifest.message ?? null,
      })
      .select('id')
      .single();
    if (insErr) return { status: 500, message: `Build insert failed: ${insErr.message}` };
    buildId = build.id;
  }

  // 2b. Snapshot per-build frame state into `frame_versions` with diff vs
  // the previous build. Upsert per-frame so chunked uploads accumulate
  // (each chunk fills in more rows for the same build_id).
  const { data: prevBuild } = await admin
    .from('builds')
    .select('id')
    .eq('app_id', appId)
    .neq('id', buildId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevMap = new Map<string, { image_url: string; frame_name: string }>();
  if (prevBuild) {
    const { data: prevRows } = await admin
      .from('frame_versions')
      .select('flow_id, frame_id, image_url, frame_name')
      .eq('build_id', prevBuild.id);
    for (const r of prevRows ?? []) {
      prevMap.set(`${r.flow_id}::${r.frame_id}`, {
        image_url: r.image_url,
        frame_name: r.frame_name,
      });
    }
  }

  for (const flow of newFlows) {
    for (const frame of flow.frames) {
      const prev = prevMap.get(`${flow.id}::${frame.id}`);
      let change_kind: 'added' | 'updated' | 'renamed' | 'unchanged';
      if (!prev) change_kind = 'added';
      else if (prev.image_url !== frame.image) change_kind = 'updated';
      else if (prev.frame_name !== frame.name) change_kind = 'renamed';
      else change_kind = 'unchanged';

      const { error: fvErr } = await admin.from('frame_versions').upsert(
        {
          build_id: buildId,
          app_id: appId,
          flow_id: flow.id,
          frame_id: frame.id,
          flow_name: flow.name,
          frame_name: frame.name,
          image_url: frame.image,
          change_kind,
        },
        { onConflict: 'build_id,flow_id,frame_id' },
      );
      if (fvErr) return { status: 500, message: `frame_versions upsert: ${fvErr.message}` };
    }
  }

  // 3. Refresh app preview image (first flow's first frame).
  const firstFrame = newFlows[0]?.frames[0];
  if (firstFrame) {
    await admin
      .from('apps')
      .update({ preview_image_url: firstFrame.image })
      .eq('id', appId);
  }

  // 4. Upsert frame rows so comments persist across builds.
  // The flow's index in `newFlows` is the display order; same for frames.
  // If the manifest carries explicit positions we use those, otherwise we
  // fall back to the array index so older clients still get sane ordering.
  for (let fi = 0; fi < newFlows.length; fi++) {
    const flow = newFlows[fi];
    if (!flow) continue;
    const flowPos = flow.position ?? fi;
    for (let i = 0; i < flow.frames.length; i++) {
      const frame = flow.frames[i];
      if (!frame) continue;
      const framePos = frame.position ?? i;
      const { error: frErr } = await admin.from('frames').upsert(
        {
          app_id: appId,
          flow_id: flow.id,
          frame_id: frame.id,
          flow_name: flow.name,
          frame_name: frame.name,
          parent_flow_id: flow.parentFlowId ?? null,
          flow_position: flowPos,
          frame_position: framePos,
          latest_image_url: frame.image,
          latest_build_id: buildId,
        },
        { onConflict: 'app_id,flow_id,frame_id' },
      );
      if (frErr) return { status: 500, message: `Frame upsert failed: ${frErr.message}` };
    }
  }

  return {
    appId,
    appSlug,
    buildId,
    buildSha: manifest.buildSha,
    framesCount: uploaded,
  };
}
