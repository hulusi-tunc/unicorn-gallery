'use client';

import { Camera, Loader2, Trash2 } from 'lucide-react';
import { useRef, useState, useTransition, type ChangeEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/providers/theme-provider';
import { UserAvatar } from '@/components/user-avatar';
import { removeAvatar, uploadAvatar } from '@/lib/actions/upload-avatar';
import type { Profile } from '@/lib/db';
import { editorialFonts, getNd } from '@/lib/tokens';

export function AvatarUpload({ profile }: { profile: Profile }): ReactNode {
  const router = useRouter();
  const { theme } = useTheme();
  const t = getNd(theme);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimisticUrl, setOptimisticUrl] = useState<string | null>(null);

  const currentUrl = optimisticUrl ?? profile.avatar_url;

  function onFileChange(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    // Optimistic preview while the upload runs.
    const localUrl = URL.createObjectURL(file);
    setOptimisticUrl(localUrl);

    const fd = new FormData();
    fd.append('file', file);

    startTransition(async () => {
      const res = await uploadAvatar(fd);
      if (res.error) {
        setError(res.error);
        setOptimisticUrl(null);
      } else if (res.avatarUrl) {
        setOptimisticUrl(res.avatarUrl);
        router.refresh();
      }
      // Reset the input so picking the same file twice still triggers change.
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  }

  function onRemove(): void {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await removeAvatar();
      if (res.error) setError(res.error);
      else {
        setOptimisticUrl(null);
        router.refresh();
      }
    });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative' }}>
        <UserAvatar
          name={profile.name}
          email={profile.email}
          avatarUrl={currentUrl}
          size={72}
          fontSize={24}
          background={t.accent}
          color="white"
          style={{ opacity: pending ? 0.6 : 1, transition: 'opacity 200ms ease-out' }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={pending}
          aria-label="Upload avatar"
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: 26,
            height: 26,
            borderRadius: 999,
            border: `2px solid ${t.black}`,
            background: t.accent,
            color: 'white',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: pending ? 'not-allowed' : 'pointer',
            transition: 'transform 120ms ease-out',
          }}
          title="Upload new photo"
        >
          {pending ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
        </button>
      </div>

      <div style={{ flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontFamily: editorialFonts.mono,
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: t.textSecondary,
          }}
        >
          Profile photo
        </p>
        <p
          style={{
            margin: '4px 0 8px',
            fontFamily: editorialFonts.body,
            fontSize: 12,
            color: t.textSecondary,
          }}
        >
          PNG, JPG, WebP, or GIF. Up to 5 MB.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending}
            style={pillButton(t)}
          >
            <Camera size={13} />
            {currentUrl ? 'Change photo' : 'Upload photo'}
          </button>
          {currentUrl ? (
            <button
              type="button"
              onClick={onRemove}
              disabled={pending}
              style={{ ...pillButton(t), color: t.danger, borderColor: t.borderVisible }}
            >
              <Trash2 size={13} />
              Remove
            </button>
          ) : null}
        </div>
        {error ? (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: t.danger }}>{error}</p>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={onFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}

function pillButton(t: ReturnType<typeof getNd>) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 12px',
    borderRadius: 999,
    border: `1px solid ${t.borderVisible}`,
    background: t.black,
    color: t.textPrimary,
    fontFamily: editorialFonts.body,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 120ms ease-out',
  };
}
