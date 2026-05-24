'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/queries';
import { getSupabaseAdminClient, getSupabaseServerClient } from '@/lib/supabase/server';

const BUCKET = 'app-icons';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

async function assertAgency(): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'agency') {
    return { ok: false, error: 'Only agency members can edit projects.' };
  }
  return { ok: true };
}

async function resolveApp(slug: string): Promise<{ id: string; slug: string } | null> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from('apps')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle();
  return data ?? null;
}

export async function renameProject(
  slug: string,
  name: string,
): Promise<{ ok?: true; error?: string }> {
  const gate = await assertAgency();
  if (!gate.ok) return { error: gate.error };

  const trimmed = name.trim();
  if (trimmed.length === 0) return { error: 'Name cannot be empty.' };
  if (trimmed.length > 120) return { error: 'Name is too long (max 120 chars).' };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from('apps')
    .update({ name: trimmed })
    .eq('slug', slug);
  if (error) return { error: error.message };

  revalidatePath('/');
  revalidatePath(`/app/${slug}`);
  return { ok: true };
}

export async function uploadProjectIcon(
  slug: string,
  formData: FormData,
): Promise<{ ok?: true; iconUrl?: string; error?: string }> {
  const gate = await assertAgency();
  if (!gate.ok) return { error: gate.error };

  const app = await resolveApp(slug);
  if (!app) return { error: 'Project not found.' };

  const file = formData.get('file');
  if (!(file instanceof File)) return { error: 'No file provided.' };
  if (file.size === 0) return { error: 'File is empty.' };
  if (file.size > MAX_BYTES) {
    return {
      error: `Image is too large (${Math.round(file.size / 1024 / 1024)} MB). Max 5 MB.`,
    };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { error: `Unsupported image type: ${file.type}. Use PNG, JPG, WebP, GIF, or SVG.` };
  }

  const ext =
    file.type === 'image/png'
      ? 'png'
      : file.type === 'image/jpeg' || file.type === 'image/jpg'
        ? 'jpg'
        : file.type === 'image/webp'
          ? 'webp'
          : file.type === 'image/gif'
            ? 'gif'
            : 'svg';

  // Cache-bust on every re-upload by including a timestamp in the path.
  const path = `${app.id}/icon-${Date.now()}.${ext}`;
  const admin = getSupabaseAdminClient();

  const { data: list } = await admin.storage.listBuckets();
  if (!list?.some((b) => b.name === BUCKET)) {
    const { error: bucketErr } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
    });
    if (bucketErr && !/already exists/i.test(bucketErr.message)) {
      return { error: `Could not create app-icons bucket: ${bucketErr.message}` };
    }
  }

  const bytes = await file.arrayBuffer();
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);

  const { error: updErr } = await admin
    .from('apps')
    .update({ icon_url: pub.publicUrl })
    .eq('id', app.id);
  if (updErr) return { error: `Saving icon URL failed: ${updErr.message}` };

  revalidatePath('/');
  revalidatePath(`/app/${slug}`);
  return { ok: true, iconUrl: pub.publicUrl };
}

export async function removeProjectIcon(
  slug: string,
): Promise<{ ok?: true; error?: string }> {
  const gate = await assertAgency();
  if (!gate.ok) return { error: gate.error };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from('apps')
    .update({ icon_url: null })
    .eq('slug', slug);
  if (error) return { error: error.message };

  revalidatePath('/');
  revalidatePath(`/app/${slug}`);
  return { ok: true };
}
