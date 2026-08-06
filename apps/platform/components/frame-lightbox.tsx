'use client';

import { Maximize2, X } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

/**
 * Wraps a frame thumbnail and, on click, opens a full-screen overlay showing
 * the complete image at full width — scrollable top-to-bottom. This is what
 * makes full-page (tall) web captures usable on the read-only public share
 * view, where there is no per-frame detail page to navigate to. Works for
 * mobile frames too (narrower max width).
 */
export function FrameLightbox({
  src,
  name,
  isMobile = false,
  children,
}: {
  src: string;
  name: string;
  isMobile?: boolean;
  children: ReactNode;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open ${name}`}
        className="group relative block cursor-zoom-in appearance-none border-0 bg-transparent p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-md"
      >
        {children}
        <span className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-md bg-black/70 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100">
          <Maximize2 className="h-3.5 w-3.5" />
          Expand
        </span>
      </button>

      {open ? (
        // biome-ignore lint/a11y/useKeyWithClickEvents: Escape handled via keydown listener above.
        <div
          role="dialog"
          aria-modal="true"
          aria-label={name}
          onClick={close}
          className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-sm"
        >
          <div className="pointer-events-none sticky top-0 z-10 flex items-center justify-between gap-4 bg-gradient-to-b from-black/70 to-transparent px-5 py-4">
            <span className="pointer-events-auto max-w-[70%] truncate text-sm font-medium text-white/90">
              {name}
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex justify-center px-4 pb-16 pt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={name}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: isMobile ? 420 : 1200 }}
              className="h-auto w-full rounded-lg bg-white shadow-2xl"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
