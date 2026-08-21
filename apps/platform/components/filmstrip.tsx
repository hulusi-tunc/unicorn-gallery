'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type {
  ManifestFlow,
  ManifestFrame,
  Platform,
} from '@unicorn-studio/gallery-capture';
import type { ReactNode } from 'react';
import { DeviceBezel } from '@/components/device-bezel';
import { cn } from '@/lib/cn';
import { imageHref } from '@/lib/image-href';

const MOBILE_CELL_HEIGHT = 96;
const WEB_CELL_HEIGHT = 56;
const WEB_CELL_WIDTH = 100;

export function Filmstrip({
  flow,
  platform,
  appSlug,
  activeFrameId,
  versionQuery = '',
  replace = false,
}: {
  flow: ManifestFlow;
  platform: Platform;
  appSlug: string;
  activeFrameId: string;
  /** Pre-formatted `?v=N` query string for past-version browsing. Empty when latest. */
  versionQuery?: string;
  /**
   * Use history `replace` instead of `push` when jumping between frames. Set by
   * the frame modal so stepping through screens doesn't pile up history entries
   * (otherwise the close button would need one click per screen visited).
   */
  replace?: boolean;
}): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = platform !== 'web';

  useEffect(() => {
    const node = containerRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeFrameId]);

  return (
    <div
      ref={containerRef}
      className="no-scrollbar flex shrink-0 items-end gap-2.5 overflow-x-auto border-t border-[oklch(0.9_0.007_260)] bg-[oklch(0.97_0.004_260)] px-6 py-3 dark:border-white/5 dark:bg-[oklch(0.14_0.006_260)]"
    >
      {flow.frames.map((frame, i) => (
        <FilmstripCell
          key={frame.id}
          frame={frame}
          step={i + 1}
          flowId={flow.id}
          appSlug={appSlug}
          isMobile={isMobile}
          active={frame.id === activeFrameId}
          versionQuery={versionQuery}
          replace={replace}
        />
      ))}
    </div>
  );
}

function FilmstripCell({
  frame,
  step,
  flowId,
  appSlug,
  isMobile,
  active,
  versionQuery,
  replace,
}: {
  frame: ManifestFrame;
  step: number;
  flowId: string;
  appSlug: string;
  isMobile: boolean;
  active: boolean;
  versionQuery: string;
  replace?: boolean;
}): ReactNode {
  return (
    <Link
      data-active={active}
      replace={replace}
      href={`/app/${encodeURIComponent(appSlug)}/${encodeURIComponent(flowId)}/${encodeURIComponent(frame.id)}${versionQuery}`}
      className={cn(
        'group flex shrink-0 flex-col items-center gap-1.5 rounded-lg p-1.5 transition-colors',
        active
          ? 'bg-[oklch(0.92_0.006_260)] dark:bg-white/8'
          : 'hover:bg-[oklch(0.94_0.005_260)] dark:hover:bg-white/5',
      )}
      title={frame.name}
    >
      {isMobile ? (
        <DeviceBezel
          src={imageHref(frame.image)}
          alt={frame.name}
          style={{
            height: MOBILE_CELL_HEIGHT,
            transition: 'filter 200ms ease-out, transform 200ms ease-out, opacity 200ms ease-out',
            transform: active ? 'scale(1.04)' : 'scale(1)',
            opacity: active ? 1 : 0.6,
            filter: active
              ? 'drop-shadow(0 6px 12px rgba(15,15,20,0.25))'
              : 'drop-shadow(0 2px 4px rgba(15,15,20,0.12))',
          }}
        />
      ) : (
        <div
          style={{ height: WEB_CELL_HEIGHT, width: WEB_CELL_WIDTH, position: 'relative' }}
          className={cn(
            'overflow-hidden rounded-md transition-all',
            active ? 'ring-2 ring-[oklch(0.15_0.008_260)] dark:ring-white/30' : 'opacity-60 hover:opacity-100',
          )}
        >
          <Image
            src={imageHref(frame.image)}
            alt={frame.name}
            fill
            sizes="160px"
            className="object-cover object-top"
            loading="lazy"
          />
        </div>
      )}
      <span
        className={cn(
          'font-mono text-[9px] tabular-nums',
          active ? 'text-[oklch(0.35_0.01_260)] dark:text-white/60' : 'text-[oklch(0.65_0.01_260)] dark:text-white/25',
        )}
      >
        {String(step).padStart(2, '0')}
      </span>
    </Link>
  );
}
