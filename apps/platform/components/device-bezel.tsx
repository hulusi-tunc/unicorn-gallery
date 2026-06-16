'use client';

import { type CSSProperties, type ReactNode, useState } from 'react';

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
 * Insets are measured from each frame PNG's transparent screen cutout. The
 * caller sizes the bezel via `style` (height / position / filter); the
 * container's aspect-ratio is driven by the chosen frame.
 */

interface BezelSpec {
  /** Screen-cutout aspect (w/h) — matched against the screenshot ratio. */
  screenAspect: number;
  /** Frame PNG aspect (w/h) — the container's aspect-ratio. */
  frameAspect: number;
  /** Screen-cutout box as a % of the frame. */
  top: number;
  left: number;
  width: number;
  height: number;
  radius: string;
  /** Frame PNG(s). iPad frames are theme-neutral so light === dark. */
  light: string;
  dark: string;
}

const IPHONE: BezelSpec = {
  screenAspect: 0.488,
  frameAspect: 450 / 920,
  top: 2.5,
  left: 5.33,
  width: 89.33,
  height: 95,
  radius: 'min(13% / 2, 60px)',
  light: '/iphone-17.png',
  dark: '/iphone-17-dark.png',
};

const IPADS: BezelSpec[] = [
  // portrait
  { screenAspect: 0.657, frameAspect: 890 / 1275, top: 5.57, left: 8.2, width: 83.6, height: 88.86, radius: '2.6%', light: '/ipad-mini-portrait.png', dark: '/ipad-mini-portrait.png' },
  { screenAspect: 0.689, frameAspect: 940 / 1320, top: 4.17, left: 5.64, width: 88.72, height: 91.66, radius: '2.6%', light: '/ipad-11-portrait.png', dark: '/ipad-11-portrait.png' },
  { screenAspect: 0.75, frameAspect: 1150 / 1500, top: 4.13, left: 5.13, width: 89.74, height: 91.74, radius: '2.6%', light: '/ipad-13-portrait.png', dark: '/ipad-13-portrait.png' },
  // landscape
  { screenAspect: 1.523, frameAspect: 1275 / 890, top: 8.2, left: 5.57, width: 88.86, height: 83.6, radius: '2.6%', light: '/ipad-mini.png', dark: '/ipad-mini.png' },
  { screenAspect: 1.451, frameAspect: 1320 / 940, top: 5.64, left: 4.17, width: 91.66, height: 88.72, radius: '2.6%', light: '/ipad-11.png', dark: '/ipad-11.png' },
  { screenAspect: 1.333, frameAspect: 1500 / 1150, top: 5.13, left: 4.13, width: 91.74, height: 89.74, radius: '2.6%', light: '/ipad-13.png', dark: '/ipad-13.png' },
];

/** Closest frame to a screenshot ratio (log-distance, symmetric for orientation). */
function chooseBezel(ratio: number | null): BezelSpec {
  if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) return IPHONE;
  let best = IPHONE;
  let bestDist = Math.abs(Math.log(ratio / IPHONE.screenAspect));
  for (const b of IPADS) {
    const d = Math.abs(Math.log(ratio / b.screenAspect));
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return best;
}

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
