import Link from 'next/link';
import type { ManifestFlow, Platform } from '@unicorn-studio/gallery-capture';
import type { ReactNode } from 'react';
import { Play } from 'lucide-react';
import { DeviceBezel } from '@/components/device-bezel';
import { UnresolvedBadge } from '@/components/unresolved-badge';
import { WebCardThumb } from '@/components/web-card-thumb';
import { imageHref } from '@/lib/image-href';
import type { FrameUnresolvedSummary } from '@/lib/queries';

/**
 * Flat grid of every frame in the app - shown on the Screens tab.
 * 3-column grid with Mobbin-style card containers.
 */
export function ScreensGrid({
  flows,
  platform,
  appSlug,
  unresolvedByFrame,
  versionQuery = '',
}: {
  flows: readonly ManifestFlow[];
  platform: Platform;
  appSlug: string;
  unresolvedByFrame?: Map<string, FrameUnresolvedSummary>;
  versionQuery?: string;
}): ReactNode {
  const isMobile = platform !== 'web';
  const cards = flows.flatMap((flow) =>
    flow.frames.map((frame) => ({ flow, frame })),
  );

  return (
    <div className="grid grid-cols-3 gap-5 px-2 py-4">
      {cards.map(({ flow, frame }) => {
        const unresolved = unresolvedByFrame?.get(frame.id) ?? null;
        return (
          <Link
            key={frame.id}
            href={`/app/${encodeURIComponent(appSlug)}/${encodeURIComponent(flow.id)}/${encodeURIComponent(frame.id)}${versionQuery}`}
            className="group flex flex-col gap-3"
          >
            {/* Card container */}
            <div
              className="relative overflow-hidden rounded-2xl bg-[oklch(0.96_0.004_260)] transition-all duration-200 group-hover:scale-[1.02] dark:bg-[oklch(0.19_0.007_260)]"
              style={{ aspectRatio: isMobile ? '3 / 4' : '16 / 10' }}
            >
              {unresolved && unresolved.count > 0 ? (
                <UnresolvedBadge
                  count={unresolved.count}
                  preview={unresolved.preview}
                  offsetForUpdated={false}
                />
              ) : null}
              {frame.video ? (
                <span
                  className="absolute bottom-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm"
                  title="Has a motion clip"
                >
                  <Play size={13} fill="currentColor" />
                </span>
              ) : null}
              {isMobile ? (
                <div className="flex h-full items-center justify-center">
                  <DeviceBezel
                    src={imageHref(frame.image)}
                    alt={frame.name}
                    style={{ height: '80%' }}
                  />
                </div>
              ) : (
                <WebCardThumb
                  src={imageHref(frame.image)}
                  alt={frame.name}
                  hasVideo={!!frame.video}
                />
              )}
            </div>
            {/* Label below card */}
            <div className="pl-1">
              <p className="truncate text-sm font-medium text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]">
                {frame.name}
              </p>
              <p className="truncate text-[13px] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
                {flow.name}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
