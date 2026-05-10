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
import { IPHONE_BEZEL_ASPECT, IPhoneBezel } from '@/components/iphone-bezel';
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
}: {
  flow: ManifestFlow;
  platform: Platform;
  appSlug: string;
  activeFrameId: string;
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
      className="no-scrollbar flex shrink-0 items-end gap-3 overflow-x-auto border-t border-neutral-200 bg-neutral-50/60 px-10 py-4 dark:border-neutral-800/60 dark:bg-neutral-950/60"
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
}: {
  frame: ManifestFrame;
  step: number;
  flowId: string;
  appSlug: string;
  isMobile: boolean;
  active: boolean;
}): ReactNode {
  return (
    <Link
      data-active={active}
      href={`/app/${encodeURIComponent(appSlug)}/${encodeURIComponent(flowId)}/${encodeURIComponent(frame.id)}`}
      className={cn(
        'group flex shrink-0 flex-col items-center gap-1.5 rounded-md p-1.5 transition-colors',
        active
          ? 'bg-neutral-200/60 dark:bg-neutral-800/60'
          : 'hover:bg-neutral-200/40 dark:hover:bg-neutral-900/60',
      )}
      title={frame.name}
    >
      {isMobile ? (
        <div
          style={{
            height: MOBILE_CELL_HEIGHT,
            aspectRatio: IPHONE_BEZEL_ASPECT,
            transition: 'filter 200ms ease-out, transform 200ms ease-out',
            transform: active ? 'scale(1.04)' : 'scale(1)',
            filter: active
              ? 'drop-shadow(0 6px 12px rgba(15,15,20,0.25))'
              : 'drop-shadow(0 2px 4px rgba(15,15,20,0.12))',
          }}
        >
          <IPhoneBezel>
            <Image
              src={imageHref(frame.image)}
              alt={frame.name}
              fill
              sizes="96px"
              style={{
                objectFit: 'cover',
                objectPosition: 'top center',
              }}
              loading="lazy"
            />
          </IPhoneBezel>
        </div>
      ) : (
        <div
          style={{ height: WEB_CELL_HEIGHT, width: WEB_CELL_WIDTH, position: 'relative' }}
          className={cn(
            'overflow-hidden rounded transition-all',
            active
              ? 'ring-2 ring-[oklch(0.5_0.22_254)]'
              : 'ring-1 ring-neutral-200 group-hover:ring-neutral-400 dark:ring-neutral-800 dark:group-hover:ring-neutral-600',
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
          active ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-400 dark:text-neutral-600',
        )}
      >
        {String(step).padStart(2, '0')}
      </span>
    </Link>
  );
}
