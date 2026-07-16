/**
 * Fetch a project export (PDF or PNG zip) and trigger a browser download.
 * Shared by the header overflow menu and the standalone download buttons so
 * the auth + blob + Safari-revoke handling lives in one place.
 */
export async function downloadExport(
  appSlug: string,
  kind: 'pdf' | 'pngs',
  version: number | null,
): Promise<void> {
  const qs = version != null ? `?v=${version}` : '';
  const res = await fetch(
    `/api/projects/${encodeURIComponent(appSlug)}/download-${kind}${qs}`,
    { credentials: 'same-origin' },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const tag = version != null ? `v${version}` : 'latest';
  a.download = kind === 'pdf' ? `${appSlug}-${tag}.pdf` : `${appSlug}-${tag}-screens.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revoke so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
