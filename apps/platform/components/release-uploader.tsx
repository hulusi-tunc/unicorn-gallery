'use client';

import { Loader2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { publishRelease } from '@/lib/actions/releases';
import {
  RELEASE_LABELS,
  type ReleaseChannel,
  type ReleaseKind,
} from '@/lib/releases-shared';

const INPUT =
  'w-full rounded-lg border border-[oklch(0.9_0.007_260)] bg-white px-3 py-2 text-[13px] text-[oklch(0.15_0.008_260)] outline-none focus:border-[oklch(0.6_0.02_260)] dark:border-[oklch(0.28_0.008_260)] dark:bg-[oklch(0.19_0.007_260)] dark:text-[oklch(0.97_0.005_260)]';
const LABEL =
  'mb-1.5 block text-[11px] font-medium uppercase tracking-[0.06em] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]';

export function ReleaseUploader(): ReactNode {
  const router = useRouter();
  const [kind, setKind] = useState<ReleaseKind>('macos-desktop');
  const [channel, setChannel] = useState<ReleaseChannel>('stable');
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = async (): Promise<void> => {
    if (!file || !version.trim()) {
      setError('Pick a file and enter a version.');
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      // 1. Ask the server for a presigned PUT. The bytes never go through
      //    Next — a DMG is far past the serverless request body cap.
      const signRes = await fetch('/api/releases/sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind,
          version: version.trim(),
          fileName: file.name,
          sizeBytes: file.size,
        }),
      });
      const signed = (await signRes.json()) as {
        signedUrl?: string;
        publicUrl?: string;
        contentType?: string;
        error?: string;
      };
      if (!signRes.ok || !signed.signedUrl || !signed.publicUrl) {
        throw new Error(signed.error ?? 'Could not start the upload.');
      }

      // 2. PUT the file straight to storage. XHR (not fetch) so we can show
      //    real progress — a 150MB DMG on hotel wifi needs a progress bar.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', signed.signedUrl!);
        if (signed.contentType) {
          xhr.setRequestHeader('content-type', signed.contentType);
        }
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Storage rejected the upload (${xhr.status}).`));
        xhr.onerror = () => reject(new Error('Network error during upload.'));
        xhr.send(file);
      });

      // 3. Record it. Only now does the team see the new build.
      const res = await publishRelease({
        kind,
        channel,
        version: version.trim(),
        fileUrl: signed.publicUrl,
        fileName: file.name,
        sizeBytes: file.size,
        notes: notes.trim() || undefined,
      });
      if (res.error) throw new Error(res.error);

      setVersion('');
      setNotes('');
      setFile(null);
      setProgress(0);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-[oklch(0.9_0.007_260)] bg-white p-5 dark:border-[oklch(0.24_0.008_260)] dark:bg-[oklch(0.175_0.007_260)]">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="rel-kind">
            Artifact
          </label>
          <select
            id="rel-kind"
            className={INPUT}
            value={kind}
            onChange={(e) => setKind(e.target.value as ReleaseKind)}
            disabled={busy}
          >
            {(Object.keys(RELEASE_LABELS) as ReleaseKind[]).map((k) => (
              <option key={k} value={k}>
                {RELEASE_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="rel-channel">
            Channel
          </label>
          <select
            id="rel-channel"
            className={INPUT}
            value={channel}
            onChange={(e) => setChannel(e.target.value as ReleaseChannel)}
            disabled={busy}
          >
            <option value="stable">Stable — everyone sees this</option>
            <option value="canary">Canary</option>
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="rel-version">
            Version
          </label>
          <input
            id="rel-version"
            className={INPUT}
            placeholder="0.1.4"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            disabled={busy}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="rel-file">
            File (.dmg / .zip)
          </label>
          <input
            id="rel-file"
            type="file"
            accept=".dmg,.zip"
            className={`${INPUT} file:mr-3 file:rounded file:border-0 file:bg-[oklch(0.94_0.006_260)] file:px-2 file:py-1 file:text-[12px] dark:file:bg-[oklch(0.26_0.008_260)] dark:file:text-[oklch(0.9_0.005_260)]`}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="rel-notes">
            What changed (optional)
          </label>
          <textarea
            id="rel-notes"
            rows={2}
            className={INPUT}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-[12px] text-[oklch(0.55_0.19_25)]">{error}</p>
      ) : null}

      {busy && progress > 0 ? (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-[oklch(0.93_0.006_260)] dark:bg-[oklch(0.26_0.008_260)]">
            <div
              className="h-full rounded-full bg-[oklch(0.15_0.008_260)] transition-[width] dark:bg-[oklch(0.97_0.005_260)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
            Uploading… {progress}%
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void upload()}
        disabled={busy || !file || !version.trim()}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[oklch(0.15_0.008_260)] px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-[oklch(0.97_0.005_260)] dark:text-[oklch(0.15_0.008_260)]"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {busy ? 'Publishing…' : 'Publish build'}
      </button>
    </div>
  );
}
