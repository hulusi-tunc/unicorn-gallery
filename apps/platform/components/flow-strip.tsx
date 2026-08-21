'use client';

import type { ManifestFlow } from '@unicorn-studio/gallery-capture';
import { ArrowLeft, ArrowRight, Play } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, useEffect, type ReactNode } from 'react';
import { DeviceBezel } from '@/components/device-bezel';
import { WebCardThumb } from '@/components/web-card-thumb';
import { imageHref } from '@/lib/image-href';

export function FlowStrip({
  flow,
  appSlug,
  isMobile,
  versionQuery,
  parentFlowName,
}: {
  flow: ManifestFlow;
  appSlug: string;
  isMobile: boolean;
  versionQuery: string;
  parentFlowName?: string;
}): ReactNode {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateArrows() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, []);

  function scroll(dir: 'left' | 'right') {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.clientWidth * 0.42;
    el.scrollBy({ left: dir === 'right' ? cardWidth : -cardWidth, behavior: 'smooth' });
  }

  return (
    <div>
      <div className="relative">
        <div
          ref={scrollRef}
          className="no-scrollbar flex gap-4 overflow-x-auto"
        >
          {flow.frames.map((frame) => {
            const src = imageHref(frame.image);
            const href = `/app/${encodeURIComponent(appSlug)}/${encodeURIComponent(flow.id)}/${encodeURIComponent(frame.id)}${versionQuery}`;
            return (
              <Link
                key={frame.id}
                href={href}
                className="shrink-0"
                style={{ width: 'calc(30% - 8px)' }}
              >
                <div
                  className="overflow-hidden rounded-2xl bg-[oklch(0.96_0.004_260)] dark:bg-[oklch(0.19_0.007_260)]"
                  style={{ aspectRatio: isMobile ? '3 / 4' : '16 / 10' }}
                >
                  {isMobile ? (
                    <div className="flex h-full items-center justify-center">
                      <DeviceBezel
                        src={src}
                        alt={frame.name}
                        style={{ height: '80%' }}
                      />
                      {frame.video ? (
                        <span className="absolute bottom-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
                          <Play size={13} fill="currentColor" />
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <WebCardThumb
                      src={src}
                      alt={frame.name}
                      hasVideo={!!frame.video}
                    />
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Left arrow */}
        {canScrollLeft ? (
          <button
            type="button"
            onClick={() => scroll('left')}
            className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-[oklch(0.28_0.008_260)] text-white shadow-xl transition-transform hover:scale-105 dark:bg-[oklch(0.35_0.008_260)]"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
        ) : null}

        {/* Right arrow */}
        {canScrollRight ? (
          <button
            type="button"
            onClick={() => scroll('right')}
            className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-[oklch(0.28_0.008_260)] text-white shadow-xl transition-transform hover:scale-105 dark:bg-[oklch(0.35_0.008_260)]"
          >
            <ArrowRight size={20} strokeWidth={2.5} />
          </button>
        ) : null}
      </div>

      {/* Flow name + count below */}
      <div className="mt-4 pl-1">
        <p className="text-[15px] font-semibold text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]">
          {flow.name}
          {parentFlowName ? (
            <span className="font-normal text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
              {' '}from <span className="font-medium text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]">{parentFlowName}</span>
            </span>
          ) : null}
        </p>
        <p className="text-[13px] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
          {flow.frames.length} screen{flow.frames.length === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  );
}
