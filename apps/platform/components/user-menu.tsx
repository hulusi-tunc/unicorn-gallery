'use client';

import { Archive, ClipboardCheck, LogOut, Settings, Shield, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/db';
import { editorialFonts, getNd } from '@/lib/tokens';

export function UserMenu({ profile }: { profile: Profile }): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const router = useRouter();

  const display = profile.name ?? profile.email.split('@')[0] ?? 'User';
  const isAgency = profile.role === 'agency';

  // Browser-side sign-out: clears the local Supabase session immediately,
  // then hits the route handler to also drop the SSR cookie. The dropdown's
  // form-based submit fired on Radix's onSelect close, which sometimes
  // unmounted the form before the POST went through.
  const handleSignOut = async (): Promise<void> => {
    try {
      await getSupabaseBrowserClient().auth.signOut();
    } catch {
      // ignore — we'll still hit the server route to be safe.
    }
    try {
      await fetch('/auth/sign-out', { method: 'POST' });
    } catch {
      // ignore
    }
    router.replace('/sign-in');
    router.refresh();
  };

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
            <DropdownMenuItem asChild>
              <Link href="/dor">
                <ClipboardCheck size={14} className="mr-2 text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]" />
                Readiness (DoR)
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/archived">
                <Archive size={14} className="mr-2 text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]" />
                Archived projects
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            void handleSignOut();
          }}
        >
          <LogOut size={14} className="mr-2 text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
