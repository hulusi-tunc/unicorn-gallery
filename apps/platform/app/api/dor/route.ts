import { NextResponse, type NextRequest } from 'next/server';
import { computeScore, sanitizeScores, type Track } from '@/lib/dor/criteria';
import { getCurrentProfile } from '@/lib/queries';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/dor — list the team's Definition of Ready history (newest first).
 *
 * Optional `?project=Name` filters by exact project name. Agency-only: RLS
 * already blocks customers, and we return 403 explicitly for a clean message.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  if (profile.role !== 'agency') {
    return NextResponse.json({ error: 'Agency members only.' }, { status: 403 });
  }

  const project = new URL(request.url).searchParams.get('project');
  const supabase = await getSupabaseServerClient();
  let query = supabase
    .from('dor_assessments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (project) query = query.eq('project_name', project);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ assessments: data ?? [] });
}

interface SavePayload {
  track?: unknown;
  projectName?: unknown;
  appId?: unknown;
  designerName?: unknown;
  scores?: unknown;
  etaDays?: unknown;
  etaDate?: unknown;
}

function isTrack(v: unknown): v is Track {
  return v === 'ai' || v === 'figma';
}

/**
 * POST /api/dor — save an assessment.
 *
 * The score, verdict, and clearance are ALWAYS recomputed here from the raw
 * ticks via the shared criteria module — the client's numbers are ignored.
 * ETA is only persisted once the assessment clears; otherwise it's forced null
 * so a not-ready check can never carry a stale date.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  if (profile.role !== 'agency') {
    return NextResponse.json({ error: 'Agency members only.' }, { status: 403 });
  }

  let body: SavePayload;
  try {
    body = (await request.json()) as SavePayload;
  } catch {
    return NextResponse.json({ error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const track = body.track;
  if (!isTrack(track)) {
    return NextResponse.json(
      { error: 'track must be "ai" or "figma".' },
      { status: 400 },
    );
  }

  const designerName =
    (typeof body.designerName === 'string' ? body.designerName.trim() : '') ||
    profile.name?.trim() ||
    profile.email;

  const rawScores =
    body.scores && typeof body.scores === 'object'
      ? (body.scores as Record<string, unknown>)
      : {};
  const scores = sanitizeScores(track, rawScores);

  const supabase = await getSupabaseServerClient();

  // Resolve the project name. If linked to a gallery app, take the app's real
  // name (and verify it's visible to this user) rather than trusting the
  // client-sent label — keeps history honest and unspoofable.
  let appId: string | null = null;
  let projectName =
    typeof body.projectName === 'string' ? body.projectName.trim() : '';

  if (typeof body.appId === 'string' && body.appId.trim()) {
    const { data: app, error: appErr } = await supabase
      .from('apps')
      .select('id, name')
      .eq('id', body.appId.trim())
      .maybeSingle();
    if (appErr) {
      return NextResponse.json({ error: appErr.message }, { status: 500 });
    }
    if (!app) {
      return NextResponse.json(
        { error: 'Linked project not found or not visible to you.' },
        { status: 400 },
      );
    }
    appId = app.id;
    projectName = app.name;
  }

  if (!projectName) {
    return NextResponse.json(
      { error: 'A project name (or linked project) is required.' },
      { status: 400 },
    );
  }

  // Authoritative recompute — never trust client score/verdict.
  const { score, verdict, cleared } = computeScore(track, scores);

  // ETA is meaningful only once cleared.
  let etaDays: number | null = null;
  let etaDate: string | null = null;
  if (cleared) {
    if (typeof body.etaDays === 'number' && Number.isFinite(body.etaDays) && body.etaDays >= 0) {
      etaDays = body.etaDays;
    }
    if (typeof body.etaDate === 'string' && body.etaDate.trim()) {
      const parsed = new Date(body.etaDate);
      if (!Number.isNaN(parsed.getTime())) etaDate = parsed.toISOString();
    }
  }

  const { data, error } = await supabase
    .from('dor_assessments')
    .insert({
      app_id: appId,
      project_name: projectName,
      designer_id: profile.id,
      designer_name: designerName,
      track,
      scores,
      score,
      verdict,
      eta_days: etaDays,
      eta_date: etaDate,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assessment: data });
}
