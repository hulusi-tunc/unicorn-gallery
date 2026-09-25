import type { CSSProperties, ReactNode } from 'react';

/**
 * Browser-window chrome for web captures — the web counterpart of
 * DeviceBezel.
 *
 * A web screenshot is usually white on a white page, so without an edge it
 * dissolves into the gallery. This draws a thin window bar (three neutral
 * dots and, at the larger sizes, an address pill) above the screenshot and a
 * hairline around the whole window. The chrome is drawn around the image,
 * never baked into it, so the capture itself stays untouched and comment
 * pins keep normalising against the screenshot alone.
 *
 * Sizes follow where the frame is used:
 *   sm — grid and strip thumbnails: dots only, a bar just tall enough to read
 *        as a window.
 *   md — the project card preview: dots and an optional address.
 *   lg — the single-frame views: full-size bar with the address pill.
 */

type Size = 'sm' | 'md' | 'lg';

const BAR_HEIGHT: Record<Size, number> = { sm: 14, md: 20, lg: 32 };
const DOT: Record<Size, number> = { sm: 4, md: 6, lg: 8 };
const DOT_GAP: Record<Size, number> = { sm: 3, md: 4, lg: 6 };
const RADIUS: Record<Size, number> = { sm: 8, md: 10, lg: 12 };

// Two-layer lift, matched to the mobile bezel's drop shadow so web and mobile
// cards read as one system.
const ELEVATION =
  'shadow-[0_0_0_1px_rgba(15,15,20,0.08),0_18px_32px_-8px_rgba(15,15,20,0.16),0_6px_12px_-4px_rgba(15,15,20,0.08)] ' +
  'dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_18px_32px_-8px_rgba(0,0,0,0.5),0_6px_12px_-4px_rgba(0,0,0,0.3)]';
const HAIRLINE =
  'shadow-[0_0_0_1px_rgba(15,15,20,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]';

export function BrowserFrame({
  size = 'sm',
  address,
  elevated = false,
  clipContent = true,
  fill = false,
  className = '',
  style,
  children,
}: {
  size?: Size;
  /** Text for the address pill (md and lg only). Omit for dots only. */
  address?: string;
  /** Lift the window with a soft shadow. Off where a parent clips it anyway. */
  elevated?: boolean;
  /**
   * Clip the screenshot to the window's bottom corners. Turn off when
   * something inside must overflow the window — the comment pin popover —
   * and round the content yourself.
   */
  clipContent?: boolean;
  /** Fill the parent (thumbnails in a fixed-aspect tile). */
  fill?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}): ReactNode {
  const radius = RADIUS[size];
  const bar = BAR_HEIGHT[size];
  const showAddress = Boolean(address) && size !== 'sm';

  return (
    <div
      className={`flex flex-col bg-white dark:bg-[oklch(0.2_0.008_260)] ${elevated ? ELEVATION : HAIRLINE} ${className}`}
      style={{
        borderRadius: radius,
        ...(fill ? { width: '100%', height: '100%' } : null),
        ...style,
      }}
    >
      <div
        aria-hidden
        className="relative flex shrink-0 items-center border-b border-[oklch(0.91_0.004_260)] bg-[oklch(0.965_0.003_260)] dark:border-[oklch(0.3_0.008_260)] dark:bg-[oklch(0.24_0.007_260)]"
        style={{
          height: bar,
          paddingLeft: bar * 0.55,
          paddingRight: bar * 0.55,
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
        }}
      >
        <div className="flex shrink-0 items-center" style={{ gap: DOT_GAP[size] }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block rounded-full bg-[oklch(0.82_0.005_260)] dark:bg-[oklch(0.42_0.008_260)]"
              style={{ width: DOT[size], height: DOT[size] }}
            />
          ))}
        </div>
        {showAddress ? (
          <div className="pointer-events-none absolute inset-y-0 left-1/2 flex w-[min(60%,520px)] -translate-x-1/2 items-center">
            <span
              className="block w-full truncate rounded-md bg-white text-center font-mono text-[oklch(0.48_0.01_260)] ring-1 ring-[oklch(0.9_0.004_260)] dark:bg-[oklch(0.19_0.007_260)] dark:text-[oklch(0.68_0.01_260)] dark:ring-[oklch(0.3_0.008_260)]"
              style={{
                fontSize: size === 'lg' ? 12 : 10,
                lineHeight: `${Math.round(bar * 0.62)}px`,
                paddingInline: 10,
              }}
            >
              {address}
            </span>
          </div>
        ) : null}
      </div>
      <div
        className="relative min-h-0 flex-1"
        style={
          clipContent
            ? {
                overflow: 'hidden',
                borderBottomLeftRadius: radius,
                borderBottomRightRadius: radius,
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}

/** Bar height for a size, for callers that reserve space around the chrome. */
export function browserBarHeight(size: Size): number {
  return BAR_HEIGHT[size];
}
