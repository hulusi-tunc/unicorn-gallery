import type { CSSProperties, ReactNode } from 'react';

/**
 * iPhone 15 Pro bezel sandwich.
 *
 * Composes a screenshot under a transparent-middle bezel PNG so the screenshot
 * shows up where the screen would be. Source bezel: 473×932 (RGBA).
 * Inner screen viewport: 393×852, inset 40px on every side.
 *
 * Two sizing modes:
 *   1. Pass `width` or `height` (px) to size the bezel directly.
 *   2. Omit both — the bezel takes 100% of its parent container, which
 *      should set the size via aspect-ratio (use IPHONE_BEZEL_ASPECT).
 */

const BEZEL_W = 473;
const BEZEL_H = 932;
const FRAME_INSET_X_PCT = (40 / BEZEL_W) * 100; // 8.46%
const FRAME_INSET_Y_PCT = (40 / BEZEL_H) * 100; // 4.29%
const SCREEN_W_PCT = (393 / BEZEL_W) * 100;     // 83.09%
const SCREEN_H_PCT = (852 / BEZEL_H) * 100;     // 91.42%

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
          // Proportional iPhone-15-Pro screen corner radius.
          borderRadius: 'min(14% / 2, 56px)',
          background: '#000',
        }}
      >
        {children}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/iphone-15-pro.png"
        alt=""
        aria-hidden
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
