'use client';

import { Bell, Moon, Search, Sun } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { UnicornLogo } from '@/components/brand/unicorn-logo';
import { CommandPalette } from '@/components/command-palette';
import { UserMenu } from '@/components/user-menu';
import type { Profile } from '@/lib/db';
import {
  editorialFonts,
  getNd,
  space,
  swatchRadii,
} from '@/lib/tokens';

export const TOPNAV_HEIGHT = 60;

export function DashboardTopNav({
  profile,
  unreadCount = 0,
}: {
  profile: Profile;
  unreadCount?: number;
}): ReactNode {
  const { theme, toggle } = useTheme();
  const t = getNd(theme);
  const [searchHovered, setSearchHovered] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global ⌘K / Ctrl+K opens the palette from anywhere in the dashboard.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (!isCmdK) return;
      e.preventDefault();
      setPaletteOpen((v) => !v);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: TOPNAV_HEIGHT,
    background: t.black,
    borderBottom: `1px solid ${t.border}`,
    display: 'flex',
    alignItems: 'center',
    gap: 28,
    padding: `0 ${space[6]}px`,
    zIndex: 50,
    fontFamily: editorialFonts.body,
  };

  const searchStyle: CSSProperties = {
    width: '100%',
    height: 36,
    borderRadius: swatchRadii.full,
    border: 'none',
    background: searchHovered ? t.surface : t.surfaceInk,
    display: 'flex',
    alignItems: 'center',
    padding: '0 14px',
    gap: 8,
    transition: 'background 120ms ease-out',
    cursor: 'pointer',
    color: t.textSecondary,
    fontFamily: editorialFonts.body,
    fontSize: 13,
    textAlign: 'left',
  };

  return (
    <nav style={navStyle}>
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <Link
          href="/"
          aria-label="Unicorn Studio home"
          onMouseEnter={() => setLogoHovered(true)}
          onMouseLeave={() => setLogoHovered(false)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            color: logoHovered ? t.accent : t.textDisplay,
            textDecoration: 'none',
            transition: 'color 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        >
          <UnicornLogo variant="mark" height={22} color={t.accent} />
          <span
            style={{
              fontFamily: editorialFonts.display,
              fontSize: 15,
              fontWeight: 600,
              color: 'inherit',
              letterSpacing: '-0.01em',
            }}
          >
            Unicorn Studio
          </span>
        </Link>
      </div>

      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(420px, 36vw)',
          minWidth: 240,
          pointerEvents: 'auto',
        }}
      >
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          onMouseEnter={() => setSearchHovered(true)}
          onMouseLeave={() => setSearchHovered(false)}
          aria-label="Search apps and frames"
          aria-haspopup="dialog"
          style={searchStyle}
        >
          <span style={{ color: t.textSecondary, display: 'inline-flex' }}>
            <Search size={14} />
          </span>
          <span style={{ flex: 1, color: t.textSecondary }}>Search apps, frames…</span>
          <span
            style={{
              fontFamily: editorialFonts.mono,
              fontSize: 10,
              color: t.textDisabled,
              padding: '2px 5px',
              border: `1px solid ${t.border}`,
              borderRadius: swatchRadii.sm,
            }}
          >
            ⌘K
          </span>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', flexShrink: 0 }}>
        <Link
          href="/notifications"
          aria-label={
            unreadCount > 0
              ? `Notifications (${unreadCount} unread)`
              : 'Notifications'
          }
          title={
            unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
              : 'Notifications'
          }
          style={{
            position: 'relative',
            width: 36,
            height: 36,
            borderRadius: swatchRadii.full,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: t.textPrimary,
            textDecoration: 'none',
            transition: 'background 120ms ease-out',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = t.surfaceInk)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Bell size={16} />
          {unreadCount > 0 ? (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                minWidth: 16,
                height: 16,
                padding: '0 4px',
                borderRadius: 999,
                background: t.accent,
                color: 'white',
                fontFamily: editorialFonts.mono,
                fontSize: 9,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `2px solid ${t.black}`,
                lineHeight: 1,
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Link>
        <IconButton onClick={toggle} aria-label="Toggle theme" t={t}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </IconButton>
        <UserMenu profile={profile} />
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </nav>
  );
}

function IconButton({
  children,
  t,
  onClick,
  type = 'button',
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  t: ReturnType<typeof getNd>;
  onClick?: () => void;
  type?: 'button' | 'submit';
  'aria-label'?: string;
}): ReactNode {
  const style: CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: swatchRadii.md,
    border: 'none',
    background: 'transparent',
    color: t.textSecondary,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 120ms ease-out, color 120ms ease-out',
  };
  return (
    <button type={type} onClick={onClick} aria-label={ariaLabel} style={style}>
      {children}
    </button>
  );
}
