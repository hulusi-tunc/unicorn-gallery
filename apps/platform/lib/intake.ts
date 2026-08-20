import 'server-only';
import { getSupabaseAdminClient } from './supabase/server';
import { R2_PUBLIC_PREFIX, r2PublicUrl, r2Put } from './r2';
import type { ManifestSnapshot } from './db';

export interface IntakeResult {
  appId: string;
  appSlug: string;
  buildId: string;
  buildSha: string;
  framesCount: number;
  /**
   * Per-frame public URLs for every frame that was successfully stored.
   * Surfaced so the Capture desktop client can store `remoteImageUrl`
   * locally and safely evict its local PNG cache after a successful push.
   * Keyed by the manifest-side `frame.id` so the client can match without
   * recomputing storage paths.
   */
  frames: Array<{ frameId: string; url: string }>;
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
    .select('id, slug, platform, project_token, archived_at')
    .eq('project_token', token.trim())
    .maybeSingle();
  if (error) return { status: 500, message: error.message };
  if (!data) return { status: 403, message: 'Invalid project token.' };
  if (data.archived_at) {
    return {
      status: 410,
      message:
        'This project is archived. Restore it on the gallery before pushing snaps.',
    };
  }
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
  screenshots: Map<string, { bytes: ArrayBuffer; mimeType: string }>;
  replace?: boolean;
}): Promise<IntakeResult | IntakeError> {
  const admin = getSupabaseAdminClient();

  // Every push is an immutable version. We never delete `builds` (history)
  // or orphan `frames` (their comments). Frames that don't appear in the
  // incoming manifest stop being part of the latest version but stay in
  // the DB so the version switcher can render them in their original
  // version. `replace` is now a soft signal — it controls whether the
  // new build becomes the "latest" snapshot for the app's default view,
  // not whether to destroy data.

  // 1. Upload each screenshot to Storage and rewrite manifest URLs.
  // Past versions (frame.versions[]) ride alongside — each gets its own
  // storage path so reviewers can scrub through capture history.
  const newFlows: ManifestSnapshot['flows'] = [];
  let uploaded = 0;
  // Collected per-frame URLs returned to the caller so Capture can populate
  // `remoteImageUrl` on each snap and safely evict its local PNG cache.
  // Choose the storage file extension from the per-part mimeType so WebP
  // recodes from the new Capture client land as `.webp` (and serve with
  // the right Content-Type). PNG remains the default for older clients.
  const extForMime = (mime: string): string =>
    mime === 'image/webp' ? 'webp' : mime === 'image/jpeg' ? 'jpg' : 'png';

  const frameUrls: Array<{ frameId: string; url: string }> = [];
  // A frame whose `image` is already one of OUR public storage URLs is a
  // re-registration of a gallery-synced frame (Capture pulled it via Sync
  // and is pushing it back as part of the full manifest). No bytes ride
  // along — reuse the URL as-is so the frame stays part of the new build.
  // Recognise both new R2 URLs and legacy Supabase URLs so re-synced
  // manifests from Capture (which cache remoteImageUrl) skip re-upload.
  const supabasePrefix = `${process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? ''}/storage/v1/object/public/`;
  const isStorageRef = (image: string): boolean =>
    image.startsWith(R2_PUBLIC_PREFIX + '/') ||
    (supabasePrefix.length > 40 && image.startsWith(supabasePrefix));
  for (const flow of manifest.flows) {
    const newFrames: typeof flow.frames = [];
    for (const frame of flow.frames) {
      if (isStorageRef(frame.image)) {
        frameUrls.push({ frameId: frame.id, url: frame.image });
        newFrames.push({ ...frame, versions: undefined });
        continue;
      }
      const screenshot = screenshots.get(frame.image);
      if (!screenshot) {
        return {
          status: 400,
          message: `Manifest references "${frame.image}" but no screenshot for that path was uploaded.`,
        };
      }
      const ext = extForMime(screenshot.mimeType);
      const storagePath = `${appId}/${manifest.buildSha}/${flow.id}/${frame.id}.${ext}`;
      try {
        await r2Put(storagePath, screenshot.bytes, screenshot.mimeType);
      } catch (e) {
        return { status: 500, message: `Storage upload failed: ${(e as Error).message}` };
      }
      const pub = r2PublicUrl(storagePath);
      frameUrls.push({ frameId: frame.id, url: pub });

      // Optional motion clip riding alongside the screenshot. A missing
      // multipart part is skipped silently (the static frame still lands);
      // an upload error likewise degrades to screenshot-only.
      let videoUrl: string | undefined;
      if (frame.video && isStorageRef(frame.video)) {
        // Clip already uploaded direct-to-storage by Capture — the manifest
        // carries its public URL instead of bytes. Reuse as-is.
        videoUrl = frame.video;
      } else if (frame.video) {
        const clip = screenshots.get(frame.video);
        if (clip) {
          const vExt = clip.mimeType === 'video/webm' ? 'webm' : 'mp4';
          const vPath = `${appId}/${manifest.buildSha}/${flow.id}/${frame.id}-motion.${vExt}`;
          try {
            await r2Put(vPath, clip.bytes, clip.mimeType || 'video/mp4');
            videoUrl = r2PublicUrl(vPath);
            uploaded++;
          } catch {
            // Degrade to screenshot-only — same as before.
          }
        }
      }
      // Upload past versions (newest-first in the array; idx=1+ since
      // idx=0 is the latest above). Missing PNGs in the multipart body
      // are skipped silently — better to lose history than reject the
      // whole push.
      const newVersions: NonNullable<typeof frame.versions> = [];
      const inputVersions = frame.versions ?? [];
      for (let vi = 0; vi < inputVersions.length; vi++) {
        const v = inputVersions[vi]!;
        const vScreenshot = screenshots.get(v.image);
        if (!vScreenshot) continue;
        const vExt = extForMime(vScreenshot.mimeType);
        const vPath = `${appId}/${manifest.buildSha}/${flow.id}/${frame.id}-v${vi + 1}.${vExt}`;
        try {
          await r2Put(vPath, vScreenshot.bytes, vScreenshot.mimeType);
        } catch {
          // Don't fail the whole push for a version upload error — the
          // latest image still made it.
          continue;
        }
        newVersions.push({ image: r2PublicUrl(vPath), capturedAt: v.capturedAt });
        uploaded++;
      }
      newFrames.push({
        ...frame,
        image: pub,
        video: videoUrl,
        versions: newVersions.length > 0 ? newVersions : undefined,
      });
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

  // 2a. Persist the flow hierarchy — INCLUDING empty grouping flows that carry
  // no frames of their own (e.g. "ADMIN" holding only sub-flows). The
  // frames-derived tree can't represent a frameless container, so without this
  // its children would flatten to the top level. Accumulate across chunked
  // batches of the same build (each batch carries its frames' ancestors).
  {
    // Fall back to the manifest array index when the client sends no explicit
    // positions — same rule the frames writer uses (`flow.position ?? fi`) so
    // frameless containers sort alongside their siblings instead of dropping
    // to the bottom with a null position.
    const incoming = rewritten.flows.map((f, fi) => ({
      id: f.id,
      name: f.name,
      parentFlowId: f.parentFlowId ?? null,
      position: f.position ?? fi,
    }));
    const { data: curRow } = await admin
      .from('builds')
      .select('flow_tree')
      .eq('id', buildId)
      .maybeSingle();
    const merged = new Map<string, (typeof incoming)[number]>();
    for (const f of (curRow?.flow_tree ?? []) as typeof incoming) merged.set(f.id, f);
    for (const f of incoming) merged.set(f.id, f);
    await admin
      .from('builds')
      .update({ flow_tree: Array.from(merged.values()) })
      .eq('id', buildId);
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

  const prevMap = new Map<
    string,
    { image_url: string; frame_name: string; video_url: string | null }
  >();
  if (prevBuild) {
    const { data: prevRows } = await admin
      .from('frame_versions')
      .select('flow_id, frame_id, image_url, frame_name, video_url')
      .eq('build_id', prevBuild.id);
    for (const r of prevRows ?? []) {
      prevMap.set(`${r.flow_id}::${r.frame_id}`, {
        image_url: r.image_url,
        frame_name: r.frame_name,
        video_url: r.video_url ?? null,
      });
    }
  }

  for (const flow of newFlows) {
    for (const frame of flow.frames) {
      const prev = prevMap.get(`${flow.id}::${frame.id}`);
      let change_kind: 'added' | 'updated' | 'renamed' | 'unchanged';
      if (!prev) change_kind = 'added';
      else if (prev.image_url !== frame.image) change_kind = 'updated';
      else if ((prev.video_url ?? null) !== (frame.video ?? null)) change_kind = 'updated';
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
          video_url: frame.video ?? null,
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

  // 4. Upsert frame rows so comments persist across builds. After upsert
  // we also rebuild the per-frame capture history (frame_captures): wipe
  // prior rows for this frame, then insert latest (idx=0) + any version
  // entries (idx 1+). Reviewers on the web side use these for the
  // version scrubber; replacing rather than appending keeps the table
  // in sync with whatever Capture last pushed.
  //
  // The flow's index in `newFlows` is the display order; same for frames.
  // If the manifest carries explicit positions we use those, otherwise we
  // fall back to the array index so older clients still get sane ordering.
  // Cleanup pass for move-flow: the frames table is keyed by
  // (app_id, flow_id, frame_id). If the user dragged a snap from flow A to
  // flow B in Capture, the incoming manifest carries it under B but the
  // old A-row still exists from a previous push — so the gallery ends up
  // showing the same snap in both flows. For every frame_id in this batch,
  // delete rows in the same app whose flow_id doesn't match the incoming
  // assignment. Scoped to the frame_ids in this batch so we never touch
  // frames that just happen not to be in the current upload chunk.
  const incomingFrameIds = new Set<string>();
  const incomingPairs = new Set<string>();
  for (const flow of newFlows) {
    for (const frame of flow.frames) {
      incomingFrameIds.add(frame.id);
      incomingPairs.add(`${flow.id}::${frame.id}`);
    }
  }
  if (incomingFrameIds.size > 0) {
    const { data: existing } = await admin
      .from('frames')
      .select('id, flow_id, frame_id')
      .eq('app_id', appId)
      .in('frame_id', Array.from(incomingFrameIds));
    const staleIds: string[] = [];
    for (const row of existing ?? []) {
      if (!incomingPairs.has(`${row.flow_id}::${row.frame_id}`)) {
        staleIds.push(row.id);
      }
    }
    if (staleIds.length > 0) {
      const { error: delErr } = await admin
        .from('frames')
        .delete()
        .in('id', staleIds);
      if (delErr) {
        return {
          status: 500,
          message: `Stale frame cleanup failed: ${delErr.message}`,
        };
      }
    }
  }

  const upsertedFrameIds: string[] = [];
  for (let fi = 0; fi < newFlows.length; fi++) {
    const flow = newFlows[fi];
    if (!flow) continue;
    const flowPos = flow.position ?? fi;
    for (let i = 0; i < flow.frames.length; i++) {
      const frame = flow.frames[i];
      if (!frame) continue;
      const framePos = frame.position ?? i;
      const { data: frRow, error: frErr } = await admin
        .from('frames')
        .upsert(
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
            // Only touch the clip column when this push carries one — a
            // storage-URL re-ref (synced frame) has no video field and must
            // not wipe a clip that already lives on the row.
            ...(frame.video !== undefined ? { latest_video_url: frame.video } : {}),
            latest_build_id: buildId,
          },
          { onConflict: 'app_id,flow_id,frame_id' },
        )
        .select('id')
        .single();
      if (frErr || !frRow)
        return {
          status: 500,
          message: `Frame upsert failed: ${frErr?.message ?? 'no row returned'}`,
        };
      upsertedFrameIds.push(frRow.id);

      // Rebuild capture history for this frame.
      const { error: delErr } = await admin
        .from('frame_captures')
        .delete()
        .eq('frame_id', frRow.id);
      if (delErr) {
        return {
          status: 500,
          message: `frame_captures cleanup failed: ${delErr.message}`,
        };
      }
      const captures: Array<{
        frame_id: string;
        app_id: string;
        build_id: string;
        image_url: string;
        captured_at: string;
        idx: number;
      }> = [
        {
          frame_id: frRow.id,
          app_id: appId,
          build_id: buildId,
          image_url: frame.image,
          captured_at: manifest.capturedAt ?? new Date().toISOString(),
          idx: 0,
        },
      ];
      const versions = frame.versions ?? [];
      for (let vi = 0; vi < versions.length; vi++) {
        const v = versions[vi]!;
        captures.push({
          frame_id: frRow.id,
          app_id: appId,
          build_id: buildId,
          image_url: v.image,
          captured_at: v.capturedAt,
          idx: vi + 1,
        });
      }
      const { error: capInsErr } = await admin
        .from('frame_captures')
        .insert(captures);
      if (capInsErr) {
        return {
          status: 500,
          message: `frame_captures insert failed: ${capInsErr.message}`,
        };
      }
    }
  }

  // 5. Orphan handling. Frames not in the incoming manifest stay in the
  // DB so old version views can still render them with their comments.
  // We don't delete anything — version isolation is handled at read
  // time by filtering on `frame_versions.build_id` for the version
  // being viewed.

  return {
    appId,
    appSlug,
    buildId,
    buildSha: manifest.buildSha,
    framesCount: uploaded,
    frames: frameUrls,
  };
}
