'use client';

import type { ManifestFlow, Platform } from '@unicorn-studio/gallery-capture';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect } from 'react';
import { CommentsPanel } from '@/components/comments-panel';
import { DeviceBezel } from '@/components/device-bezel';
import { Filmstrip } from '@/components/filmstrip';
import type { CommentWithAuthor } from '@/lib/comments';
import type { MentionableProfile } from '@/lib/queries';

/**
 * Full-screen overlay viewer for a single frame — the read/review surface
 * that opens when a frame card is clicked (via an intercepting route), instead
 * of navigating to the chrome-heavy detail subpage. Layout mirrors Mobbin's
 * screen modal: a large, scrollable image in the center with prev/next arrows,
 * the live comment thread on the right, and a filmstrip of the other screens in
 * the same flow along the bottom to jump between them. Esc / backdrop / X close
 * it (router.back returns to the flow grid the user came from).
 */
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
  frameName,
  frameRowId,
  comments,
  isAgency,
  currentUserId,
  mentionables,
  readOnly = false,
  versionQuery = '',
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
  frameName: string;
  frameRowId: string;
  comments: CommentWithAuthor[];
  isAgency: boolean;
  currentUserId: string | null;
  mentionables: MentionableProfile[];
  readOnly?: boolean;
  versionQuery?: string;
}): ReactNode {
  const router = useRouter();
  const isMobile = platform !== 'web';

  const idx = flow.frames.findIndex((f) => f.id === activeFrameId);
  const total = flow.frames.length;
  const prev = idx > 0 ? flow.frames[idx - 1] : undefined;
  const next = idx < total - 1 ? flow.frames[idx + 1] : undefined;

  const frameHref = useCallback(
    (id: string): string =>
      `/app/${encodeURIComponent(appSlug)}/${encodeURIComponent(flow.id)}/${encodeURIComponent(id)}${versionQuery}`,
    [appSlug, flow.id, versionQuery],
  );

  const close = useCallback(() => router.back(), [router]);

  // Keyboard: Esc closes, ←/→ steps through frames. Ignore when focus is in
  // the comment composer so arrow keys / typing there aren't hijacked.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement | null;
      const typing =
        el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable;
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (typing) return;
      // replace (not push) so stepping through screens keeps the modal as a
      // single history entry — the close button then unwinds it in one step.
      if (e.key === 'ArrowLeft' && prev) {
        e.preventDefault();
        router.replace(frameHref(prev.id));
      } else if (e.key === 'ArrowRight' && next) {
        e.preventDefault();
        router.replace(frameHref(next.id));
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [close, router, frameHref, prev, next]);

  const arrowClass =
    'absolute top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/90 text-neutral-700 shadow-md backdrop-blur transition-colors hover:bg-white hover:text-neutral-950 dark:border-neutral-700 dark:bg-neutral-900/90 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white';

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc handled via keydown listener above.
    <div
      role="dialog"
      aria-modal="true"
      aria-label={frameName}
      onClick={close}
      className="fixed inset-0 z-[120] flex bg-black/70 p-3 backdrop-blur-sm md:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative m-auto flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-neutral-900"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-neutral-200 px-5 py-3 dark:border-neutral-800">
          {appIconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={appIconUrl} alt="" className="h-6 w-6 shrink-0 rounded-md" />
          ) : (
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold text-white"
              style={{ background: accentColor ?? 'oklch(0.5 0.22 254)' }}
            >
              {appName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {appName}
          </span>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="truncate text-sm text-neutral-600 dark:text-neutral-400">
            {flow.name}
          </span>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {frameName}
          </span>
          <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-neutral-400 dark:text-neutral-500">
            {String(idx + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body: image (scrollable) + comments panel */}
        <div className="flex min-h-0 flex-1">
          <div className="relative flex min-w-0 flex-1 justify-center overflow-y-auto overflow-x-hidden bg-neutral-100 px-4 py-6 dark:bg-neutral-950">
            {prev ? (
              <Link
                href={frameHref(prev.id)}
                scroll={false}
                replace
                aria-label={`Previous: ${prev.name}`}
                title={prev.name}
                className={`${arrowClass} left-4`}
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
            ) : null}

            {isMobile ? (
              // Mobile: show the screen inside a phone bezel (matching the flow
              // cards), sized to fit the viewport height. The bezel screen
              // scrolls for taller-than-device full-page captures.
              <DeviceBezel
                src={src}
                alt={frameName}
                scrollable
                className="self-center"
                style={{
                  height: 'min(82vh, calc(100vh - 240px))',
                  filter: 'drop-shadow(0 24px 44px rgba(15,15,20,0.30))',
                }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={frameName}
                className="h-auto self-start rounded-lg bg-white shadow-lg dark:bg-neutral-900"
                style={{ width: 'min(1040px, 100%)', maxWidth: '100%' }}
              />
            )}

            {next ? (
              <Link
                href={frameHref(next.id)}
                scroll={false}
                replace
                aria-label={`Next: ${next.name}`}
                title={next.name}
                className={`${arrowClass} right-4`}
              >
                <ChevronRight className="h-5 w-5" />
              </Link>
            ) : null}
          </div>

          <CommentsPanel
            frameRowId={frameRowId}
            comments={comments}
            isAgency={isAgency}
            appSlug={appSlug}
            appId={appId}
            currentUserId={currentUserId}
            mentionables={mentionables}
            readOnly={readOnly}
          />
        </div>

        {/* Bottom: other screens in this flow */}
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
  );
}
