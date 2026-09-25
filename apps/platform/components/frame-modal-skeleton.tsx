'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useLayoutEffect, useState } from 'react';
import { DeviceBezel } from '@/components/device-bezel';
import {
  clearPendingOpen,
  type FramePreview,
  markShellShown,
  readFramePreview,
  shouldAnimateIn,
} from '@/lib/frame-preview';

/**
 * What the frame modal shows while its data is on the way.
 *
 * Same two-box layout, header and sizes as FrameModal, so when the real modal
 * replaces it nothing jumps. When a card primed the click (see
 * lib/frame-preview) it already shows the real screenshot, name and position
 * — usually straight from the browser cache — and only the comments column
 * waits. Without a primed preview (a notification link, say) it falls back
 * to neutral placeholders.
 *
 * The thin bar under the header says "still loading" for as long as this is
 * on screen.
 */
export function FrameModalSkeleton({
  preview: previewProp,
  onClose,
}: {
  /** Given by FrameOpenOverlay; the route's loading state reads the store. */
  preview?: FramePreview;
  /**
   * Close without navigating back. The overlay needs this: it shows before
   * the navigation has happened, so "back" would leave the project.
   */
  onClose?: () => void;
} = {}): ReactNode {
  const router = useRouter();
  // Read once on mount: the preview belongs to the click that brought us here.
  const [preview] = useState<FramePreview | null>(() => previewProp ?? readFramePreview());
  // Only the first shell of an opening animates; one taking over from another
  // (the click overlay, then the route's loading state) must not replay it.
  const [animateIn] = useState(() => shouldAnimateIn());
  const close = onClose ?? (() => router.back());

  // As the route's loading state, take over from the click overlay before
  // paint, so the two identical shells never stack for a frame.
  useLayoutEffect(() => {
    if (!previewProp) clearPendingOpen();
  }, [previewProp]);

  useEffect(() => {
    markShellShown();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [close]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc handled above.
    <div
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={preview?.name ?? 'Loading screen'}
      onClick={close}
      className={`dark fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm ${animateIn ? 'modal-backdrop-in' : ''}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex h-[90vh] w-full max-w-[1800px] flex-col gap-3 md:h-[80vh] md:flex-row ${animateIn ? 'modal-panel-in' : ''}`}
      >
        {/* Left box: header + preview */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[oklch(0.16_0.007_260)] shadow-2xl">
          <div className="flex shrink-0 items-center gap-2 border-b border-white/5 px-3 py-3 md:gap-4 md:px-5">
            {preview?.flowName ? (
              <span className="truncate text-sm font-medium text-white">{preview.flowName}</span>
            ) : (
              <span className="skeleton skeleton-dark block h-4 w-48 rounded" />
            )}
            <span className="ml-auto whitespace-nowrap text-[13px] tabular-nums text-white/35">
              {preview?.index && preview.total
                ? `${String(preview.index).padStart(2, '0')} / ${String(preview.total).padStart(2, '0')}`
                : ''}
            </span>
            <button
              type="button"
              onClick={close}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/8 hover:text-white"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="relative">
            <div className="loading-bar" />
          </div>

          {/* Image area: the same stage, padding and sizing as ZoomStage at
              1x, so the frame lands exactly where the real modal puts it. */}
          <div className="no-scrollbar min-h-0 flex-1 overflow-hidden bg-[oklch(0.195_0.008_260)]">
            <div className={`flex px-16 py-8 ${preview?.isMobile ? 'h-full' : 'min-h-full'}`}>
              {preview ? (
                preview.isMobile ? (
                  <div className="m-auto h-full shrink-0">
                    <DeviceBezel
                      src={preview.src}
                      alt={preview.name}
                      style={{ height: '100%', filter: 'drop-shadow(0 20px 50px rgba(0,0,0,0.4))' }}
                    />
                  </div>
                ) : (
                  <div className="m-auto w-full shrink-0" style={{ maxWidth: 1100 }}>
                    <div className="overflow-hidden rounded-xl bg-white shadow-2xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview.src} alt={preview.name} className="block h-auto w-full" />
                    </div>
                  </div>
                )
              ) : (
                <div className="m-auto w-full shrink-0" style={{ maxWidth: 1100 }}>
                  <div className="skeleton skeleton-dark w-full rounded-xl" style={{ aspectRatio: '16 / 10' }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right box: comments placeholder */}
        <div className="flex max-h-[45%] w-full shrink-0 flex-col gap-4 overflow-hidden rounded-2xl bg-[oklch(0.16_0.007_260)] p-5 shadow-2xl md:max-h-none md:w-[340px]">
          <span className="skeleton skeleton-dark block h-4 w-28 rounded" />
          <div className="mt-4 flex flex-col gap-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <span className="skeleton skeleton-dark block h-7 w-7 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <span className="skeleton skeleton-dark block h-3 w-24 rounded" />
                  <span className="skeleton skeleton-dark block h-3 w-full rounded" />
                  <span className="skeleton skeleton-dark block h-3 w-2/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
