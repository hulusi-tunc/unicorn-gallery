'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/queries';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { R2_PUBLIC_PREFIX } from '@/lib/r2';

interface PublishInput {
  kind: 'macos-desktop' | 'chrome-extension';
  channel: 'stable' | 'canary';
  version: string;
  fileUrl: string;
  fileName: string;
  sizeBytes?: number;
  notes?: string;
}

/**
 * Record a release the browser has already PUT into R2. Called right after the
 * presigned upload finishes — this only writes metadata, never bytes.
 */
export async function publishRelease(
  input: PublishInput,
): Promise<{ ok?: true; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'agency') {
    return { error: 'Only studio members can publish releases.' };
  }
  if (input.kind !== 'macos-desktop' && input.kind !== 'chrome-extension') {
    return { error: 'Invalid release kind.' };
  }
  if (input.channel !== 'stable' && input.channel !== 'canary') {
    return { error: 'Invalid channel.' };
  }
  const version = input.version.trim();
  if (!version) return { error: 'Version is required.' };

  // Only accept URLs we handed out. Without this the row is an open redirect —
  // anyone able to call the action could point the team's download button at
  // an arbitrary host.
  if (!input.fileUrl.startsWith(`${R2_PUBLIC_PREFIX}/releases/`)) {
    return { error: 'File URL did not come from the release uploader.' };
  }

  const admin = getSupabaseAdminClient();
  const { error } = await admin.from('app_releases').insert({
    kind: input.kind,
    channel: input.channel,
    version,
    file_url: input.fileUrl,
    file_name: input.fileName,
    size_bytes: input.sizeBytes ?? null,
    notes: input.notes?.trim() || null,
    uploaded_by: profile.id,
  });
  if (error) return { error: error.message };

  revalidatePath('/downloads');
  return { ok: true };
}

/** Remove a release from the list. The R2 object is left in place. */
export async function deleteRelease(id: string): Promise<{ ok?: true; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'agency') {
    return { error: 'Only studio members can remove releases.' };
  }
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from('app_releases').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/downloads');
  return { ok: true };
}
