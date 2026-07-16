import Link from 'next/link';
import type { ManifestFlow, Platform } from '@unicorn-studio/gallery-capture';
import type { ReactNode } from 'react';
import { DeviceBezel } from '@/components/device-bezel';
import { UnresolvedBadge } from '@/components/unresolved-badge';
import { WebCardThumb } from '@/components/web-card-thumb';
import { imageHref } from '@/lib/image-href';
import type { FrameUnresolvedSummary } from '@/lib/queries';

const MOBILE_CARD_HEIGHT = 360;
const WEB_CARD_HEIGHT = 200;
const WEB_CARD_WIDTH = 320;

/**
 * Mobbin-style "Screens" tab — every frame across all flows in one flat,
 * wrapping grid. Reuses the same bezels/thumbs as the flow rows so cards
 * look identical between tabs. Each card keeps its owning flow id so the
 * link still resolves to the frame detail route.
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
    <div className="flex flex-wrap gap-x-8 gap-y-10 px-10 py-8">
      {cards.map(({ flow, frame }) => {
        const unresolved = unresolvedByFrame?.get(frame.id) ?? null;
        return (
          <Link
            key={frame.id}
            href={`/app/${encodeURIComponent(appSlug)}/${encodeURIComponent(flow.id)}/${encodeURIComponent(frame.id)}${versionQuery}`}
            className="group flex flex-col gap-3 transition-transform hover:-translate-y-1"
          >
            <div className="relative">
              {unresolved && unresolved.count > 0 ? (
                <UnresolvedBadge
                  count={unresolved.count}
                  preview={unresolved.preview}
                  offsetForUpdated={false}
                />
              ) : null}
              {isMobile ? (
                <DeviceBezel
                  src={imageHref(frame.image)}
                  alt={frame.name}
                  style={{
                    height: MOBILE_CARD_HEIGHT,
                    filter:
                      'drop-shadow(0 18px 32px rgba(15,15,20,0.18)) drop-shadow(0 6px 12px rgba(15,15,20,0.10))',
                    transition: 'filter 220ms cubic-bezier(0.165, 0.84, 0.44, 1)',
                  }}
                  className="group-hover:[filter:drop-shadow(0_28px_44px_rgba(15,15,20,0.28))_drop-shadow(0_8px_14px_rgba(15,15,20,0.14))] dark:[filter:drop-shadow(0_18px_32px_rgba(0,0,0,0.5))_drop-shadow(0_6px_12px_rgba(0,0,0,0.3))] dark:group-hover:[filter:drop-shadow(0_28px_44px_rgba(0,0,0,0.65))_drop-shadow(0_8px_14px_rgba(0,0,0,0.4))]"
                />
              ) : (
                <WebCardThumb
                  src={imageHref(frame.image)}
                  alt={frame.name}
                  width={WEB_CARD_WIDTH}
                  height={WEB_CARD_HEIGHT}
                />
              )}
            </div>
            <div style={isMobile ? { width: MOBILE_CARD_HEIGHT * 0.508 } : { width: WEB_CARD_WIDTH }}>
              <p className="truncate text-sm font-medium text-neutral-900 group-hover:text-neutral-950 dark:text-neutral-200 dark:group-hover:text-neutral-50">
                {frame.name}
              </p>
              <p className="truncate font-mono text-[10px] text-neutral-500">{flow.name}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
