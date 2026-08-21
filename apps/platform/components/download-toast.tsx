'use client';

import { Check, FileArchive, FileText, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/components/providers/theme-provider';
import { editorialFonts, getNd } from '@/lib/tokens';

type DownloadKind = 'zip' | 'pdf';
type DownloadState = 'downloading' | 'done' | 'error';

interface DownloadEntry {
  id: number;
  kind: DownloadKind;
  name: string;
  state: DownloadState;
  error?: string;
}

interface DownloadToastCtx {
  start: (kind: DownloadKind, name: string) => number;
  finish: (id: number) => void;
  fail: (id: number, error: string) => void;
}

const Ctx = createContext<DownloadToastCtx>({
  start: () => 0,
  finish: () => {},
  fail: () => {},
});

export const useDownloadToast = (): DownloadToastCtx => useContext(Ctx);

export function DownloadToastProvider({ children }: { children: ReactNode }): ReactNode {
  const [entries, setEntries] = useState<DownloadEntry[]>([]);
  const nextId = useRef(1);

  const start = useCallback((kind: DownloadKind, name: string): number => {
    const id = nextId.current++;
    setEntries((prev) => [...prev, { id, kind, name, state: 'downloading' }]);
    return id;
  }, []);

  const finish = useCallback((id: number): void => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, state: 'done' as const } : e)),
    );
    setTimeout(() => {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    }, 4000);
  }, []);

  const fail = useCallback((id: number, error: string): void => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, state: 'error' as const, error } : e)),
    );
    setTimeout(() => {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    }, 6000);
  }, []);

  const dismiss = useCallback((id: number): void => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return (
    <Ctx.Provider value={{ start, finish, fail }}>
      {children}
      {entries.length > 0 && typeof document !== 'undefined'
        ? createPortal(
            <ToastStack entries={entries} onDismiss={dismiss} />,
            document.body,
          )
        : null}
    </Ctx.Provider>
  );
}

function ToastStack({
  entries,
  onDismiss,
}: {
  entries: DownloadEntry[];
  onDismiss: (id: number) => void;
}): ReactNode {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {entries.map((entry) => (
        <Toast key={entry.id} entry={entry} onDismiss={() => onDismiss(entry.id)} />
      ))}
    </div>
  );
}

function Toast({
  entry,
  onDismiss,
}: {
  entry: DownloadEntry;
  onDismiss: () => void;
}): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const Icon = entry.kind === 'zip' ? FileArchive : FileText;

  const isDone = entry.state === 'done';
  const isError = entry.state === 'error';
  const isDownloading = entry.state === 'downloading';

  return (
    <div
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 12,
        background: t.black,
        border: `1px solid ${isError ? 'oklch(0.55 0.20 25)' : t.border}`,
        boxShadow: '0 8px 32px -8px rgba(0,0,0,0.4), 0 2px 8px -2px rgba(0,0,0,0.2)',
        fontFamily: editorialFonts.body,
        minWidth: 280,
        maxWidth: 380,
        animation: 'download-toast-in 300ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: isDone
            ? 'oklch(0.45 0.15 155)'
            : isError
              ? 'oklch(0.55 0.20 25)'
              : t.accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {isDone ? (
          <Check size={18} color="white" />
        ) : isError ? (
          <X size={18} color="white" />
        ) : (
          <>
            <Icon
              size={18}
              color="white"
              style={{
                animation: 'download-file-bounce 1.2s ease-in-out infinite',
              }}
            />
          </>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: t.textDisplay,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {isDone
            ? 'Download complete'
            : isError
              ? 'Download failed'
              : `Preparing ${entry.kind === 'zip' ? 'ZIP' : 'PDF'}...`}
        </div>
        <div
          style={{
            fontSize: 11,
            color: isError ? 'oklch(0.55 0.20 25)' : t.textSecondary,
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {isError ? entry.error : entry.name}
        </div>
        {isDownloading ? (
          <div
            style={{
              marginTop: 6,
              height: 3,
              borderRadius: 2,
              background: t.surface,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                borderRadius: 2,
                background: t.accent,
                animation: 'download-progress 2s ease-in-out infinite',
              }}
            />
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          color: t.textDisabled,
          cursor: 'pointer',
        }}
      >
        <X size={14} />
      </button>

      <style>{`
        @keyframes download-toast-in {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes download-file-bounce {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        @keyframes download-progress {
          0%   { width: 5%; }
          50%  { width: 70%; }
          100% { width: 95%; }
        }
      `}</style>
    </div>
  );
}
