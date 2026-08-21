'use client';

import type { ManifestFlow } from '@unicorn-studio/gallery-capture';
import { ArrowLeft, ArrowRight, FileText, Play } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';
import { DeviceBezel } from '@/components/device-bezel';
import { UnresolvedBadge } from '@/components/unresolved-badge';
import { WebCardThumb } from '@/components/web-card-thumb';
import { imageHref } from '@/lib/image-href';
import type { FrameUnresolvedSummary } from '@/lib/queries';

export function FlowStrip({
  flow,
  appSlug,
  isMobile,
  versionQuery,
  parentFlowName,
  unresolvedByFrame,
}: {
  flow: ManifestFlow;
  appSlug: string;
  isMobile: boolean;
  versionQuery: string;
  parentFlowName?: string;
  unresolvedByFrame?: Map<string, FrameUnresolvedSummary>;
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
          className="no-scrollbar flex gap-4 overflow-x-auto py-3 -my-3"
        >
          {flow.frames.map((frame) => {
            const src = imageHref(frame.image);
            const href = `/app/${encodeURIComponent(appSlug)}/${encodeURIComponent(flow.id)}/${encodeURIComponent(frame.id)}${versionQuery}`;
            return (
              <FlowStripCard
                key={frame.id}
                href={href}
                src={src}
                videoSrc={frame.video}
                name={frame.name}
                isMobile={isMobile}
                unresolved={unresolvedByFrame?.get(frame.id) ?? null}
              />
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

/** Single card in the flow strip with hover-to-play for videos */
function FlowStripCard({
  href,
  src,
  videoSrc,
  name,
  isMobile,
  unresolved,
}: {
  href: string;
  src: string;
  videoSrc?: string;
  name: string;
  isMobile: boolean;
  unresolved: FrameUnresolvedSummary | null;
}): ReactNode {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovering, setHovering] = useState(false);
  const [isFullPage, setIsFullPage] = useState(false);

  const onEnter = useCallback(() => {
    setHovering(true);
    if (videoSrc && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [videoSrc]);

  const onLeave = useCallback(() => {
    setHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, []);

  return (
    <Link
      href={href}
      className="shrink-0"
      style={{ width: 'calc(30% - 8px)' }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div
        className="relative overflow-hidden rounded-2xl bg-[oklch(0.96_0.004_260)] transition-all duration-200 hover:scale-[1.02] dark:bg-[oklch(0.19_0.007_260)]"
        style={{ aspectRatio: isMobile ? '3 / 4' : '16 / 10' }}
      >
        {/* Unresolved comment badge */}
        {unresolved && unresolved.count > 0 ? (
          <UnresolvedBadge
            count={unresolved.count}
            preview={unresolved.preview}
            offsetForUpdated={false}
          />
        ) : null}

        {isMobile ? (
          <div className="flex h-full items-center justify-center">
            <DeviceBezel
              src={src}
              alt={name}
              style={{ height: '80%' }}
            />
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={name}
              loading="lazy"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth > 0) setIsFullPage(img.naturalHeight / img.naturalWidth >= 1.4);
              }}
              className={`block h-full w-full object-cover object-top ${videoSrc && hovering ? 'invisible' : ''}`}
            />
            {/* Video overlay on hover */}
            {videoSrc ? (
              <video
                ref={videoRef}
                src={videoSrc}
                muted
                loop
                playsInline
                className={`absolute inset-0 h-full w-full object-cover object-top ${hovering ? 'visible' : 'invisible'}`}
              />
            ) : null}
          </>
        )}

        {/* Full-page badge */}
        {isFullPage && !isMobile ? (
          <span className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[13px] font-medium text-white backdrop-blur-sm">
            <FileText size={13} />
            Full page
          </span>
        ) : null}

        {/* Video badge */}
        {videoSrc ? (
          <span className="absolute bottom-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
            <Play size={13} fill="currentColor" />
          </span>
        ) : null}
      </div>
    </Link>
  );
}
