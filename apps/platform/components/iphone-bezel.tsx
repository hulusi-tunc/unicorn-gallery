import type { CSSProperties, ReactNode } from 'react';

/**
 * iPhone 17 bezel sandwich.
 *
 * Composes a screenshot under a transparent-middle bezel PNG so the screenshot
 * shows up where the screen would be. Source bezel: 450×920 (RGBA).
 * Inner screen viewport: 402×874, inset 24/23 px from the bezel edge.
 *
 * Two sizing modes:
 *   1. Pass `width` or `height` (px) to size the bezel directly.
 *   2. Omit both — the bezel takes 100% of its parent container, which
 *      should set the size via aspect-ratio (use IPHONE_BEZEL_ASPECT).
 */

const BEZEL_W = 450;
const BEZEL_H = 920;
const SCREEN_W = 402;
const SCREEN_H = 874;
const FRAME_INSET_X_PCT = ((BEZEL_W - SCREEN_W) / 2 / BEZEL_W) * 100; // 5.33%
const FRAME_INSET_Y_PCT = ((BEZEL_H - SCREEN_H) / 2 / BEZEL_H) * 100; // 2.50%
const SCREEN_W_PCT = (SCREEN_W / BEZEL_W) * 100;                     // 89.33%
const SCREEN_H_PCT = (SCREEN_H / BEZEL_H) * 100;                     // 95.00%

export const IPHONE_BEZEL_ASPECT = `${BEZEL_W} / ${BEZEL_H}`;
export const IPHONE_BEZEL_RATIO = BEZEL_W / BEZEL_H;

export function IPhoneBezel({
  width,
  height,
  children,
  className,
  style,
}: {
  /** Optional fixed px width. */
  width?: number;
  /** Optional fixed px height. */
  height?: number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}): ReactNode {
  const sized = width != null || height != null;
  const w = width ?? (height ? height * IPHONE_BEZEL_RATIO : undefined);
  const h = height ?? (width ? width / IPHONE_BEZEL_RATIO : undefined);

  const containerStyle: CSSProperties = sized
    ? {
        position: 'relative',
        width: w,
        height: h,
        flexShrink: 0,
        ...style,
      }
    : {
        position: 'relative',
        width: '100%',
        height: '100%',
        aspectRatio: IPHONE_BEZEL_ASPECT,
        ...style,
      };

  return (
    <div className={className} style={containerStyle}>
      <div
        style={{
          position: 'absolute',
          top: `${FRAME_INSET_Y_PCT}%`,
          left: `${FRAME_INSET_X_PCT}%`,
          width: `${SCREEN_W_PCT}%`,
          height: `${SCREEN_H_PCT}%`,
          overflow: 'hidden',
          // Proportional iPhone 17 screen corner radius.
          borderRadius: 'min(13% / 2, 60px)',
          background: '#000',
        }}
      >
        {children}
      </div>
      {/* Light bezel — visible in light mode, hidden in dark. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/iphone-17.png"
        alt=""
        aria-hidden
        className="block dark:hidden"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
      {/* Dark bezel — hidden in light mode, visible in dark. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/iphone-17-dark.png"
        alt=""
        aria-hidden
        className="hidden dark:block"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
    </div>
  );
}
