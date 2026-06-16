import { nanoid } from 'nanoid';
import { NextResponse, type NextRequest } from 'next/server';
import {
  canCommitEta,
  computeScore,
  sanitizeAnswers,
  sanitizeNote,
  sanitizeSectionNotes,
  type Track,
} from '@/lib/dor/criteria';
import { getCurrentProfile } from '@/lib/queries';
import { getSupabaseAdminClient, getSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/dor — list the team's Definition of Ready history (newest first).
 *
 * Optional `?project=Name` filters by exact project name. Agency-only: RLS
 * already blocks customers, and we return 403 explicitly for a clean message.
 * Anonymous public-calculator submissions are excluded.
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
    .eq('is_public', false)
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
  etaHours?: unknown;
  etaDate?: unknown;
  notes?: unknown;
  sectionNotes?: unknown;
  /** When true, this is an anonymous submission from the public /dor calculator. */
  public?: unknown;
}

function isTrack(v: unknown): v is Track {
  return v === 'ai' || v === 'figma';
}

/** Parse an ETA only once the score clears the unlock threshold (> 8). */
function parseEta(
  score: number,
  rawHours: unknown,
  rawDate: unknown,
): { etaHours: number | null; etaDate: string | null } {
  if (!canCommitEta(score)) return { etaHours: null, etaDate: null };
  let etaHours: number | null = null;
  let etaDate: string | null = null;
  if (typeof rawHours === 'number' && Number.isFinite(rawHours) && rawHours >= 0) {
    etaHours = rawHours;
  }
  if (typeof rawDate === 'string' && rawDate.trim()) {
    const parsed = new Date(rawDate);
    if (!Number.isNaN(parsed.getTime())) etaDate = parsed.toISOString();
  }
  return { etaHours, etaDate };
}

/**
 * POST /api/dor — save an assessment.
 *
 * Score, verdict, and clearance are ALWAYS recomputed here from the raw ticks
 * (the client's numbers are ignored). Two paths:
 *  - `public: true`  → anonymous submission from the public calculator. Written
 *    via the service-role client with is_public=true and no designer_id; never
 *    appears in team history.
 *  - otherwise       → internal team assessment; requires an agency session.
 */
export async function POST(request: NextRequest): Promise<Response> {
  let body: SavePayload;
  try {
    body = (await request.json()) as SavePayload;
  } catch {
    return NextResponse.json({ error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const track = body.track;
  if (!isTrack(track)) {
    return NextResponse.json({ error: 'track must be "ai" or "figma".' }, { status: 400 });
  }

  // Shared, authoritative recompute + sanitized fields.
  const rawScores =
    body.scores && typeof body.scores === 'object'
      ? (body.scores as Record<string, unknown>)
      : {};
  const scores = sanitizeAnswers(track, rawScores);
  const { score, verdict } = computeScore(track, scores);
  const { etaHours, etaDate } = parseEta(score, body.etaHours, body.etaDate);
  const notes = sanitizeNote(body.notes, 5000);
  const sectionNotes = sanitizeSectionNotes(track, body.sectionNotes);
  const shareToken = `dor_${nanoid(24)}`;

  // ── Anonymous public submission ──────────────────────────────────────────
  if (body.public === true) {
    const projectName =
      typeof body.projectName === 'string' ? body.projectName.trim().slice(0, 200) : '';
    const designerName =
      typeof body.designerName === 'string' ? body.designerName.trim().slice(0, 120) : '';
    if (!projectName || !designerName) {
      return NextResponse.json(
        { error: 'A project name and your name are required.' },
        { status: 400 },
      );
    }
    // Service-role client: RLS is agency-only, so anonymous writes go through
    // the server, which fully controls what's stored (public, no designer_id).
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('dor_assessments')
      .insert({
        app_id: null,
        project_name: projectName,
        designer_id: null,
        designer_name: designerName,
        track,
        scores,
        score,
        verdict,
        eta_hours: etaHours,
        eta_date: etaDate,
        notes,
        section_notes: sectionNotes,
        share_token: shareToken,
        is_public: true,
      })
      .select('*')
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ assessment: data });
  }

  // ── Internal team assessment (agency only) ───────────────────────────────
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  if (profile.role !== 'agency') {
    return NextResponse.json({ error: 'Agency members only.' }, { status: 403 });
  }

  const designerName =
    (typeof body.designerName === 'string' ? body.designerName.trim() : '') ||
    profile.name?.trim() ||
    profile.email;

  const supabase = await getSupabaseServerClient();

  // Resolve the project name. If linked to a gallery app, take the app's real
  // name (verified visible to this user) rather than trusting the client label.
  let appId: string | null = null;
  let projectName = typeof body.projectName === 'string' ? body.projectName.trim() : '';
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
      eta_hours: etaHours,
      eta_date: etaDate,
      notes,
      section_notes: sectionNotes,
      share_token: shareToken,
      is_public: false,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assessment: data });
}
