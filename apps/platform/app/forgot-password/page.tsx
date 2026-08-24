import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { ForgotPasswordClient } from './forgot-password-client';

export const dynamic = 'force-dynamic';

export default async function ForgotPasswordPage(): Promise<ReactNode> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/apps');

  return <ForgotPasswordClient />;
}
