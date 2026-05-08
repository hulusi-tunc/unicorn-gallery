'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase/server';

interface UpdateInput {
  name: string;
  flavor: 'designer' | 'non-designer' | null;
}

export async function updateProfile(input: UpdateInput): Promise<{ ok?: true; error?: string }> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const name = input.name.trim();
  if (name.length < 2) return { error: 'Name must be at least 2 characters.' };

  const flavor =
    input.flavor === 'designer' || input.flavor === 'non-designer' ? input.flavor : null;

  const { error } = await supabase
    .from('profiles')
    .update({ name, flavor })
    .eq('id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/profile');
  revalidatePath('/');
  return { ok: true };
}
