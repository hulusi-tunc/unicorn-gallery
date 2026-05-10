'use client';

import { LogOut, Settings, Shield, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/user-avatar';
import type { Profile } from '@/lib/db';
import { editorialFonts, getNd } from '@/lib/tokens';

export function UserMenu({ profile }: { profile: Profile }): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);

  const display = profile.name ?? profile.email.split('@')[0] ?? 'User';
  const isAgency = profile.role === 'agency';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Open menu for ${display}`}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: 0,
            marginLeft: 4,
            display: 'inline-flex',
            borderRadius: 999,
            transition: 'box-shadow 120ms ease-out',
          }}
        >
          <UserAvatar
            name={profile.name}
            email={profile.email}
            avatarUrl={profile.avatar_url}
            size={30}
            background={t.accentSubtle}
            color={t.accent}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8}>
        <div className="px-2 pb-2 pt-1">
          <p className="text-[13px] font-medium text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]">
            {display}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
            {profile.email}
          </p>
          <span
            className="mt-1.5 inline-block rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em]"
            style={{ background: t.accentSubtle, color: t.accent }}
          >
            {isAgency ? 'UNICORN' : 'CUSTOMER'}
            {profile.flavor ? ` · ${profile.flavor.toUpperCase()}` : ''}
          </span>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserIcon size={14} className="mr-2 text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile#settings">
            <Settings size={14} className="mr-2 text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]" />
            Settings
          </Link>
        </DropdownMenuItem>

        {isAgency ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Team</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <Shield size={14} className="mr-2 text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]" />
                Team & access
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}

        <DropdownMenuSeparator />

        <form action="/auth/sign-out" method="POST" className="m-0">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full text-left">
              <LogOut size={14} className="mr-2 text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
