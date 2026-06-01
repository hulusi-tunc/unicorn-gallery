import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentProfile, searchAppsAndFrames } from '@/lib/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const q = request.nextUrl.searchParams.get('q') ?? '';
  if (q.trim().length < 1) {
    return NextResponse.json({ apps: [], frames: [] });
  }
  try {
    const results = await searchAppsAndFrames(q, 6);
    return NextResponse.json(results, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (err) {
    console.error('[api/search] failed', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
