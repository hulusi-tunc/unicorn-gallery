'use client';

import { type CSSProperties, type ReactNode, useCallback, useState } from 'react';
import { chooseBezel } from '@/lib/bezel-specs';

/**
 * Aspect-aware device bezel.
 *
 * The gallery used to wrap every screenshot in the iPhone 17 bezel, so iPad
 * (and landscape) captures got squeezed into a phone and clipped. This picks
 * the frame whose screen-cutout aspect is closest to the screenshot's, measured
 * from the image once it loads. Until then it renders the iPhone frame, so
 * server output and the first paint match the previous behaviour and only
 * iPad/landscape captures shift (to the correct frame) on load.
 *
 * Frame specs live in lib/bezel-specs.ts, shared with the PDF export so both
 * render the same frame for a given screenshot. The caller sizes the bezel via
 * `style` (height / position / filter); the container's aspect-ratio is driven
 * by the chosen frame.
 */

const FRAME_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  userSelect: 'none',
};

export function DeviceBezel({
  src,
  alt,
  scrollable,
  objectFit = 'cover',
  objectPosition = 'top center',
  className,
  style,
}: {
  src: string;
  alt: string;
  /** Scroll the screen vertically (detail view — long full-page captures). */
  scrollable?: boolean;
  objectFit?: 'cover' | 'contain';
  objectPosition?: string;
  className?: string;
  /** Caller sizing — height / position / filter. Aspect-ratio is set here. */
  style?: CSSProperties;
}): ReactNode {
  const [ratio, setRatio] = useState<number | null>(null);
  const spec = chooseBezel(ratio);

  // onLoad alone misses images that finish loading before React hydrates
  // (cached screenshots on the statically-rendered public share page), which
  // left iPad captures stuck in the iPhone frame. The ref callback re-checks
  // an already-complete image on mount.
  const measure = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth && img.naturalHeight) {
      setRatio(img.naturalWidth / img.naturalHeight);
    }
  }, []);

  return (
    <div
      className={className}
      style={{ position: 'relative', aspectRatio: `${spec.frameAspect}`, flexShrink: 0, ...style }}
    >
      <div
        className={scrollable ? 'iphone-bezel-screen-scroll' : undefined}
        style={{
          position: 'absolute',
          top: `${spec.top}%`,
          left: `${spec.left}%`,
          width: `${spec.width}%`,
          height: `${spec.height}%`,
          overflowY: scrollable ? 'auto' : 'hidden',
          overflowX: 'hidden',
          borderRadius: spec.radius,
          background: '#000',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={measure}
          src={src}
          alt={alt}
          draggable={false}
          loading="lazy"
          onLoad={(e) => {
            const t = e.currentTarget;
            if (t.naturalWidth && t.naturalHeight) setRatio(t.naturalWidth / t.naturalHeight);
          }}
          style={
            scrollable
              ? { display: 'block', width: '100%', height: 'auto' }
              : { display: 'block', width: '100%', height: '100%', objectFit, objectPosition }
          }
        />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={spec.light} alt="" aria-hidden className="block dark:hidden" style={FRAME_STYLE} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={spec.dark} alt="" aria-hidden className="hidden dark:block" style={FRAME_STYLE} />
    </div>
  );
}
