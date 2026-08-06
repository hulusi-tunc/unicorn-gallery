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

/**
 * Intercepting route: renders the clicked frame as an overlay modal on top of
 * whatever app view the click came from (landing, Screens grid, or a flow grid).
 * Fetches the same data as the full `[flowId]/[frameId]` page (which stays the
 * hard-nav fallback) but hands it to <FrameModal> instead of the full-page chrome.
 */
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

  const app = await getAppBySlug(decodeURIComponent(slug));
  if (!app) notFound();

  const versionParam = sp.v ? Number(sp.v) : null;
  const selectedBuild =
    versionParam != null && Number.isFinite(versionParam)
      ? await getBuildByVersion(app.id, versionParam)
      : null;
  const isViewingOldVersion = selectedBuild !== null;

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

  const frameRow = await findOrCreateFrame(
    app.id,
    flow.id,
    flow.name,
    frame.id,
    frame.name,
    frame.image,
    build?.id ?? null,
  );
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
