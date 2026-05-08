'use client';

import Link from 'next/link';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { IPHONE_BEZEL_ASPECT, IPhoneBezel } from '@/components/iphone-bezel';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { UserAvatar } from '@/components/user-avatar';
import { editorialFonts, getNd } from '@/lib/tokens';
import type { AppRow, AppRowWithStaff, ProfileLite } from '@/lib/db';

const PLATFORM_LABEL: Record<AppRow['platform'], string> = {
  web: 'Web',
  ios: 'Mobile',
  android: 'Mobile',
};

export function AppCard({ app }: { app: AppRowWithStaff }): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const [hover, setHover] = useState(false);
  const isMobile = app.platform !== 'web';
  const accent = app.accent_color ?? t.accent;

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
        <PreviewArea app={app} t={t} accent={accent} isMobile={isMobile} theme={theme} />

        <span
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: accent,
                flexShrink: 0,
              }}
            />
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
  t,
  isMobile,
  theme,
}: {
  app: AppRowWithStaff;
  t: ReturnType<typeof getNd>;
  accent: string;
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

  if (!app.preview_image_url) {
    return <div style={stageBg} />;
  }

  if (isMobile) {
    return (
      <div style={stageBg}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '52%',
            transform: 'translate(-50%, -50%)',
            // Bezel fills 88% of card height; width is derived from aspect.
            height: '88%',
            aspectRatio: IPHONE_BEZEL_ASPECT,
            filter:
              theme === 'dark'
                ? 'drop-shadow(0 22px 36px rgba(0,0,0,0.55))'
                : 'drop-shadow(0 22px 40px rgba(15,15,20,0.22))',
          }}
        >
          <IPhoneBezel>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={app.preview_image_url}
              alt={app.name}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'top center',
              }}
              loading="lazy"
            />
          </IPhoneBezel>
        </div>
      </div>
    );
  }

  // Web: borderless filled preview
  return (
    <div style={stageBg}>
      <div
        style={{
          position: 'absolute',
          inset: 24,
          borderRadius: 12,
          overflow: 'hidden',
          background: '#000',
          boxShadow:
            theme === 'dark'
              ? '0 18px 38px -18px rgba(0,0,0,0.7)'
              : '0 18px 38px -18px rgba(15,15,20,0.25)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={app.preview_image_url}
          alt={app.name}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top center',
          }}
          loading="lazy"
        />
      </div>
    </div>
  );
}

