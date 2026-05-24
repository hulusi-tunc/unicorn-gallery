'use client';

import { Camera, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import {
  removeProjectIcon,
  renameProject,
  uploadProjectIcon,
} from '@/lib/actions/update-project';
import { editorialFonts, getNd } from '@/lib/tokens';

interface Props {
  appSlug: string;
  appName: string;
  iconUrl: string | null;
  accent: string;
  canEdit: boolean;
}

export function EditProjectButton({
  appSlug,
  appName,
  iconUrl,
  accent,
  canEdit,
}: Props): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState(appName);
  const [optimisticIcon, setOptimisticIcon] = useState<string | null>(iconUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The header has `backdrop-filter: blur(...)` which creates a containing
  // block for `position: fixed` descendants — so a modal nested inside it
  // gets clipped to the header's 56px box instead of covering the viewport.
  // Portal the dialog to document.body to escape that subtree. Guard for
  // SSR by only mounting after first client render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // If the underlying app props change (e.g. another tab updated it),
  // reset the in-flight draft so we don't show stale values when the
  // user re-opens the dialog.
  useEffect(() => {
    setDraftName(appName);
  }, [appName]);
  useEffect(() => {
    setOptimisticIcon(iconUrl);
  }, [iconUrl]);

  // Esc closes the dialog. Wired only when open so we don't keep a
  // global listener around for the entire header lifetime.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const onPickFile = (): void => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const localUrl = URL.createObjectURL(file);
    setOptimisticIcon(localUrl);
    const fd = new FormData();
    fd.append('file', file);
    startTransition(async () => {
      const res = await uploadProjectIcon(appSlug, fd);
      if (res.error) {
        setError(res.error);
        setOptimisticIcon(iconUrl);
      } else if (res.iconUrl) {
        setOptimisticIcon(res.iconUrl);
        router.refresh();
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  };

  const onRemoveIcon = (): void => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await removeProjectIcon(appSlug);
      if (res.error) setError(res.error);
      else {
        setOptimisticIcon(null);
        router.refresh();
      }
    });
  };

  const onSaveName = (): void => {
    const trimmed = draftName.trim();
    if (trimmed.length === 0) {
      setError('Name cannot be empty.');
      return;
    }
    if (trimmed === appName) {
      setOpen(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await renameProject(appSlug, trimmed);
      if (res.error) setError(res.error);
      else {
        router.refresh();
        setOpen(false);
      }
    });
  };

  const iconBox: CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 8,
    background: accent,
    color: 'white',
    fontFamily: editorialFonts.display,
    fontSize: 13,
    fontWeight: 600,
    flexShrink: 0,
    cursor: canEdit ? 'pointer' : 'default',
    border: 'none',
    padding: 0,
    overflow: 'hidden',
  };

  const renderIconContent = (): ReactNode => {
    const shown = optimisticIcon;
    if (shown) {
      // eslint-disable-next-line @next/next/no-img-element
      return (
        <img
          src={shown}
          alt=""
          style={{ width: '100%', height: '100%', borderRadius: 8, objectFit: 'cover' }}
        />
      );
    }
    return appName.charAt(0).toUpperCase();
  };

  if (!canEdit) {
    return <div style={iconBox}>{renderIconContent()}</div>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={iconBox}
        title="Edit project name and logo"
        aria-label="Edit project"
      >
        {renderIconContent()}
        <span
          style={{
            position: 'absolute',
            right: -4,
            bottom: -4,
            width: 14,
            height: 14,
            borderRadius: 999,
            background: t.black,
            border: `1px solid ${t.border}`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: t.textSecondary,
          }}
          aria-hidden
        >
          <Pencil size={8} />
        </span>
      </button>

      {open && mounted ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit project"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: editorialFonts.body,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            style={{
              width: 'min(420px, 92vw)',
              background: t.black,
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              padding: 20,
              color: t.textPrimary,
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontFamily: editorialFonts.display,
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: t.textDisplay,
                }}
              >
                Edit project
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: t.textSecondary,
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <div
                style={{
                  position: 'relative',
                  width: 64,
                  height: 64,
                  borderRadius: 14,
                  background: accent,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontFamily: editorialFonts.display,
                  fontSize: 26,
                  fontWeight: 600,
                  overflow: 'hidden',
                  opacity: pending ? 0.6 : 1,
                  transition: 'opacity 200ms ease-out',
                  flexShrink: 0,
                }}
              >
                {optimisticIcon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={optimisticIcon}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  appName.charAt(0).toUpperCase()
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontFamily: editorialFonts.mono,
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: t.textSecondary,
                  }}
                >
                  Logo
                </p>
                <p
                  style={{
                    margin: '4px 0 8px',
                    fontSize: 12,
                    color: t.textSecondary,
                  }}
                >
                  PNG, JPG, WebP, GIF, or SVG. Up to 5 MB.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={onPickFile} disabled={pending} style={pillButton(t)}>
                    <Camera size={12} />
                    {optimisticIcon ? 'Replace' : 'Upload'}
                  </button>
                  {optimisticIcon ? (
                    <button
                      type="button"
                      onClick={onRemoveIcon}
                      disabled={pending}
                      style={{ ...pillButton(t), color: t.danger, borderColor: t.borderVisible }}
                    >
                      <Trash2 size={12} />
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <label
              htmlFor="edit-project-name"
              style={{
                display: 'block',
                fontFamily: editorialFonts.mono,
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: t.textSecondary,
                marginBottom: 6,
              }}
            >
              Project name
            </label>
            <input
              id="edit-project-name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSaveName();
                }
              }}
              disabled={pending}
              maxLength={120}
              style={{
                width: '100%',
                padding: '9px 12px',
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: 8,
                color: t.textPrimary,
                fontFamily: editorialFonts.body,
                fontSize: 14,
                outline: 'none',
              }}
            />

            {error ? (
              <p style={{ margin: '12px 0 0', fontSize: 12, color: t.danger }}>{error}</p>
            ) : null}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 18,
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                style={pillButton(t)}
              >
                Close
              </button>
              <button
                type="button"
                onClick={onSaveName}
                disabled={pending || draftName.trim().length === 0}
                style={{
                  ...pillButton(t),
                  background: accent,
                  borderColor: accent,
                  color: 'white',
                }}
              >
                {pending ? <Loader2 size={12} className="animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            onChange={onFileChange}
            style={{ display: 'none' }}
          />
        </div>,
        document.body,
      ) : null}
    </>
  );
}

function pillButton(t: ReturnType<typeof getNd>): CSSProperties {
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
