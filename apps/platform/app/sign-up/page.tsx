import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getBrand } from '@/lib/brand-server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { SignUpClient } from './sign-up-client';

export const dynamic = 'force-dynamic';

export default async function SignUpPage(): Promise<ReactNode> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/apps');
  // Sign-up is for the studio's own team; a white-labelled host has none.
  if ((await getBrand()).id !== 'unicorn') redirect('/sign-in');

  return <SignUpClient />;
}
