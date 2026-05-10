'use client';

import { History } from 'lucide-react';
import { useEffect, useState } from 'react';
import { imageHref } from '@/lib/image-href';

interface CaptureEntry {
  idx: number;
  image_url: string;
  captured_at: string;
}

/**
 * Per-frame version scrubber — mirrors Capture's lightbox version strip.
 *
 * Captures land here when the designer re-snapped the same screen
 * multiple times before pushing. idx 0 = latest, idx 1+ = past captures
 * newest-first. Clicking a chip swaps the bezel image; ↑/↓ scrubs
 * keyboard-style.
 *
 * Renders nothing when there's only one capture (no history to scrub).
 */
export function FrameVersionScrubber({
  captures,
  onSelect,
  activeIdx,
}: {
  captures: CaptureEntry[];
  onSelect: (entry: CaptureEntry) => void;
  activeIdx: number;
}): React.ReactNode {
  // ↑↓ keyboard nav: ↓ goes back in time (older), ↑ goes forward (latest).
  // Mirrors Capture's lightbox where ↓ scrubs to older entries.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (
        (ev.target as HTMLElement | null)?.tagName === 'INPUT' ||
        (ev.target as HTMLElement | null)?.tagName === 'TEXTAREA' ||
        (ev.target as HTMLElement | null)?.isContentEditable
      ) {
        return;
      }
      if (ev.key === 'ArrowDown') {
        const next = captures.find((c) => c.idx === activeIdx + 1);
        if (next) {
          ev.preventDefault();
          onSelect(next);
        }
      } else if (ev.key === 'ArrowUp') {
        const prev = captures.find((c) => c.idx === activeIdx - 1);
        if (prev) {
          ev.preventDefault();
          onSelect(prev);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [captures, activeIdx, onSelect]);

  if (captures.length <= 1) return null;
  const total = captures.length;

  return (
    <div className="flex flex-col gap-2 border-t border-[oklch(0.9_0.007_260)] bg-[oklch(0.97_0.004_260)] px-10 py-3 dark:border-[oklch(0.24_0.008_260)] dark:bg-[oklch(0.13_0.006_260)]">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
        <History size={12} />
        <span>Version history — {total} captures</span>
        <span className="ml-auto text-[oklch(0.55_0.01_260)] dark:text-[oklch(0.6_0.01_260)]">
          <kbd className="rounded border border-[oklch(0.85_0.009_260)] bg-white px-1 py-0.5 text-[9px] dark:border-[oklch(0.30_0.008_260)] dark:bg-[oklch(0.22_0.008_260)]">
            ↑
          </kbd>{' '}
          <kbd className="rounded border border-[oklch(0.85_0.009_260)] bg-white px-1 py-0.5 text-[9px] dark:border-[oklch(0.30_0.008_260)] dark:bg-[oklch(0.22_0.008_260)]">
            ↓
          </kbd>
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {/* Render newest-first (idx 0 = Latest) on the right, oldest on the left. */}
        {[...captures].reverse().map((c) => {
          const label = c.idx === 0 ? 'Latest' : `v${total - c.idx}`;
          const isActive = c.idx === activeIdx;
          return (
            <button
              key={c.idx}
              type="button"
              onClick={() => onSelect(c)}
              className={`group flex flex-shrink-0 flex-col items-center gap-1 rounded-md border-2 p-1 transition-colors ${
                isActive
                  ? 'border-[oklch(0.5_0.22_254)] bg-white dark:border-[oklch(0.6_0.21_254)] dark:bg-[oklch(0.18_0.007_260)]'
                  : 'border-transparent bg-[oklch(0.94_0.005_260)] hover:border-[oklch(0.85_0.009_260)] dark:bg-[oklch(0.18_0.007_260)] dark:hover:border-[oklch(0.30_0.008_260)]'
              }`}
              title={`${label} · ${new Date(c.captured_at).toLocaleString()}`}
            >
              <img
                src={imageHref(c.image_url)}
                alt=""
                className="h-16 w-10 rounded-sm object-cover"
                loading="lazy"
              />
              <span
                className={`font-mono text-[9px] font-semibold uppercase tracking-[0.06em] ${
                  isActive
                    ? 'text-[oklch(0.5_0.22_254)] dark:text-[oklch(0.6_0.21_254)]'
                    : 'text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]'
                }`}
              >
                {label}
              </span>
              <span className="text-[9px] text-[oklch(0.55_0.01_260)] dark:text-[oklch(0.6_0.01_260)]">
                {new Date(c.captured_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Stateful wrapper that pairs the scrubber with a state-driven image source.
 * The page passes the initial latest image (idx 0); we own the active idx
 * + the resulting src. Renders the scrubber + a render-prop signal so the
 * parent can swap the bezel image without prop drilling.
 */
export function FrameVersionStage({
  captures,
  initialSrc,
  children,
}: {
  captures: CaptureEntry[];
  initialSrc: string;
  children: (currentSrc: string) => React.ReactNode;
}): React.ReactNode {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = captures.find((c) => c.idx === activeIdx);
  const currentSrc = active ? imageHref(active.image_url) : initialSrc;

  return (
    <>
      {children(currentSrc)}
      <FrameVersionScrubber
        captures={captures}
        activeIdx={activeIdx}
        onSelect={(c) => setActiveIdx(c.idx)}
      />
    </>
  );
}
