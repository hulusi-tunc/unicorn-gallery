'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Pin } from 'lucide-react';
import {
  useState,
  useTransition,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { DeviceBezel } from '@/components/device-bezel';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { UserAvatar } from '@/components/user-avatar';
import { setAppPinned } from '@/lib/actions/favorites';
import { editorialFonts, getNd } from '@/lib/tokens';
import type { AppRow, AppRowWithStaff, ProfileLite } from '@/lib/db';

const PLATFORM_LABEL: Record<AppRow['platform'], string> = {
  web: 'Web',
  ios: 'Mobile',
  android: 'Mobile',
};

/**
 * Run `fn` while swallowing the event so an in-card control (pin, arrows)
 * never triggers the wrapping <Link> navigation. We use <span role="button">
 * rather than <button> because the controls live inside an <a> — a nested
 * <button> is invalid HTML and warns under React 19 hydration.
 */
function press(
  e: ReactMouseEvent | ReactKeyboardEvent,
  fn: () => void,
): void {
  if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault();
  e.stopPropagation();
  fn();
}

export function AppCard({
  app,
  unreadCount = 0,
  previewImages,
  pinned = false,
}: {
  app: AppRowWithStaff;
  unreadCount?: number;
  /**
   * Ordered screen thumbnails for the hover carousel (one per flow). The first
   * entry is treated as the resting preview. Falls back to the app's single
   * preview_image_url when empty.
   */
  previewImages?: string[];
  /** Whether the current user has pinned this app to the top of their grid. */
  pinned?: boolean;
}): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const [hover, setHover] = useState(false);
  const isMobile = app.platform !== 'web';
  const accent = app.accent_color ?? t.accent;

  // Carousel source: explicit preview set, else the single hero image, else none.
  const previews =
    previewImages && previewImages.length > 0
      ? previewImages
      : app.preview_image_url
        ? [app.preview_image_url]
        : [];
  const hasCarousel = previews.length > 1;
  const [index, setIndex] = useState(0);
  const safeIndex = previews.length > 0 ? index % previews.length : 0;
  const currentImage = previews[safeIndex] ?? app.preview_image_url ?? null;

  // Pin state is optimistic — flip instantly, reconcile on the server. The
  // server action revalidates the dashboard so the grid re-sorts on next paint.
  const [isPinned, setIsPinned] = useState(pinned);
  const [, startTransition] = useTransition();

  function step(delta: number): void {
    if (previews.length === 0) return;
    setIndex((i) => (i + delta + previews.length) % previews.length);
  }

  function togglePin(): void {
    const next = !isPinned;
    setIsPinned(next);
    startTransition(async () => {
      const res = await setAppPinned({ appId: app.id, pinned: next });
      if (res.error) setIsPinned(!next); // revert on failure
    });
  }

  return (
    <Link
      href={`/app/${encodeURIComponent(app.slug)}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          aspectRatio: '4 / 3',
          borderRadius: 20,
          overflow: 'hidden',
          background: t.surface,
          border: `1px solid ${t.border}`,
          position: 'relative',
          transition: 'transform 220ms cubic-bezier(0.165, 0.84, 0.44, 1), box-shadow 220ms cubic-bezier(0.165, 0.84, 0.44, 1), border-color 220ms ease-out',
          transform: hover ? 'translateY(-2px)' : 'translateY(0)',
          boxShadow: hover
            ? theme === 'dark'
              ? '0 20px 50px -20px rgba(0,0,0,0.5)'
              : '0 20px 40px -16px rgba(15,15,20,0.12)'
            : 'none',
          borderColor: hover ? t.borderVisible : t.border,
        }}
      >
        <PreviewArea
          app={app}
          imageUrl={currentImage}
          t={t}
          isMobile={isMobile}
          theme={theme}
        />

        {/* Platform badge — moved to the bottom-left so the top-right is free
            for the pin + carousel dots, the way Mobbin clusters them. */}
        <span
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            fontFamily: editorialFonts.mono,
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: t.textPrimary,
            background:
              theme === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(10px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(10px) saturate(1.6)',
            border: `1px solid ${t.border}`,
            borderRadius: 999,
            padding: '4px 8px',
          }}
        >
          {PLATFORM_LABEL[app.platform]}
        </span>

        {/* Pin / favorite — top-right, always visible so you can pin without
            hovering. Filled + accent when pinned. */}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => press(e, togglePin)}
          onKeyDown={(e) => press(e, togglePin)}
          aria-pressed={isPinned}
          aria-label={isPinned ? 'Unpin from top' : 'Pin to top'}
          title={isPinned ? 'Unpin from top' : 'Pin to top'}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            cursor: 'pointer',
            color: isPinned ? accent : t.textPrimary,
            background:
              theme === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(10px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(10px) saturate(1.6)',
            border: `1px solid ${isPinned ? accent : t.border}`,
            borderRadius: 999,
            padding: 0,
            opacity: hover || isPinned ? 1 : 0,
            transition: 'opacity 180ms ease-out, color 160ms ease-out, border-color 160ms ease-out',
          }}
        >
          <Pin
            size={15}
            fill={isPinned ? 'currentColor' : 'none'}
            strokeWidth={2}
          />
        </span>

        {unreadCount > 0 ? (
          <span
            aria-label={`${unreadCount} unread comments`}
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: editorialFonts.body,
              fontSize: 11,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              color: 'white',
              background: accent,
              borderRadius: 999,
              padding: '4px 10px 4px 8px',
              boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'white',
                boxShadow: '0 0 0 2px rgba(255,255,255,0.35)',
              }}
            />
            {unreadCount > 99 ? '99+' : unreadCount} new
          </span>
        ) : null}

        {/* Carousel arrows — only when there's more than one screen, on hover. */}
        {hasCarousel ? (
          <>
            <CarouselArrow
              dir="prev"
              show={hover}
              theme={theme}
              t={t}
              onActivate={() => step(-1)}
            />
            <CarouselArrow
              dir="next"
              show={hover}
              theme={theme}
              t={t}
              onActivate={() => step(1)}
            />
            <DotIndicator
              count={previews.length}
              active={safeIndex}
              show={hover}
              theme={theme}
            />
          </>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '0 4px',
        }}
      >
        {/* Left: title + tagline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <span
              style={{
                fontFamily: editorialFonts.display,
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: t.textDisplay,
                transition: 'color 200ms cubic-bezier(0.165, 0.84, 0.44, 1)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {app.name}
            </span>
          </div>
          {app.tagline ? (
            <p
              style={{
                margin: 0,
                fontFamily: editorialFonts.body,
                fontSize: 13,
                lineHeight: 1.5,
                color: t.textSecondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {app.tagline}
            </p>
          ) : null}
        </div>

        {/* Right: staff avatars */}
        <StaffRow designer={app.designer} pm={app.pm} t={t} />
      </div>
    </Link>
  );
}

function CarouselArrow({
  dir,
  show,
  theme,
  t,
  onActivate,
}: {
  dir: 'prev' | 'next';
  show: boolean;
  theme: string;
  t: ReturnType<typeof getNd>;
  onActivate: () => void;
}): ReactNode {
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <span
      role="button"
      tabIndex={show ? 0 : -1}
      onClick={(e) => press(e, onActivate)}
      onKeyDown={(e) => press(e, onActivate)}
      aria-label={dir === 'prev' ? 'Previous screen' : 'Next screen'}
      style={{
        position: 'absolute',
        top: '50%',
        [dir === 'prev' ? 'left' : 'right']: 10,
        transform: `translateY(-50%) translateX(${show ? '0' : dir === 'prev' ? '-4px' : '4px'})`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        cursor: 'pointer',
        color: t.textPrimary,
        background:
          theme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(10px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(10px) saturate(1.6)',
        border: `1px solid ${t.border}`,
        borderRadius: 999,
        padding: 0,
        boxShadow: '0 4px 14px -6px rgba(0,0,0,0.35)',
        opacity: show ? 1 : 0,
        pointerEvents: show ? 'auto' : 'none',
        transition: 'opacity 180ms ease-out, transform 180ms cubic-bezier(0.165, 0.84, 0.44, 1)',
      }}
    >
      <Icon size={16} strokeWidth={2.25} />
    </span>
  );
}

function DotIndicator({
  count,
  active,
  show,
  theme,
}: {
  count: number;
  active: number;
  show: boolean;
  theme: string;
}): ReactNode {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 8px',
        borderRadius: 999,
        background: theme === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(10px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(10px) saturate(1.6)',
        opacity: show ? 1 : 0,
        transition: 'opacity 180ms ease-out',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          style={{
            width: i === active ? 14 : 5,
            height: 5,
            borderRadius: 999,
            background:
              i === active
                ? theme === 'dark'
                  ? 'rgba(255,255,255,0.95)'
                  : 'rgba(20,20,30,0.9)'
                : theme === 'dark'
                  ? 'rgba(255,255,255,0.4)'
                  : 'rgba(20,20,30,0.3)',
            transition: 'width 200ms cubic-bezier(0.165, 0.84, 0.44, 1)',
          }}
        />
      ))}
    </div>
  );
}

function StaffRow({
  designer,
  pm,
  t,
}: {
  designer: ProfileLite | null;
  pm: ProfileLite | null;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: -8,
        flexShrink: 0,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Slight overlap so the two photos read as a pair, like a small AvatarGroup. */}
      <span style={{ position: 'relative', zIndex: 2 }}>
        <StaffAvatar role="Designer" person={designer} t={t} />
      </span>
      <span style={{ position: 'relative', zIndex: 1, marginLeft: -8 }}>
        <StaffAvatar role="PM" person={pm} t={t} />
      </span>
    </div>
  );
}

function StaffAvatar({
  role,
  person,
  t,
}: {
  role: string;
  person: ProfileLite | null;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  const display = person?.name ?? person?.email?.split('@')[0] ?? null;
  const tooltip = `${role}: ${display ?? 'Unassigned'}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span aria-label={tooltip} style={{ display: 'inline-flex' }}>
          <UserAvatar
            name={person?.name ?? null}
            email={person?.email ?? null}
            avatarUrl={person?.avatar_url ?? null}
            size={36}
            background={person ? t.accentSubtle : t.surface}
            color={person ? t.accent : t.textDisabled}
            border={`2px solid ${t.black}`}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function PreviewArea({
  app,
  imageUrl,
  t,
  isMobile,
  theme,
}: {
  app: AppRowWithStaff;
  /** The screen to show right now (carousel-aware). */
  imageUrl: string | null;
  t: ReturnType<typeof getNd>;
  isMobile: boolean;
  theme: string;
}): ReactNode {
  // Canvas-style dot grid stage. Drawn with an SVG tile (no CSS gradients).
  const dotFill =
    theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(80,80,100,0.22)';
  const dotSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><circle cx='1' cy='1' r='1' fill='${dotFill}'/></svg>`;
  const dotUrl = `url("data:image/svg+xml,${encodeURIComponent(dotSvg)}")`;
  const stageBg: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: t.surface,
    backgroundImage: dotUrl,
    backgroundSize: '16px 16px',
    backgroundPosition: '0 0',
  };

  if (!imageUrl) {
    return <div style={stageBg} />;
  }

  if (isMobile) {
    return (
      <div style={stageBg}>
        <DeviceBezel
          key={imageUrl}
          src={imageUrl}
          alt={app.name}
          style={{
            position: 'absolute',
            left: '50%',
            top: '52%',
            transform: 'translate(-50%, -50%)',
            // Bezel fills 88% of card height; width derives from the frame aspect.
            height: '88%',
            filter:
              theme === 'dark'
                ? 'drop-shadow(0 22px 36px rgba(0,0,0,0.55))'
                : 'drop-shadow(0 22px 40px rgba(15,15,20,0.22))',
          }}
        />
      </div>
    );
  }

  // Web: 16:10 browser-viewport frame floats on the dot stage so a
  // standard viewport snap fits without left/right cropping. Full-page
  // snaps stay anchored to the top (cover + top center) so the hero
  // section reads first.
  return (
    <div style={stageBg}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '88%',
          aspectRatio: '16 / 10',
          borderRadius: 12,
          overflow: 'hidden',
          background: '#000',
          boxShadow:
            theme === 'dark'
              ? '0 18px 38px -18px rgba(0,0,0,0.7)'
              : '0 18px 38px -18px rgba(15,15,20,0.25)',
        }}
      >
        <Image
          key={imageUrl}
          src={imageUrl}
          alt={app.name}
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          style={{
            objectFit: 'cover',
            objectPosition: 'top center',
          }}
          loading="lazy"
        />
      </div>
    </div>
  );
}
