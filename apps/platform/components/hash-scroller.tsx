'use client';

import { useEffect } from 'react';

/**
 * Scrolls the element matching `window.location.hash` into view on mount
 * and on subsequent hashchange events. Needed because the overview's
 * `<main>` is an internal scroll container — the browser's default hash
 * anchor scroll only moves the document scroll, not nested overflows.
 *
 * Mounted invisibly on the overview page so cross-page navigation from
 * the sidebar (which sets `/app/[slug]#flow-X`) lands at the right
 * section.
 */
export function HashScroller(): null {
  useEffect(() => {
    const scrollToHash = (): void => {
      const hash = window.location.hash;
      if (!hash) return;
      const target = document.getElementById(hash.slice(1));
      if (!target) return;
      // Defer one frame so the browser has finished initial layout —
      // otherwise scrollIntoView fires before the page is paint-ready
      // and lands a bit off on Safari.
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };
    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
  }, []);
  return null;
}
