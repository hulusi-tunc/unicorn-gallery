'use client';

import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Renders an orange "viewing past version" banner when `?v=N` is in the URL.
 * Layouts in Next 15 don't receive searchParams, so this lives as a Client
 * Component that the layout drops in unconditionally — it shows itself only
 * when a version param is present.
 */
export function VersionBanner(): ReactNode {
  const searchParams = useSearchParams();
  const v = searchParams?.get('v');
  if (!v) return null;
  const n = Number(v);
  const label = Number.isFinite(n) ? `v${n}` : v;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 border-b border-[oklch(0.85_0.02_60)] bg-[oklch(0.97_0.04_60)] px-6 py-2 text-[13px] text-[oklch(0.32_0.10_60)] dark:border-[oklch(0.32_0.06_60)] dark:bg-[oklch(0.20_0.04_60)] dark:text-[oklch(0.82_0.10_60)]"
    >
      <span className="font-mono font-semibold tabular-nums">{label}</span>
      <span>Read-only snapshot — switch to Latest in the header to comment.</span>
    </div>
  );
}
