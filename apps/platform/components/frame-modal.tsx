'use client';

import type { ManifestFlow, Platform } from '@unicorn-studio/gallery-capture';
import { ArrowLeft, ArrowRight, Link2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const CommentsPanel = dynamic(
  () => import('@/components/comments-panel').then((m) => ({ default: m.CommentsPanel })),
  { ssr: false, loading: () => <div className="flex-1 animate-pulse rounded-2xl bg-white/5" /> },
);
import { BrowserFrame } from '@/components/browser-frame';
import { DeviceBezel } from '@/components/device-bezel';
import { ZoomStage } from '@/components/zoom-stage';
import { MarkFrameRead } from '@/components/mark-frame-read';
import { PinOverlay, PinPopover, type PinDraft } from '@/components/pin-overlay';
import type { CommentWithAuthor } from '@/lib/comments';
import { postComment } from '@/lib/actions/comments';
import {
  clearPendingOpen,
  primeFramePreview,
  shouldAnimateIn,
  useImageReady,
} from '@/lib/frame-preview';
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
  activeFrameId: loadedFrameId,
  src: loadedSrc,
  videoSrc: loadedVideoSrc,
  frameName: loadedFrameName,
  frameRowId,
  comments: loadedComments,
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
  const address = `${appSlug} / ${flow.name}`;
  const [copied, setCopied] = useState(false);
  // Scale in on open, unless a loading shell already did (it shows first
  // whenever the data takes a moment, and animating twice reads as a stutter).
  const [animateIn] = useState(() => shouldAnimateIn());

  // The click overlay has done its job once the real modal is here. Before
  // paint, so the shell and the modal never stack for a frame.
  useLayoutEffect(() => {
    clearPendingOpen();
  }, []);

  // Prev/next shows the target frame immediately, from the manifest already
  // in hand: its screenshot, name and position swap on the click, and only
  // its comments wait for the server. Cleared when the new frame's data lands.
  const [pendingFrame, setPendingFrame] = useState<ManifestFlow['frames'][number] | null>(null);
  useEffect(() => {
    setPendingFrame(null);
  }, [loadedFrameId]);
  const activeFrameId = pendingFrame?.id ?? loadedFrameId;
  const src = pendingFrame ? imageHref(pendingFrame.image) : loadedSrc;
  const videoSrc = pendingFrame ? pendingFrame.video : loadedVideoSrc;
  const frameName = pendingFrame?.name ?? loadedFrameName;
  // Pins belong to the loaded frame; never draw them over the next one.
  const comments = pendingFrame ? [] : loadedComments;
  const imageReady = useImageReady(src);
  const loading = !imageReady || pendingFrame !== null;
  const [pendingPin, setPendingPin] = useState<PinDraft | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const pinContainerRef = useRef<HTMLDivElement>(null);

  const handlePinPlace = useCallback((pin: PinDraft) => {
    // Mid-switch the comment would attach to the frame being left.
    if (readOnly || pendingFrame) return;
    setPendingPin(pin);
    setActiveCommentId(null);
  }, [readOnly, pendingFrame]);

  const handlePinSubmit = useCallback(async (body: string) => {
    if (!pendingPin) return;
    setPendingPin(null);
    const res = await postComment({
      frameRowId,
      appId,
      appSlug,
      body,
      pinX: pendingPin.x,
      pinY: pendingPin.y,
      pinW: pendingPin.w ?? null,
      pinH: pendingPin.h ?? null,
    });
    if (res.ok) router.refresh();
  }, [pendingPin, frameRowId, appId, appSlug, router]);

  const handlePinCancel = useCallback(() => {
    setPendingPin(null);
  }, []);

  const handlePinClick = useCallback((commentId: string) => {
    setActiveCommentId((prev) => (prev === commentId ? null : commentId));
  }, []);

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

  // Prev/next: hand the target's screenshot to the loading shell first, so if
  // the next frame's data is not prefetched yet the shell shows its image at
  // once instead of the old frame sitting there frozen.
  const goTo = useCallback(
    (target: ManifestFlow['frames'][number]): void => {
      setPendingFrame(target);
      setPendingPin(null);
      setActiveCommentId(null);
      primeFramePreview({
        src: imageHref(target.image),
        name: target.name,
        flowName: flow.name,
        isMobile,
        index: flow.frames.indexOf(target) + 1,
        total,
        mode: 'switch',
      });
      router.replace(frameHref(target.id), { scroll: false });
    },
    [flow.name, flow.frames, isMobile, total, router, frameHref],
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
      if (e.key === 'Escape') {
        if (pendingPin) { setPendingPin(null); return; }
        close();
        return;
      }
      if (typing) return;
      if (e.key === 'ArrowLeft' && prev) { e.preventDefault(); goTo(prev); }
      else if (e.key === 'ArrowRight' && next) { e.preventDefault(); goTo(next); }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [close, goTo, prev, next, pendingPin]);

  return (
    <>
    {/*
      Clear this frame's unread notifications on open. Mounted here rather than
      in the route pages because BOTH the intercepted modal route and the
      hard-navigation fallback render this component — a previous refactor
      dropped it from the page and nothing marked notifications seen after that,
      so the bell only ever counted up.
    */}
    <MarkFrameRead frameRowId={frameRowId} appSlug={appSlug} />
    {/* Prefetch adjacent frame images so arrow navigation feels instant */}
    {prev ? <link rel="prefetch" href={imageHref(prev.image)} as="image" /> : null}
    {next ? <link rel="prefetch" href={imageHref(next.image)} as="image" /> : null}
    {/* biome-ignore lint/a11y/useKeyWithClickEvents: Esc handled above. */}
    <div
      role="dialog"
      aria-modal="true"
      aria-label={flow.name}
      onClick={close}
      aria-busy={loading}
      className={`dark fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm ${animateIn ? 'modal-backdrop-in' : ''}`}
    >
      {/* Two-box layout: preview + comments side by side with gap */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex h-[90vh] w-full max-w-[1800px] flex-col gap-3 md:h-[80vh] md:flex-row ${animateIn ? 'modal-panel-in' : ''}`}
      >
        {/* Left box: header + preview */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[oklch(0.16_0.007_260)] shadow-2xl">
          {/* Header bar */}
          <div className="flex shrink-0 items-center gap-2 border-b border-white/5 px-3 py-3 md:gap-4 md:px-5">
            <div className="flex min-w-0 items-center gap-2.5 text-sm">
              <span className="truncate font-medium text-white">{flow.name}</span>
              <span className="hidden text-white/35 md:inline">in</span>
              {appIconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={appIconUrl} alt="" className="hidden h-5 w-5 rounded md:block" />
              ) : (
                <span
                  className="hidden h-5 w-5 items-center justify-center rounded text-[13px] font-semibold text-white md:flex"
                  style={{ background: accentColor ?? 'oklch(0.5 0.22 254)' }}
                >
                  {appName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="hidden font-semibold text-white md:inline">{appName}</span>
            </div>

            <span className="ml-auto whitespace-nowrap text-[13px] tabular-nums text-white/35">
              {String(idx + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>

            <button
              type="button"
              onClick={copyFlowLink}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[13px] text-white/45 transition-colors hover:bg-white/8 hover:text-white md:px-3"
              title="Copy flow link"
            >
              <Link2 size={15} />
              <span className="hidden md:inline">{copied ? 'Copied' : 'Copy link'}</span>
            </button>
            <button
              type="button"
              onClick={close}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/8 hover:text-white"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Still fetching the full-size screenshot: say so, instead of an
              empty stage that looks broken. */}
          {loading ? (
            <div className="relative">
              <div className="loading-bar" />
            </div>
          ) : null}

          {/* Image area */}
          <ZoomStage
            overlay={
              <>
              {prev ? (
                <Link
                  href={frameHref(prev.id)}
                  scroll={false}
                  replace
                  /* Full prefetch: the neighbours' data is fetched while you
                     look at this frame, so prev/next usually swap instantly. */
                  prefetch
                  onClick={(e) => {
                    e.preventDefault();
                    goTo(prev);
                  }}
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
                  prefetch
                  onClick={(e) => {
                    e.preventDefault();
                    goTo(next);
                  }}
                  aria-label={`Next: ${next.name}`}
                  className="absolute right-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-[oklch(0.3_0.008_260)] text-white shadow-xl transition-transform hover:scale-105"
                >
                  <ArrowRight size={20} strokeWidth={2.5} />
                </Link>
              ) : null}
              </>
            }
            mode={isMobile && !videoSrc ? 'height' : 'width'}
            resetKey={activeFrameId}
            /* Left-drag places a comment pin, so panning is middle-drag or
               space+drag. Read-only viewers place no pins, so they keep
               left-drag panning. */
            dragToPan={isMobile && !videoSrc && readOnly}
            maxWidth={1100}
          >
                {videoSrc && !isMobile ? (
                  <BrowserFrame size="lg" address={address} elevated>
                    <video
                      src={videoSrc}
                      poster={src}
                      autoPlay
                      muted
                      loop
                      playsInline
                      controls
                      className="block h-auto w-full"
                    />
                  </BrowserFrame>
                ) : videoSrc ? (
                  <div className="overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-[oklch(0.2_0.008_260)]">
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
                      height: '100%',
                      filter: 'drop-shadow(0 20px 50px rgba(0,0,0,0.4))',
                    }}
                    /* Pin comments on phone frames too: click a point or drag
                       a region, exactly as on web captures. The overlay wraps
                       the screenshot inside the screen cutout, so coordinates
                       normalise against the image — not the bezel — and
                       markers scroll with a long capture. */
                    screenWrapper={(screen) => (
                      <div ref={pinContainerRef} style={{ position: 'relative' }}>
                        <PinOverlay
                          comments={comments}
                          activeCommentId={activeCommentId}
                          onPinPlace={handlePinPlace}
                          onPinClick={handlePinClick}
                          readOnly={readOnly}
                        >
                          {screen}
                        </PinOverlay>
                        {pendingPin && (
                          <PinPopover
                            pin={pendingPin}
                            containerRef={pinContainerRef}
                            onSubmit={handlePinSubmit}
                            onCancel={handlePinCancel}
                            mentionables={mentionables}
                            /* The screen cutout clips overflow, and a 260px
                               popover doesn't fit a ~360px screen. */
                            floating
                          />
                        )}
                      </div>
                    )}
                  />
                ) : (
                  /* The window chrome sits outside the pin overlay, so pins
                     still normalise against the screenshot alone and every
                     comment placed before the frame existed stays put. The
                     content is left unclipped for the pin popover, so the
                     image rounds its own bottom corners. */
                  <BrowserFrame size="lg" address={address} elevated clipContent={false} className="w-full">
                    <div className="w-full" ref={pinContainerRef}>
                      <PinOverlay
                        comments={comments}
                        activeCommentId={activeCommentId}
                        onPinPlace={handlePinPlace}
                        onPinClick={handlePinClick}
                        readOnly={readOnly}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                        src={src}
                        alt={frameName}
                        className={`block h-auto w-full rounded-b-xl ${imageReady ? '' : 'skeleton skeleton-dark'}`}
                        /* Hold a 16:10 box until the image arrives, so the
                           window does not collapse to its title bar. */
                        style={imageReady ? undefined : { aspectRatio: '16 / 10' }}
                      />
                        {pendingPin && (
                          <PinPopover
                            pin={pendingPin}
                            containerRef={pinContainerRef}
                            onSubmit={handlePinSubmit}
                            onCancel={handlePinCancel}
                            mentionables={mentionables}
                          />
                        )}
                      </PinOverlay>
                    </div>
                  </BrowserFrame>
                )}
          </ZoomStage>
        </div>

        {/* Right box: Comments - separate rounded box */}
        <div
          className={`flex max-h-[45%] w-full shrink-0 flex-col overflow-hidden rounded-2xl bg-[oklch(0.16_0.007_260)] shadow-2xl transition-opacity duration-150 md:max-h-none md:w-[340px] ${
            pendingFrame ? 'pointer-events-none opacity-40' : ''
          }`}
          aria-busy={pendingFrame !== null}
        >
          <CommentsPanel
            frameRowId={frameRowId}
            comments={loadedComments}
            isAgency={isAgency}
            appSlug={appSlug}
            appId={appId}
            currentUserId={currentUserId}
            mentionables={mentionables}
            readOnly={readOnly}
            embedded
            forceDark
            activeCommentId={activeCommentId}
            onCommentClick={handlePinClick}
          />
        </div>
      </div>
    </div>
    </>
  );
}
