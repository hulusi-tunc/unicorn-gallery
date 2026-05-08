'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdminClient, getSupabaseServerClient } from '@/lib/supabase/server';

const BUCKET = 'avatars';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

export async function uploadAvatar(
  formData: FormData,
): Promise<{ ok?: true; avatarUrl?: string; error?: string }> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const file = formData.get('file');
  if (!(file instanceof File)) return { error: 'No file provided.' };
  if (file.size === 0) return { error: 'File is empty.' };
  if (file.size > MAX_BYTES) {
    return { error: `Image is too large (${Math.round(file.size / 1024 / 1024)} MB). Max 5 MB.` };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { error: `Unsupported image type: ${file.type}. Use PNG, JPG, WebP, or GIF.` };
  }

  const ext = (() => {
    if (file.type === 'image/png') return 'png';
    if (file.type === 'image/jpeg' || file.type === 'image/jpg') return 'jpg';
    if (file.type === 'image/webp') return 'webp';
    if (file.type === 'image/gif') return 'gif';
    return 'png';
  })();

  // Cache-bust on every re-upload by including a timestamp.
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;

  const admin = getSupabaseAdminClient();

  // Ensure the bucket exists (idempotent, safe to call every time).
  const { data: list } = await admin.storage.listBuckets();
  if (!list?.some((b) => b.name === BUCKET)) {
    const { error: bucketErr } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
    });
    if (bucketErr && !/already exists/i.test(bucketErr.message)) {
      return { error: `Could not create avatars bucket: ${bucketErr.message}` };
    }
  }

  const bytes = await file.arrayBuffer();
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      upsert: true,
    });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);

  const { error: updErr } = await admin
    .from('profiles')
    .update({ avatar_url: pub.publicUrl })
    .eq('id', user.id);
  if (updErr) return { error: `Saving avatar URL failed: ${updErr.message}` };

  revalidatePath('/profile');
  revalidatePath('/');
  return { ok: true, avatarUrl: pub.publicUrl };
}

export async function removeAvatar(): Promise<{ ok?: true; error?: string }> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/profile');
  revalidatePath('/');
  return { ok: true };
}
