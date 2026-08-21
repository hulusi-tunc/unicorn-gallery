'use client';

import type { ManifestFlow, Platform } from '@unicorn-studio/gallery-capture';
import { ArrowLeft, ArrowRight, Link2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const CommentsPanel = dynamic(
  () => import('@/components/comments-panel').then((m) => ({ default: m.CommentsPanel })),
  { ssr: false, loading: () => <div className="flex-1 animate-pulse rounded-2xl bg-white/5" /> },
);
import { DeviceBezel } from '@/components/device-bezel';
import { Filmstrip } from '@/components/filmstrip';
import type { CommentWithAuthor } from '@/lib/comments';
import { imageHref } from '@/lib/image-href';
import type { MentionableProfile } from '@/lib/queries';

export function FrameModal({
  appName,
  appIconUrl,
  accentColor,
  appSlug,
  appId,
  platform,
  flow,
  activeFrameId,
  src,
  videoSrc,
  frameName,
  frameRowId,
  comments,
  isAgency,
  currentUserId,
  mentionables,
  readOnly = false,
  versionQuery = '',
  closeHref,
}: {
  appName: string;
  appIconUrl: string | null;
  accentColor: string | null;
  appSlug: string;
  appId: string;
  platform: Platform;
  flow: ManifestFlow;
  activeFrameId: string;
  src: string;
  videoSrc?: string;
  frameName: string;
  frameRowId: string;
  comments: CommentWithAuthor[];
  isAgency: boolean;
  currentUserId: string | null;
  mentionables: MentionableProfile[];
  readOnly?: boolean;
  versionQuery?: string;
  /** When set, close navigates here instead of router.back(). Used for direct-URL visits. */
  closeHref?: string;
}): ReactNode {
  const router = useRouter();
  const isMobile = platform !== 'web';
  const [copied, setCopied] = useState(false);

  const idx = flow.frames.findIndex((f) => f.id === activeFrameId);
  const total = flow.frames.length;
  const prev = idx > 0 ? flow.frames[idx - 1] : undefined;
  const next = idx < total - 1 ? flow.frames[idx + 1] : undefined;
  const unresolvedCount = comments.filter((c) => !c.parent_id && !c.resolved_at).length;

  const frameHref = useCallback(
    (id: string): string =>
      `/app/${encodeURIComponent(appSlug)}/${encodeURIComponent(flow.id)}/${encodeURIComponent(id)}${versionQuery}`,
    [appSlug, flow.id, versionQuery],
  );

  const flowUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/app/${encodeURIComponent(appSlug)}/${encodeURIComponent(flow.id)}`
    : '';

  const copyFlowLink = useCallback(() => {
    navigator.clipboard.writeText(flowUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [flowUrl]);

  const close = useCallback(() => {
    if (closeHref) router.push(closeHref);
    else router.back();
  }, [router, closeHref]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement | null;
      const typing = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable;
      if (e.key === 'Escape') { close(); return; }
      if (typing) return;
      if (e.key === 'ArrowLeft' && prev) { e.preventDefault(); router.replace(frameHref(prev.id)); }
      else if (e.key === 'ArrowRight' && next) { e.preventDefault(); router.replace(frameHref(next.id)); }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [close, router, frameHref, prev, next]);

  return (
    <>
    {/* Prefetch adjacent frame images so arrow navigation feels instant */}
    {prev ? <link rel="prefetch" href={imageHref(prev.image)} as="image" /> : null}
    {next ? <link rel="prefetch" href={imageHref(next.image)} as="image" /> : null}
    {/* biome-ignore lint/a11y/useKeyWithClickEvents: Esc handled above. */}
    <div
      role="dialog"
      aria-modal="true"
      aria-label={flow.name}
      onClick={close}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      {/* Two-box layout: preview + comments side by side with gap */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full h-[80vh] max-w-[1800px] gap-3"
      >
        {/* Left box: preview + header + filmstrip */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[oklch(0.16_0.007_260)] shadow-2xl">
          {/* Header bar */}
          <div className="flex shrink-0 items-center gap-4 border-b border-white/5 px-5 py-3">
            <div className="flex items-center gap-2.5 text-sm">
              <span className="font-medium text-white">{flow.name}</span>
              <span className="text-white/35">in</span>
              {appIconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={appIconUrl} alt="" className="h-5 w-5 rounded" />
              ) : (
                <span
                  className="flex h-5 w-5 items-center justify-center rounded text-[13px] font-semibold text-white"
                  style={{ background: accentColor ?? 'oklch(0.5 0.22 254)' }}
                >
                  {appName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="font-semibold text-white">{appName}</span>
            </div>

            <span className="ml-auto text-[13px] tabular-nums text-white/35">
              {String(idx + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>

            <button
              type="button"
              onClick={copyFlowLink}
              className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] text-white/45 transition-colors hover:bg-white/8 hover:text-white"
              title="Copy flow link"
            >
              <Link2 size={15} />
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <button
              type="button"
              onClick={close}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/8 hover:text-white"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Image area */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[oklch(0.195_0.008_260)]">
              <div className="flex min-h-full items-center justify-center px-16 py-8">
                {videoSrc ? (
                  <div className="w-full max-w-[1100px] overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-[oklch(0.2_0.008_260)]">
                    <video
                      src={videoSrc}
                      poster={src}
                      autoPlay
                      muted
                      loop
                      playsInline
                      controls
                      className="h-auto w-full"
                      style={isMobile ? { maxWidth: 360, margin: '0 auto', display: 'block' } : undefined}
                    />
                  </div>
                ) : isMobile ? (
                  <DeviceBezel
                    src={src}
                    alt={frameName}
                    scrollable
                    style={{
                      height: 'min(75vh, calc(100vh - 260px))',
                      filter: 'drop-shadow(0 20px 50px rgba(0,0,0,0.4))',
                    }}
                  />
                ) : (
                  <div className="w-full max-w-[1100px] overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-[oklch(0.2_0.008_260)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={frameName} className="h-auto w-full" />
                  </div>
                )}
              </div>
            </div>

            {/* Prev/Next arrows */}
            {prev ? (
              <Link
                href={frameHref(prev.id)}
                scroll={false}
                replace
                aria-label={`Previous: ${prev.name}`}
                className="absolute left-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-[oklch(0.3_0.008_260)] text-white shadow-xl transition-transform hover:scale-105"
              >
                <ArrowLeft size={20} strokeWidth={2.5} />
              </Link>
            ) : null}
            {next ? (
              <Link
                href={frameHref(next.id)}
                scroll={false}
                replace
                aria-label={`Next: ${next.name}`}
                className="absolute right-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-[oklch(0.3_0.008_260)] text-white shadow-xl transition-transform hover:scale-105"
              >
                <ArrowRight size={20} strokeWidth={2.5} />
              </Link>
            ) : null}

            {/* Filmstrip */}
            <Filmstrip
              flow={flow}
              platform={platform}
              appSlug={appSlug}
              activeFrameId={activeFrameId}
              versionQuery={versionQuery}
              replace
            />
          </div>
        </div>

        {/* Right box: Comments - separate rounded box */}
        <div className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl bg-[oklch(0.16_0.007_260)] shadow-2xl">
          <CommentsPanel
            frameRowId={frameRowId}
            comments={comments}
            isAgency={isAgency}
            appSlug={appSlug}
            appId={appId}
            currentUserId={currentUserId}
            mentionables={mentionables}
            readOnly={readOnly}
            embedded
          />
        </div>
      </div>
    </div>
    </>
  );
}
