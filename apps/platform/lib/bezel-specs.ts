/**
 * Aspect-aware device bezel specs, shared by the on-screen renderer
 * (components/device-bezel.tsx) and the PDF export
 * (app/api/projects/[slug]/download-pdf/route.ts) so both pick the same
 * frame for a given screenshot.
 *
 * Insets are measured from each frame PNG's transparent screen cutout and
 * expressed as a % of the frame box.
 */

export interface BezelSpec {
  /** Screen-cutout aspect (w/h) — matched against the screenshot ratio. */
  screenAspect: number;
  /** Frame PNG aspect (w/h) — the container's aspect-ratio. */
  frameAspect: number;
  /** Screen-cutout box as a % of the frame. */
  top: number;
  left: number;
  width: number;
  height: number;
  /** CSS border-radius for the screen cutout (client rendering). */
  radius: string;
  /** Screen-corner radius as a fraction of screen width (PDF rendering). */
  radiusFrac: number;
  /** Optional cap on the radius in px/pt, matching the CSS min() clamp. */
  radiusCapPx?: number;
  /** Frame PNG(s). iPad frames are theme-neutral so light === dark. */
  light: string;
  dark: string;
}

export const IPHONE: BezelSpec = {
  screenAspect: 0.488,
  frameAspect: 450 / 920,
  top: 2.5,
  left: 5.33,
  width: 89.33,
  height: 95,
  radius: 'min(13% / 2, 60px)',
  radiusFrac: 0.065,
  radiusCapPx: 60,
  light: '/iphone-17.png',
  dark: '/iphone-17-dark.png',
};

export const IPADS: BezelSpec[] = [
  // portrait
  { screenAspect: 0.657, frameAspect: 890 / 1275, top: 5.57, left: 8.2, width: 83.6, height: 88.86, radius: '2.6%', radiusFrac: 0.026, light: '/ipad-mini-portrait.png', dark: '/ipad-mini-portrait.png' },
  { screenAspect: 0.689, frameAspect: 940 / 1320, top: 4.17, left: 5.64, width: 88.72, height: 91.66, radius: '2.6%', radiusFrac: 0.026, light: '/ipad-11-portrait.png', dark: '/ipad-11-portrait.png' },
  { screenAspect: 0.75, frameAspect: 1150 / 1500, top: 4.13, left: 5.13, width: 89.74, height: 91.74, radius: '2.6%', radiusFrac: 0.026, light: '/ipad-13-portrait.png', dark: '/ipad-13-portrait.png' },
  // landscape
  { screenAspect: 1.523, frameAspect: 1275 / 890, top: 8.2, left: 5.57, width: 88.86, height: 83.6, radius: '2.6%', radiusFrac: 0.026, light: '/ipad-mini.png', dark: '/ipad-mini.png' },
  { screenAspect: 1.451, frameAspect: 1320 / 940, top: 5.64, left: 4.17, width: 91.66, height: 88.72, radius: '2.6%', radiusFrac: 0.026, light: '/ipad-11.png', dark: '/ipad-11.png' },
  { screenAspect: 1.333, frameAspect: 1500 / 1150, top: 5.13, left: 4.13, width: 91.74, height: 89.74, radius: '2.6%', radiusFrac: 0.026, light: '/ipad-13.png', dark: '/ipad-13.png' },
];

/** Closest frame to a screenshot ratio (log-distance, symmetric for orientation). */
export function chooseBezel(ratio: number | null): BezelSpec {
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
