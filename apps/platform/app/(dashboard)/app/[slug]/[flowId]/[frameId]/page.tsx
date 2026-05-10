import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { CommentsPanel } from '@/components/comments-panel';
import { DeviceFrame } from '@/components/device-frame';
import { Filmstrip } from '@/components/filmstrip';
import { FrameVersionStage } from '@/components/frame-version-scrubber';
import { KeyboardNav } from '@/components/keyboard-nav';
import { MarkFrameRead } from '@/components/mark-frame-read';
import { RealtimeRefresh } from '@/components/realtime-refresh';
import { findOrCreateFrame, listCommentsForFrame } from '@/lib/comments';
import { imageHref } from '@/lib/image-href';
import {
  getAppBySlug,
  getCurrentProfile,
  getLatestBuild,
  listFrameCaptures,
  getManifestForApp,
  getMentionableProfilesForApp,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

const BORDER_LIGHT = 'border-[oklch(0.9_0.007_260)]';
const BORDER_DARK = 'dark:border-[oklch(0.24_0.008_260)]';
const TEXT_DISPLAY = 'text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]';
const TEXT_PRIMARY = 'text-[oklch(0.24_0.01_260)] dark:text-[oklch(0.82_0.012_260)]';
const TEXT_SECONDARY = 'text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]';
const TEXT_DISABLED = 'text-[oklch(0.68_0.008_260)] dark:text-[oklch(0.42_0.008_260)]';
const SURFACE = 'bg-white dark:bg-[oklch(0.175_0.007_260)]';

export default async function FramePage({
  params,
}: {
  params: Promise<{ slug: string; flowId: string; frameId: string }>;
}): Promise<ReactNode> {
  const { slug, flowId: rawFlow, frameId: rawFrame } = await params;
  const flowId = decodeURIComponent(rawFlow);
  const frameId = decodeURIComponent(rawFrame);

  const app = await getAppBySlug(decodeURIComponent(slug));
  if (!app) notFound();

  const [manifest, build, profile, mentionables] = await Promise.all([
    getManifestForApp(app.id),
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

  const prev = idx > 0 ? flow.frames[idx - 1] : undefined;
  const next = idx < flow.frames.length - 1 ? flow.frames[idx + 1] : undefined;
  const frameHref = (id: string): string =>
    `/app/${encodeURIComponent(app.slug)}/${encodeURIComponent(flow.id)}/${encodeURIComponent(id)}`;

  const frameRow = await findOrCreateFrame(
    app.id,
    flow.id,
    flow.name,
    frame.id,
    frame.name,
    frame.image,
    build?.id ?? null,
  );
  const [comments, captures] = await Promise.all([
    listCommentsForFrame(frameRow.id),
    listFrameCaptures(frameRow.id),
  ]);

  return (
    <main className="flex flex-1 overflow-hidden bg-white text-[oklch(0.24_0.01_260)] dark:bg-[oklch(0.145_0.006_260)] dark:text-[oklch(0.82_0.012_260)]">
      <MarkFrameRead frameRowId={frameRow.id} appSlug={app.slug} />
      <RealtimeRefresh table="comments" filter={`frame_id=eq.${frameRow.id}`} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <KeyboardNav
          prevHref={prev ? frameHref(prev.id) : undefined}
          nextHref={next ? frameHref(next.id) : undefined}
        />

        <div className={`flex items-center gap-3 border-b ${BORDER_LIGHT} ${BORDER_DARK} px-10 py-4`}>
          <Link
            href={`/app/${encodeURIComponent(app.slug)}/${encodeURIComponent(flow.id)}`}
            className={`text-xs ${TEXT_SECONDARY} transition-colors hover:text-[oklch(0.15_0.008_260)] dark:hover:text-[oklch(0.97_0.005_260)]`}
          >
            {flow.name}
          </Link>
          <span className={TEXT_DISABLED}>/</span>
          <span className={`text-sm font-medium ${TEXT_DISPLAY}`}>{frame.name}</span>
          <span className={`ml-auto font-mono text-[11px] tabular-nums ${TEXT_SECONDARY}`}>
            {String(idx + 1).padStart(2, '0')} / {String(flow.frames.length).padStart(2, '0')}
          </span>
        </div>

        <FrameVersionStage captures={captures} initialSrc={imageHref(frame.image)}>
          {(currentSrc) => (
            <div className="relative flex flex-1 items-center justify-center overflow-auto bg-[oklch(0.965_0.004_260)] px-10 py-6 dark:bg-[oklch(0.175_0.007_260)]">
              {prev ? (
                <Link
                  href={frameHref(prev.id)}
                  className={`absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border ${BORDER_LIGHT} ${BORDER_DARK} ${SURFACE} p-2 ${TEXT_SECONDARY} backdrop-blur transition-colors hover:text-[oklch(0.15_0.008_260)] dark:hover:text-[oklch(0.97_0.005_260)]`}
                  aria-label={`Previous: ${prev.name}`}
                  title={prev.name}
                >
                  <ChevronLeft size={18} />
                </Link>
              ) : null}

              <DeviceFrame platform={manifest.platform} src={currentSrc} alt={frame.name} />

              {next ? (
                <Link
                  href={frameHref(next.id)}
                  className={`absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border ${BORDER_LIGHT} ${BORDER_DARK} ${SURFACE} p-2 ${TEXT_SECONDARY} backdrop-blur transition-colors hover:text-[oklch(0.15_0.008_260)] dark:hover:text-[oklch(0.97_0.005_260)]`}
                  aria-label={`Next: ${next.name}`}
                  title={next.name}
                >
                  <ChevronRight size={18} />
                </Link>
              ) : null}
            </div>
          )}
        </FrameVersionStage>

        <div className={`flex items-center gap-3 border-t ${BORDER_LIGHT} ${BORDER_DARK} px-10 py-3 text-[11px] ${TEXT_SECONDARY}`}>
          <kbd className={`rounded border ${BORDER_LIGHT} ${BORDER_DARK} ${SURFACE} px-1.5 py-0.5 font-mono text-[10px] ${TEXT_PRIMARY}`}>
            ←
          </kbd>
          <kbd className={`rounded border ${BORDER_LIGHT} ${BORDER_DARK} ${SURFACE} px-1.5 py-0.5 font-mono text-[10px] ${TEXT_PRIMARY}`}>
            →
          </kbd>
          <span>navigate</span>
          <span className={`ml-auto font-mono text-[11px] ${TEXT_SECONDARY}`}>{frame.id}</span>
        </div>

        <Filmstrip
          flow={flow}
          platform={manifest.platform}
          appSlug={app.slug}
          activeFrameId={frame.id}
        />
      </div>

      <CommentsPanel
        frameRowId={frameRow.id}
        comments={comments}
        isAgency={profile?.role === 'agency'}
        appSlug={app.slug}
        appId={app.id}
        mentionables={mentionables}
      />
    </main>
  );
}
