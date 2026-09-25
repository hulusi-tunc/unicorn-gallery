/**
 * A `next` path that is safe to redirect to: same-site and absolute.
 * Anything else ("//evil.com", "https://…", "javascript:") falls back to
 * /apps, so a crafted link can't bounce a signed-in user off-site.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return '/apps';
  }
  return next;
}

/**
 * The origin the browser actually used for this request. `nextUrl.origin` is
 * not reliable for that behind a proxy or in dev, where every host reads as
 * localhost, and a redirect built from it would send someone who just signed
 * in on one brand's host back to another host, signed out.
 */
export function requestOrigin(request: { headers: Headers; nextUrl: URL }): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!host) return request.nextUrl.origin;
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(/:$/, '');
  return `${proto}://${host}`;
}
