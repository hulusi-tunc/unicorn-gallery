'use client';

import { type MouseEvent, useEffect, useState } from 'react';

/**
 * Hand-off from a clicked frame card to the frame modal's loading state.
 *
 * Opening a frame is a server round trip (app, manifest, frame row, comments),
 * and until it lands the modal route has nothing to render — the click looked
 * like it did nothing. The card already knows what the modal will show: the
 * screenshot (the same URL the thumbnail used, so it is usually in the browser
 * cache already), its name and its flow. It primes that here on click, and
 * the modal's loading.tsx reads it back to open instantly with the real image
 * while the rest of the modal is fetched.
 *
 * Module state, not React state: the loading boundary mounts in a different
 * tree from the card, and nothing here needs to re-render anyone.
 */

export interface FramePreview {
  src: string;
  name: string;
  flowName?: string;
  isMobile: boolean;
  /** 1-based position in the flow, and the flow's length, when known. */
  index?: number;
  total?: number;
  /**
   * 'open' — from a card: the modal is not on screen yet and should scale in.
   * 'switch' — prev/next inside the modal: it is already open, so no entrance.
   */
  mode: 'open' | 'switch';
  /** Set once a loading shell has shown (and animated) this click. */
  shellShown?: boolean;
}

const PREVIEW_TTL_MS = 15_000;

let current: (FramePreview & { at: number }) | null = null;
const preloaded = new Set<string>();
/** Screenshots known to be downloaded and decoded in this tab. */
const decoded = new Set<string>();

/**
 * A card click that has not reached the modal yet. FrameOpenOverlay renders
 * the loading shell from this on the same frame as the click, so the modal
 * appears even before the router has heard back from the server; the route's
 * own loading state or the real modal clears it when they mount.
 */
let pendingOpen: FramePreview | null = null;
const listeners = new Set<() => void>();
const emit = (): void => {
  for (const l of listeners) l();
};

export function subscribePendingOpen(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPendingOpen(): FramePreview | null {
  return pendingOpen;
}

export function clearPendingOpen(): void {
  if (!pendingOpen) return;
  pendingOpen = null;
  emit();
}

export function primeFramePreview(preview: FramePreview): void {
  current = { ...preview, at: Date.now() };
  preloadImage(preview.src);
  if (preview.mode === 'open') {
    pendingOpen = current;
    emit();
  }
}

export function readFramePreview(): FramePreview | null {
  if (!current || Date.now() - current.at > PREVIEW_TTL_MS) return null;
  return current;
}

/** A loading shell calls this so the next one, and the real modal, do not animate in again. */
export function markShellShown(): void {
  if (current) current.shellShown = true;
}

/**
 * Whether the modal should scale in: yes for a fresh open, no for prev/next
 * (it is already on screen) or when a loading shell already animated it.
 * No preview at all (a deep link, a notification) counts as a fresh open.
 */
export function shouldAnimateIn(): boolean {
  const p = readFramePreview();
  return !p || (p.mode === 'open' && !p.shellShown);
}

/** Start fetching and decoding a screenshot before it is needed. */
export function preloadImage(src: string): void {
  if (typeof window === 'undefined' || preloaded.has(src)) return;
  preloaded.add(src);
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  img.decode().then(() => decoded.add(src), () => {});
}

/**
 * True once `src` is downloaded and decoded, so the caller can show a loading
 * state instead of an empty box while a multi-megabyte screenshot arrives.
 * A screenshot already decoded in this tab (preloaded, or seen before) is
 * ready on the first render, so moving between cached frames never flashes
 * a placeholder. The state starts false otherwise, server render included,
 * to keep hydration stable.
 */
export function useImageReady(src: string): boolean {
  const [readySrc, setReadySrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    const done = (): void => {
      decoded.add(src);
      if (alive) setReadySrc(src);
    };
    if (img.complete && img.naturalWidth > 0) done();
    // decode() rejects on a broken image; treat that as "done" too, so the
    // browser's own broken-image state shows instead of a spinner forever.
    else img.decode().then(done, done);
    return () => {
      alive = false;
    };
  }, [src]);
  return readySrc === src || decoded.has(src);
}

/**
 * A click that will navigate in place, as opposed to a new tab or window
 * (cmd/ctrl/shift/middle click), where priming the in-page shell would open
 * a modal nobody asked for.
 */
export function isPlainClick(e: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}): boolean {
  return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

/**
 * Props for a frame card's Link: prime the modal's loading shell on click,
 * and warm the screenshot on hover or keyboard focus.
 */
export function frameCardHandlers(preview: Omit<FramePreview, 'mode'>): {
  onClick: (e: MouseEvent) => void;
  onPointerEnter: () => void;
  onFocus: () => void;
} {
  return {
    onClick: (e) => {
      if (isPlainClick(e)) primeFramePreview({ ...preview, mode: 'open' });
    },
    onPointerEnter: () => preloadImage(preview.src),
    onFocus: () => preloadImage(preview.src),
  };
}
