'use client';

import type { ManifestFlow, Platform } from '@unicorn-studio/gallery-capture';
import { ArrowLeft, ArrowRight, ExternalLink, Link2, MessageCircle, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { CommentsPanel } from '@/components/comments-panel';
import { DeviceBezel } from '@/components/device-bezel';
import type { CommentWithAuthor } from '@/lib/comments';
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
}): ReactNode {
  const router = useRouter();
  const isMobile = platform !== 'web';
  const [showComments, setShowComments] = useState(false);

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

  const commentCount = comments.filter((c) => !c.parent_id).length;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc handled above.
    <div
      role="dialog"
      aria-modal="true"
      aria-label={frameName}
      onClick={close}
      className="fixed inset-0 z-[120] flex flex-col bg-[oklch(0.12_0.006_260/0.92)] backdrop-blur-sm"
    >
      {/* Header bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex shrink-0 items-center gap-4 px-6 py-3"
      >
        {/* Left: flow name in [icon] app */}
        <div className="flex items-center gap-2 text-sm text-white/90">
          <span className="font-medium">{flow.name}</span>
          <span className="text-white/40">in</span>
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
          <span className="font-semibold">{appName}</span>
        </div>

        {/* Right: icons + close */}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowComments((v) => !v)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              showComments
                ? 'bg-white/20 text-white'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`}
            title={showComments ? 'Hide comments' : 'Show comments'}
          >
            <MessageCircle size={18} />
            {commentCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[13px] font-semibold text-white">
                {commentCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            title="Copy link"
          >
            <Link2 size={18} />
          </button>
          <button
            type="button"
            onClick={close}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex min-h-0 flex-1"
      >
        {/* Image area */}
        <div className="relative flex min-w-0 flex-1 items-center justify-center px-16 py-8">
          {/* Prev arrow */}
          {prev ? (
            <Link
              href={frameHref(prev.id)}
              scroll={false}
              replace
              aria-label={`Previous: ${prev.name}`}
              className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-[oklch(0.28_0.008_260)] text-white shadow-xl transition-transform hover:scale-105"
            >
              <ArrowLeft size={20} strokeWidth={2.5} />
            </Link>
          ) : null}

          {/* Screen */}
          {videoSrc ? (
            <video
              src={videoSrc}
              poster={src}
              autoPlay
              muted
              loop
              playsInline
              controls
              className="h-auto max-h-full rounded-xl bg-black shadow-2xl"
              style={{
                width: isMobile ? 'auto' : 'min(900px, 70%)',
                maxWidth: isMobile ? 'min(360px, 50%)' : '100%',
              }}
            />
          ) : isMobile ? (
            <DeviceBezel
              src={src}
              alt={frameName}
              scrollable
              style={{
                height: 'min(80vh, calc(100vh - 200px))',
                filter: 'drop-shadow(0 24px 60px rgba(0,0,0,0.5))',
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={frameName}
              className="h-auto max-h-full rounded-xl bg-white shadow-2xl"
              style={{ width: 'min(900px, 70%)', maxWidth: '100%' }}
            />
          )}

          {/* Next arrow */}
          {next ? (
            <Link
              href={frameHref(next.id)}
              scroll={false}
              replace
              aria-label={`Next: ${next.name}`}
              className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-[oklch(0.28_0.008_260)] text-white shadow-xl transition-transform hover:scale-105"
            >
              <ArrowRight size={20} strokeWidth={2.5} />
            </Link>
          ) : null}
        </div>

        {/* Comments panel - slides in from right */}
        {showComments ? (
          <div className="w-[320px] shrink-0 overflow-y-auto bg-[oklch(0.16_0.007_260)]">
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
        ) : null}
      </div>

      {/* Bottom bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex shrink-0 items-center justify-between px-6 py-3"
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-white/50">
            {String(idx + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[13px] text-white/50">
            {isMobile ? 'Mobile' : 'Web'} - {frameName}
          </span>
        </div>
      </div>
    </div>
  );
}
