'use client';

import { Minus, Plus, RotateCcw } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

/**
 * Zoomable, pannable stage for a single frame.
 *
 * Zoom is applied as *layout* size (height for a device bezel, width for a web
 * capture) rather than a CSS transform, so the surrounding scroll container
 * gets real overflow. That means panning, clamping, scrollbars, wheel and
 * trackpad two-finger scrolling all come from the browser — we only translate
 * gestures into a scale and keep the point under the cursor pinned.
 *
 * Deliberately not a free canvas: MIN_SCALE is 1 (fit), so the frame can never
 * be shrunk into a corner or lost off-screen.
 *
 * Gesture map, chosen so nothing existing breaks:
 *   ⌘/ctrl + wheel, trackpad pinch  → zoom at the cursor
 *   plain wheel                     → scroll, exactly as before
 *   drag                            → pan (only where it can't collide with
 *                                     comment-pin placement — see dragToPan)
 *   middle-drag, space + drag       → pan, always
 *   double-click                    → toggle fit ⇄ 2× at the cursor
 *   + / - / 0                       → zoom in / out / reset
 */

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const STEP = 0.25;
/** Trackpad pinch arrives as ctrl+wheel with small deltas; damp it to taste. */
const WHEEL_SENSITIVITY = 0.0035;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function ZoomStage({
  /** 'height' sizes the child by height (device bezels), 'width' by width (web captures). */
  mode,
  /** Changing this resets zoom — pass the active frame id. */
  resetKey,
  /**
   * Allow plain left-drag to pan. Off for web captures, where left-drag is how
   * you place a comment pin; those pan with middle-drag, space+drag or wheel.
   */
  dragToPan = false,
  /** Max natural width at 1× for 'width' mode. */
  maxWidth,
  /**
   * Chrome pinned to the stage rather than the content — prev/next arrows.
   * Rendered as a sibling of the scroller so it neither scales nor pans.
   */
  overlay,
  children,
}: {
  mode: 'height' | 'width';
  resetKey: string;
  dragToPan?: boolean;
  maxWidth?: number;
  overlay?: ReactNode;
  children: ReactNode;
}): ReactNode {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [panning, setPanning] = useState(false);
  const spaceHeld = useRef(false);
  /**
   * Where to re-anchor the scroll offset after a zoom re-layout. Held in a ref
   * because it has to be applied after React paints the new size, not during
   * the event that requested it.
   */
  const anchor = useRef<{ scale: number; x: number; y: number } | null>(null);

  // Reset when the frame changes — carrying 3× zoom onto the next screen is
  // never what you meant.
  useEffect(() => {
    setScale(1);
    anchor.current = null;
    const el = scrollerRef.current;
    if (el) {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    }
  }, [resetKey]);

  /**
   * Scale about a viewport point. Content size is linear in scale, so the
   * scroll offset that keeps `(px, py)` visually fixed is just the old offset
   * plus the cursor position, ratioed by the scale change.
   */
  const zoomTo = useCallback((next: number, px?: number, py?: number) => {
    setScale((prev) => {
      const s = clamp(Number(next.toFixed(3)), MIN_SCALE, MAX_SCALE);
      if (s === prev) return prev;
      const el = scrollerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const cx = px === undefined ? rect.width / 2 : px - rect.left;
        const cy = py === undefined ? rect.height / 2 : py - rect.top;
        const ratio = s / prev;
        anchor.current = {
          scale: s,
          x: (el.scrollLeft + cx) * ratio - cx,
          y: (el.scrollTop + cy) * ratio - cy,
        };
      }
      return s;
    });
  }, []);

  // Apply the anchor once the new layout size has been committed.
  useLayoutEffect(() => {
    const a = anchor.current;
    const el = scrollerRef.current;
    if (!a || !el || a.scale !== scale) return;
    anchor.current = null;
    el.scrollLeft = a.x;
    el.scrollTop = a.y;
  }, [scale]);

  // Wheel must be a non-passive native listener — React's onWheel is passive,
  // so preventDefault() there won't stop the browser's own pinch-zoom.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return; // plain scroll — leave it alone
      e.preventDefault();
      setScale((prev) => {
        const s = clamp(
          Number((prev * Math.exp(-e.deltaY * WHEEL_SENSITIVITY)).toFixed(3)),
          MIN_SCALE,
          MAX_SCALE,
        );
        if (s === prev) return prev;
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const ratio = s / prev;
        anchor.current = {
          scale: s,
          x: (el.scrollLeft + cx) * ratio - cx,
          y: (el.scrollTop + cy) * ratio - cy,
        };
        return s;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Keyboard: +/-/0. Escape and arrows stay with the modal.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return;
      if (e.code === 'Space') {
        spaceHeld.current = true;
        return;
      }
      if (e.metaKey || e.ctrlKey) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo(scale + STEP); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomTo(scale - STEP); }
      else if (e.key === '0') { e.preventDefault(); zoomTo(1); }
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'Space') spaceHeld.current = false;
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [scale, zoomTo]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = scrollerRef.current;
      if (!el) return;
      const wantsPan = e.button === 1 || spaceHeld.current || (dragToPan && e.button === 0);
      if (!wantsPan) return;
      // Nothing to pan when the frame already fits.
      if (el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth) return;

      e.preventDefault();
      setPanning(true);
      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = el.scrollLeft;
      const startTop = el.scrollTop;

      const onMove = (ev: PointerEvent): void => {
        el.scrollLeft = startLeft - (ev.clientX - startX);
        el.scrollTop = startTop - (ev.clientY - startY);
      };
      const onUp = (): void => {
        setPanning(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [dragToPan],
  );

  const onDoubleClick = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      zoomTo(scale > 1 ? 1 : 2, e.clientX, e.clientY);
    },
    [scale, zoomTo],
  );

  const zoomed = scale > 1;
  const sizing =
    mode === 'height'
      ? { height: `${scale * 100}%` }
      : { width: `${scale * 100}%`, maxWidth: maxWidth ? `${maxWidth * scale}px` : undefined };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollerRef}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        className="no-scrollbar flex-1 overflow-auto overscroll-contain bg-[oklch(0.195_0.008_260)]"
        style={{
          cursor: panning ? 'grabbing' : zoomed && dragToPan ? 'grab' : undefined,
          // Let the browser hand us pinch gestures instead of page-zooming.
          touchAction: 'pan-x pan-y',
        }}
      >
        <div
          className={`flex px-16 py-8 ${mode === 'height' ? 'h-full' : 'min-h-full'} ${
            zoomed ? 'w-max min-w-full' : ''
          }`}
        >
          {/* Auto margins, not items-center: a centred flex item that overflows
              its container makes the top/left unreachable by scrolling. */}
          <div className="m-auto shrink-0" style={sizing}>
            {children}
          </div>
        </div>
      </div>

      {overlay}
      <ZoomControls scale={scale} onZoom={zoomTo} />
    </div>
  );
}

function ZoomControls({
  scale,
  onZoom,
}: {
  scale: number;
  onZoom: (next: number) => void;
}): ReactNode {
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-20 flex items-center gap-0.5 rounded-full border border-white/10 bg-black/55 p-1 backdrop-blur-md">
      <ZoomButton
        label="Zoom out"
        disabled={scale <= MIN_SCALE}
        onClick={() => onZoom(scale - STEP)}
      >
        <Minus size={15} />
      </ZoomButton>
      <button
        type="button"
        onClick={() => onZoom(1)}
        title="Reset zoom (0)"
        className="pointer-events-auto min-w-[52px] rounded-full px-2 py-1 text-center text-[12px] tabular-nums text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        {Math.round(scale * 100)}%
      </button>
      <ZoomButton
        label="Zoom in"
        disabled={scale >= MAX_SCALE}
        onClick={() => onZoom(scale + STEP)}
      >
        <Plus size={15} />
      </ZoomButton>
      <ZoomButton label="Reset zoom" disabled={scale === 1} onClick={() => onZoom(1)}>
        <RotateCcw size={14} />
      </ZoomButton>
    </div>
  );
}

function ZoomButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
