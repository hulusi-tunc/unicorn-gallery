import type { Platform } from '@unicorn-studio/gallery-capture';
import type { ReactNode } from 'react';
import { DeviceBezel } from '@/components/device-bezel';

export function DeviceFrame({
  platform,
  src,
  alt,
}: {
  platform: Platform;
  src: string;
  alt: string;
}): ReactNode {
  if (platform === 'web') {
    // Full-page snaps can be 8000+ px tall — fit-to-height collapses them
    // into an unreadable matchstick. Fit-to-width with a vertical scroll
    // shows the page at a readable scale and lets the user scroll like
    // they would in the real browser. Container caps both axes so a
    // viewport-only (1440×900) snap stays in-view without scrolling.
    return (
      <div
        style={{
          maxHeight: 'min(86vh, calc(100vh - 280px))',
          maxWidth: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          style={{
            display: 'block',
            width: 'min(1200px, 100%)',
            height: 'auto',
          }}
        />
      </div>
    );
  }

  // Mobile — viewport-driven container so the bezel scales with screen height.
  // Sized off the inner viewport: chrome (top nav 60 + app header 56 + breadcrumb 49 +
  // kbd footer 41 + filmstrip 144) ≈ 350px, so bezel can take most of what's left.
  // The bezel screen scrolls so full-page (taller-than-viewport) captures
  // can be browsed inside the device frame, matching the running app.
  return (
    <DeviceBezel
      src={src}
      alt={alt}
      scrollable
      style={{
        height: 'min(92vh, calc(100vh - 360px))',
        filter: 'drop-shadow(0 30px 50px rgba(0,0,0,0.45))',
      }}
    />
  );
}
