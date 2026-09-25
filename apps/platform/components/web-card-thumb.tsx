'use client';

import { FileText, Play } from 'lucide-react';
import { useState } from 'react';

/**
 * The edge a web screenshot needs on the project page. A capture is usually
 * white, the page is white, and without an edge the card dissolves into the
 * background. This is the web counterpart of the phone bezel's treatment: a
 * hairline and the same two-layer shadow the mobile cards cast.
 */
export const WEB_SHOT_CLASS =
  'relative h-full w-full overflow-hidden rounded-lg bg-white ' +
  'ring-1 ring-[rgba(15,15,20,0.08)] shadow-[0_18px_32px_-6px_rgba(15,15,20,0.18),0_6px_12px_-2px_rgba(15,15,20,0.10)] ' +
  'dark:bg-neutral-900 dark:ring-white/10 dark:shadow-[0_18px_32px_-6px_rgba(0,0,0,0.5),0_6px_12px_-2px_rgba(0,0,0,0.3)]';

/**
 * Inset of a web screenshot inside a grey card tile, so it sits in the tile
 * with room for its shadow the way a phone sits in its bezel.
 */
export const WEB_SHOT_INSET = 'p-[6%]';

/**
 * Thumbnail for a web frame card. Fills its parent container, detects
 * tall/full-page snaps and shows indicators.
 *
 * `inset` is for grey card tiles (the Screens grid, Organise): the shot sits
 * inside the tile with space around it, like a phone does. Without it the
 * shot is the card itself (journey strips), carrying the same edge.
 */
export function WebCardThumb({
  src,
  alt,
  width,
  height,
  hasVideo,
  inset = false,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  hasVideo?: boolean;
  inset?: boolean;
}): React.ReactNode {
  const [isFullPage, setIsFullPage] = useState(false);

  const shot = (
    <div
      style={inset ? undefined : { width: width ?? '100%', height: height ?? '100%' }}
      className={WEB_SHOT_CLASS}
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
    </div>
  );

  if (!inset) return shot;
  return (
    <div className={`h-full w-full ${WEB_SHOT_INSET}`} style={{ width, height }}>
      {shot}
    </div>
  );
}
