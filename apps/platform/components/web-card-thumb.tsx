'use client';

import { useState } from 'react';

/**
 * Thumbnail for a web frame card. Detects tall/full-page snaps on image
 * load (aspect ratio > ~1.4 = visibly taller than wide) and renders a
 * "FULL PAGE" badge + a bottom fade so the user can tell at a glance
 * that the snap continues below the fold. Keeps the same fixed footprint
 * as viewport-only cards so the journey strip stays uniform.
 */
export function WebCardThumb({
  src,
  alt,
  width,
  height,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
}): React.ReactNode {
  const [isFullPage, setIsFullPage] = useState(false);

  return (
    <div
      style={{ width, height, position: 'relative' }}
      className="overflow-hidden rounded-md bg-neutral-50 shadow-md transition-all group-hover:shadow-xl dark:bg-neutral-900"
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
      {isFullPage ? (
        <>
          <span
            className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-black/65 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-white"
            title="Full-page capture — click to scroll"
          >
            FULL PAGE
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/45 via-black/15 to-transparent"
          />
        </>
      ) : null}
    </div>
  );
}
