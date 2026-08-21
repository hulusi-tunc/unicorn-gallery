import Link from 'next/link';
import type {
  ManifestFlow,
  ManifestFrame,
  Platform,
} from '@unicorn-studio/gallery-capture';
import type { ReactNode } from 'react';
import { ChevronRight, Play } from 'lucide-react';
import { DeviceBezel } from '@/components/device-bezel';
import { UnresolvedBadge } from '@/components/unresolved-badge';
import { WebCardThumb } from '@/components/web-card-thumb';
import { imageHref } from '@/lib/image-href';
import type { FrameUnresolvedSummary } from '@/lib/queries';

const MOBILE_CARD_HEIGHT = 380;
const WEB_CARD_HEIGHT = 220;
const WEB_CARD_WIDTH = 360;

export function JourneyStrip({
  flow,
  platform,
  appSlug,
  freshFrameKeys,
  unresolvedByFrame,
  versionQuery = '',
}: {
  flow: ManifestFlow;
  platform: Platform;
  appSlug: string;
  /**
   * Set of `frame_id` strings that were re-snapped since the current
   * user last opened them. Cards in the set get an "Updated" pill.
   */
  freshFrameKeys?: Set<string>;
  /**
   * Map of `frame_id` → unresolved comment summary (count + a short
   * preview of recent threads). Frames with at least one open thread get
   * an orange badge so PMs can scan a flow and hover for a quick look at
   * what's open.
   */
  unresolvedByFrame?: Map<string, FrameUnresolvedSummary>;
  /** Pre-formatted `?v=N` query string for past-version browsing. Empty when latest. */
  versionQuery?: string;
}): ReactNode {
  return (
    <div className="no-scrollbar overflow-x-auto px-10 pb-10 pt-4">
      <ol className="flex items-center gap-6">
        {flow.frames.map((frame, i) => (
          <li key={frame.id} className="flex shrink-0 items-center gap-6">
            <JourneyCard
              frame={frame}
              step={i + 1}
              platform={platform}
              href={`/app/${encodeURIComponent(appSlug)}/${encodeURIComponent(flow.id)}/${encodeURIComponent(frame.id)}${versionQuery}`}
              isFresh={freshFrameKeys?.has(frame.id) ?? false}
              unresolved={unresolvedByFrame?.get(frame.id) ?? null}
            />
            {i < flow.frames.length - 1 && (
              <ChevronRight
                size={20}
                className="shrink-0 text-neutral-400 dark:text-neutral-700"
                aria-hidden
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function JourneyCard({
  frame,
  step,
  platform,
  href,
  isFresh,
  unresolved,
}: {
  frame: ManifestFrame;
  step: number;
  platform: Platform;
  href: string;
  isFresh: boolean;
  unresolved: FrameUnresolvedSummary | null;
}): ReactNode {
  const isMobile = platform !== 'web';

  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 transition-transform hover:-translate-y-1"
    >
      <div className="relative">
        <span className="absolute -top-2 -left-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white font-mono text-[13px] tabular-nums text-neutral-500 ring-1 ring-neutral-300 group-hover:ring-neutral-500 dark:bg-neutral-900 dark:text-neutral-400 dark:ring-neutral-700 dark:group-hover:ring-neutral-500">
          {String(step).padStart(2, '0')}
        </span>
        {isFresh ? (
          <span
            className="absolute -top-2 right-1 z-10 inline-flex items-center rounded-full bg-[oklch(0.5_0.22_254)] px-2 py-0.5 font-mono text-[13px] font-semibold tracking-[0.06em] text-white shadow-md dark:bg-[oklch(0.6_0.21_254)]"
            title="Updated since your last visit"
          >
            Updated
          </span>
        ) : null}
        {unresolved && unresolved.count > 0 ? (
          <UnresolvedBadge
            count={unresolved.count}
            preview={unresolved.preview}
            offsetForUpdated={isFresh}
          />
        ) : null}
        {frame.video ? (
          <span
            className="absolute bottom-2 right-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur"
            title="Has a motion clip"
          >
            <Play className="h-3 w-3" fill="currentColor" />
          </span>
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
        <p className="truncate font-mono text-[13px] text-neutral-500">{frame.id}</p>
      </div>
    </Link>
  );
}
