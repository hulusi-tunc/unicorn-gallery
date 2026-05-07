'use client';

import { LayoutGrid, LogOut, Moon, Search, Settings, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { UnicornLogo } from '@/components/brand/unicorn-logo';
import type { Profile } from '@/lib/db';
import {
  editorialFonts,
  getNd,
  space,
  swatchRadii,
} from '@/lib/tokens';

export const TOPNAV_HEIGHT = 60;

export function DashboardTopNav({ profile }: { profile: Profile }): ReactNode {
  const { theme, toggle } = useTheme();
  const t = getNd(theme);
  const pathname = usePathname();
  const [searchFocused, setSearchFocused] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);

  const isAgency = profile.role === 'agency';
  const initials = (profile.name ?? profile.email)
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isActive = (href: string): boolean =>
    pathname === href || pathname.startsWith(href + '/');

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
    background: searchFocused ? t.surface : t.surfaceInk,
    display: 'flex',
    alignItems: 'center',
    padding: '0 14px',
    gap: 8,
    transition: 'background 120ms ease-out',
  };

  return (
    <nav style={navStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <NavLink href="/" active={pathname === '/'} t={t}>
            Apps
          </NavLink>
          {isAgency ? (
            <NavLink href="/admin" active={isActive('/admin')} t={t}>
              Admin
            </NavLink>
          ) : null}
        </div>
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
        <div style={searchStyle}>
          <span style={{ color: t.textSecondary, display: 'inline-flex' }}>
            <Search size={14} />
          </span>
          <input
            type="text"
            placeholder="Search apps, frames…"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            disabled
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: t.textPrimary,
              fontFamily: editorialFonts.body,
              fontSize: 13,
              minWidth: 0,
            }}
            aria-label="Search apps and frames"
          />
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
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', flexShrink: 0 }}>
        <IconButton onClick={toggle} aria-label="Toggle theme" t={t}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </IconButton>
        {isAgency ? (
          <Link href="/admin" aria-label="Admin">
            <IconButton aria-label="Admin" t={t} as="span">
              <Settings size={16} />
            </IconButton>
          </Link>
        ) : null}
        <Avatar initials={initials} t={t} />
        <form action="/auth/sign-out" method="POST" style={{ display: 'inline' }}>
          <IconButton type="submit" aria-label="Sign out" t={t}>
            <LogOut size={15} />
          </IconButton>
        </form>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  active,
  t,
  children,
}: {
  href: string;
  active: boolean;
  t: ReturnType<typeof getNd>;
  children: ReactNode;
}): ReactNode {
  return (
    <Link
      href={href}
      style={{
        fontFamily: editorialFonts.body,
        fontSize: 13,
        fontWeight: 500,
        color: active ? t.textDisplay : t.textSecondary,
        background: active ? t.surface : 'transparent',
        textDecoration: 'none',
        padding: '6px 12px',
        borderRadius: swatchRadii.md,
        transition: 'background 120ms ease-out, color 120ms ease-out',
      }}
    >
      {children}
    </Link>
  );
}

function IconButton({
  children,
  t,
  onClick,
  type = 'button',
  'aria-label': ariaLabel,
  as = 'button',
}: {
  children: ReactNode;
  t: ReturnType<typeof getNd>;
  onClick?: () => void;
  type?: 'button' | 'submit';
  'aria-label'?: string;
  as?: 'button' | 'span';
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
  if (as === 'span') {
    return (
      <span style={style} aria-label={ariaLabel}>
        {children}
      </span>
    );
  }
  return (
    <button type={type} onClick={onClick} aria-label={ariaLabel} style={style}>
      {children}
    </button>
  );
}

function Avatar({
  initials,
  t,
}: {
  initials: string;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  return (
    <span
      style={{
        width: 28,
        height: 28,
        borderRadius: swatchRadii.full,
        background: t.accentSubtle,
        color: t.accent,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: editorialFonts.body,
        fontSize: 11,
        fontWeight: 600,
        marginLeft: 4,
      }}
    >
      {initials || '··'}
    </span>
  );
}

void LayoutGrid; // export reservation for future "switch view" affordance
