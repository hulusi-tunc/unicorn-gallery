import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { FrameModal } from '@/components/frame-modal';
import { findOrCreateFrame, listCommentsForFrame } from '@/lib/comments';
import { imageHref } from '@/lib/image-href';
import {
  getAppBySlug,
  getBuildByVersion,
  getCurrentProfile,
  getLatestBuild,
  getManifestForApp,
  getMentionableProfilesForApp,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function FrameModalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; flowId: string; frameId: string }>;
  searchParams: Promise<{ v?: string }>;
}): Promise<ReactNode> {
  const [{ slug, flowId: rawFlow, frameId: rawFrame }, sp] = await Promise.all([
    params,
    searchParams,
  ]);
  const flowId = decodeURIComponent(rawFlow);
  const frameId = decodeURIComponent(rawFrame);

  // Stage 1: app lookup (cached via React.cache, shared with layout)
  const app = await getAppBySlug(decodeURIComponent(slug));
  if (!app) notFound();

  const versionParam = sp.v ? Number(sp.v) : null;
  const selectedBuild =
    versionParam != null && Number.isFinite(versionParam)
      ? await getBuildByVersion(app.id, versionParam)
      : null;
  const isViewingOldVersion = selectedBuild !== null;

  // Stage 2: all independent queries in parallel (cached queries shared with layout)
  const [manifest, build, profile, mentionables] = await Promise.all([
    getManifestForApp(app.id, selectedBuild?.id),
    getLatestBuild(app.id),
    getCurrentProfile(),
    getMentionableProfilesForApp(app.id),
  ]);
  if (!manifest) notFound();

  const flow = manifest.flows.find((f) => f.id === flowId);
  if (!flow) notFound();
  const idx = flow.frames.findIndex((f) => f.id === frameId);
  if (idx < 0) notFound();
  const frame = flow.frames[idx]!;

  const versionQuery = isViewingOldVersion ? `?v=${selectedBuild!.version ?? ''}` : '';

  // Stage 3: findOrCreateFrame + comments in parallel.
  // findOrCreateFrame almost always finds (not creates), so we fire it
  // alongside a speculative comments query. If the frame didn't exist
  // yet (rare first-view case), the comments list will be empty anyway.
  const frameRowPromise = findOrCreateFrame(
    app.id, flow.id, flow.name, frame.id, frame.name, frame.image, build?.id ?? null,
  );
  // Start the frame lookup immediately, then get comments once we have the row ID.
  const frameRow = await frameRowPromise;
  const comments = await listCommentsForFrame(frameRow.id);

  return (
    <FrameModal
      appName={app.name}
      appIconUrl={app.icon_url}
      accentColor={app.accent_color}
      appSlug={app.slug}
      appId={app.id}
      platform={manifest.platform}
      flow={flow}
      activeFrameId={frame.id}
      src={imageHref(frame.image)}
      videoSrc={frame.video}
      frameName={frame.name}
      frameRowId={frameRow.id}
      comments={comments}
      isAgency={profile?.role === 'agency'}
      currentUserId={profile?.id ?? null}
      mentionables={mentionables}
      readOnly={isViewingOldVersion}
      versionQuery={versionQuery}
    />
  );
}
