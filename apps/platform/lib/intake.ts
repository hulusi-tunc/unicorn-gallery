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
  screenshots: Map<string, ArrayBuffer>;
  replace?: boolean;
}): Promise<IntakeResult | IntakeError> {
  const admin = getSupabaseAdminClient();

  // We DON'T delete frames upfront in replace mode anymore — that
  // cascades through `frames → comments` and silently wipes every PM
  // review thread on the project. Instead we let the upsert below
  // refresh whatever exists, then trim orphans (frames not in the
  // incoming manifest) AFTER. Comments stay attached to the frame.id
  // they were originally posted on; missing frames cascade-delete
  // their orphan comments only, not the active ones.
  //
  // Builds are still wiped in replace mode — they're append-only
  // history rows, not user-authored content. Builds delete via FK
  // cascade hits frames.latest_build_id which is set during the
  // upsert below, so the order is: clear builds → upsert frames →
  // delete orphan frames. Empty-state blink during the swap is
  // minimal (one async tick).
  if (replace) {
    const { error: delBuildsErr } = await admin
      .from('builds')
      .delete()
      .eq('app_id', appId);
    if (delBuildsErr) {
      return { status: 500, message: `Replace failed (builds): ${delBuildsErr.message}` };
    }
  }

  // 1. Upload each screenshot to Storage and rewrite manifest URLs.
  // Past versions (frame.versions[]) ride alongside — each gets its own
  // storage path so reviewers can scrub through capture history.
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
      // Upload past versions (newest-first in the array; idx=1+ since
      // idx=0 is the latest above). Missing PNGs in the multipart body
      // are skipped silently — better to lose history than reject the
      // whole push.
      const newVersions: NonNullable<typeof frame.versions> = [];
      const inputVersions = frame.versions ?? [];
      for (let vi = 0; vi < inputVersions.length; vi++) {
        const v = inputVersions[vi]!;
        const vBytes = screenshots.get(v.image);
        if (!vBytes) continue;
        const vPath = `${appId}/${manifest.buildSha}/${flow.id}/${frame.id}-v${vi + 1}.png`;
        const { error: vErr } = await admin.storage
          .from(SCREENSHOTS_BUCKET)
          .upload(vPath, vBytes, { contentType: 'image/png', upsert: true });
        if (vErr) {
          // Don't fail the whole push for a version upload error — log it
          // by skipping the entry. The latest image still made it.
          continue;
        }
        const { data: vPub } = admin.storage.from(SCREENSHOTS_BUCKET).getPublicUrl(vPath);
        newVersions.push({ image: vPub.publicUrl, capturedAt: v.capturedAt });
        uploaded++;
      }
      newFrames.push({
        ...frame,
        image: pub.publicUrl,
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

  // 5. Orphan cleanup (replace-mode only). Frames that exist in the DB
  // for this app but weren't in the incoming manifest get deleted now.
  // Comments on those orphan frames cascade-delete with them — but the
  // designer only loses comments on frames they explicitly removed from
  // their desktop, which is the right behavior. Comments on
  // upsert-matched frames stay intact.
  if (replace) {
    const { error: orphanErr } =
      upsertedFrameIds.length > 0
        ? await admin
            .from('frames')
            .delete()
            .eq('app_id', appId)
            .not('id', 'in', `(${upsertedFrameIds.map((id) => `"${id}"`).join(',')})`)
        : await admin.from('frames').delete().eq('app_id', appId);
    if (orphanErr) {
      return {
        status: 500,
        message: `Orphan frame cleanup failed: ${orphanErr.message}`,
      };
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
