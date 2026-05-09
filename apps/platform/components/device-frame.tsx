import type { Platform } from '@unicorn-studio/gallery-capture';
import type { ReactNode } from 'react';
import { IPhoneBezel, IPHONE_BEZEL_ASPECT } from '@/components/iphone-bezel';

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
    return (
      <div
        style={{
          overflow: 'hidden',
          borderRadius: 12,
          border: '1px solid rgba(120,120,140,0.2)',
          background: '#000',
          boxShadow: '0 30px 80px -20px rgba(0,0,0,0.6)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          style={{
            display: 'block',
            maxHeight: '72vh',
            maxWidth: '100%',
            width: 'auto',
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
    <div
      style={{
        height: 'min(92vh, calc(100vh - 360px))',
        aspectRatio: IPHONE_BEZEL_ASPECT,
        filter: 'drop-shadow(0 30px 50px rgba(0,0,0,0.45))',
      }}
    >
      <IPhoneBezel scrollable>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
          }}
          loading="eager"
        />
      </IPhoneBezel>
    </div>
  );
}
