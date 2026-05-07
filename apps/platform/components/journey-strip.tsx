import Link from 'next/link';
import type {
  ManifestFlow,
  ManifestFrame,
  Platform,
} from '@unicorn-studio/gallery-capture';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { IPHONE_BEZEL_ASPECT, IPhoneBezel } from '@/components/iphone-bezel';
import { imageHref } from '@/lib/image-href';

const MOBILE_CARD_HEIGHT = 380;
const WEB_CARD_HEIGHT = 220;
const WEB_CARD_WIDTH = 360;

export function JourneyStrip({
  flow,
  platform,
  appSlug,
}: {
  flow: ManifestFlow;
  platform: Platform;
  appSlug: string;
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
              href={`/app/${encodeURIComponent(appSlug)}/${encodeURIComponent(flow.id)}/${encodeURIComponent(frame.id)}`}
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
}: {
  frame: ManifestFrame;
  step: number;
  platform: Platform;
  href: string;
}): ReactNode {
  const isMobile = platform !== 'web';

  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 transition-transform hover:-translate-y-1"
    >
      <div className="relative">
        <span className="absolute -top-2 -left-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white font-mono text-[10px] tabular-nums text-neutral-500 ring-1 ring-neutral-300 group-hover:ring-neutral-500 dark:bg-neutral-900 dark:text-neutral-400 dark:ring-neutral-700 dark:group-hover:ring-neutral-500">
          {String(step).padStart(2, '0')}
        </span>

        {isMobile ? (
          <div
            style={{
              height: MOBILE_CARD_HEIGHT,
              aspectRatio: IPHONE_BEZEL_ASPECT,
              filter:
                'drop-shadow(0 18px 32px rgba(15,15,20,0.18)) drop-shadow(0 6px 12px rgba(15,15,20,0.10))',
              transition: 'filter 220ms cubic-bezier(0.165, 0.84, 0.44, 1)',
            }}
            className="group-hover:[filter:drop-shadow(0_28px_44px_rgba(15,15,20,0.28))_drop-shadow(0_8px_14px_rgba(15,15,20,0.14))] dark:[filter:drop-shadow(0_18px_32px_rgba(0,0,0,0.5))_drop-shadow(0_6px_12px_rgba(0,0,0,0.3))] dark:group-hover:[filter:drop-shadow(0_28px_44px_rgba(0,0,0,0.65))_drop-shadow(0_8px_14px_rgba(0,0,0,0.4))]"
          >
            <IPhoneBezel>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageHref(frame.image)}
                alt={frame.name}
                style={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'top center',
                }}
                loading="lazy"
              />
            </IPhoneBezel>
          </div>
        ) : (
          <div
            style={{ height: WEB_CARD_HEIGHT, width: WEB_CARD_WIDTH }}
            className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 shadow-md transition-all group-hover:border-neutral-400 group-hover:shadow-xl dark:border-neutral-800 dark:bg-neutral-900 dark:group-hover:border-neutral-600"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageHref(frame.image)}
              alt={frame.name}
              className="h-full w-full object-cover object-top"
              loading="lazy"
            />
          </div>
        )}
      </div>

      <div style={isMobile ? { width: MOBILE_CARD_HEIGHT * 0.508 } : { width: WEB_CARD_WIDTH }}>
        <p className="truncate text-sm font-medium text-neutral-900 group-hover:text-neutral-950 dark:text-neutral-200 dark:group-hover:text-neutral-50">
          {frame.name}
        </p>
        <p className="truncate font-mono text-[10px] text-neutral-500">{frame.id}</p>
      </div>
    </Link>
  );
}
