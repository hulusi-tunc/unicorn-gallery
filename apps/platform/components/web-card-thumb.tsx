'use client';

import { FileText, Play } from 'lucide-react';
import { useState } from 'react';
import { BrowserFrame } from '@/components/browser-frame';

/**
 * Thumbnail for a web frame card, inside a small browser window so a white
 * screenshot keeps its edge on a white page. Fills its parent container,
 * detects tall/full-page snaps and shows indicators.
 */
export function WebCardThumb({
  src,
  alt,
  width,
  height,
  hasVideo,
  elevated = false,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  hasVideo?: boolean;
  /** Lift the window with a shadow. Leave off inside a tile that clips it. */
  elevated?: boolean;
}): React.ReactNode {
  const [isFullPage, setIsFullPage] = useState(false);

  return (
    <BrowserFrame
      size="sm"
      elevated={elevated}
      style={{ width: width ?? '100%', height: height ?? '100%' }}
      className="transition-shadow"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={(ev) => {
          const img = ev.currentTarget;
          if (img.naturalWidth > 0) {
            setIsFullPage(img.naturalHeight / img.naturalWidth >= 1.4);
          }
        }}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'top center',
        }}
      />

      {/* Full-page indicator */}
      {isFullPage ? (
        <>
          <span
            className="pointer-events-none absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1 text-[13px] font-medium text-white backdrop-blur-sm"
            title="Full-page capture - scroll to see more"
          >
            <FileText size={13} />
            Full page
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/40 to-transparent"
          />
        </>
      ) : null}

      {/* Video indicator */}
      {hasVideo ? (
        <span
          className="pointer-events-none absolute bottom-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm"
          title="Has a motion clip"
        >
          <Play size={13} fill="currentColor" />
        </span>
      ) : null}
    </BrowserFrame>
  );
}
