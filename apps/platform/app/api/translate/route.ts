import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentProfile } from '@/lib/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CHARS = 4000;

/**
 * Translate a comment on demand. The studio's clients write in French, the
 * studio reads in English (and vice versa), so each comment gets a Translate
 * toggle in the panel.
 *
 * Uses Google's public gtx endpoint — keyless and free, which fits the
 * no-paid-services constraint. It's unofficial, so treat failures as
 * non-fatal: the UI just keeps showing the original text. If it ever breaks
 * for good, this route is the single place to swap in another provider.
 *
 * Auth: signed-in users only, so the route can't be farmed as an open
 * translation proxy.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  let body: { text?: string; target?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const text = (body.text ?? '').slice(0, MAX_CHARS).trim();
  if (!text) {
    return NextResponse.json({ error: 'text is required.' }, { status: 400 });
  }
  // Target is a 2-letter language code from the viewer's browser locale.
  const target = /^[a-z]{2}$/i.test(body.target ?? '') ? body.target!.toLowerCase() : 'en';

  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto' +
    `&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0' },
      // Comment translations are stable — let Vercel/Next cache repeats.
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Translation service returned ${res.status}.` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as [Array<[string, ...unknown[]]>, unknown, string];
    const translated = (data[0] ?? [])
      .map((seg) => seg?.[0] ?? '')
      .join('');
    const detected = typeof data[2] === 'string' ? data[2] : 'unknown';
    if (!translated.trim()) {
      return NextResponse.json({ error: 'Empty translation.' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, translated, detected, target });
  } catch (err) {
    return NextResponse.json(
      { error: `Translation failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
