import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import type { DorAssessment } from '@/lib/db';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { DorSharedView } from './dor-shared-view';

// Public, token-gated route — no per-request auth. The share_token is an
// unguessable secret, so we serve only the single matching row, read-only.
// `/shared/*` is already in the middleware public allowlist.
export const revalidate = 60;

export default async function SharedDorPage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<ReactNode> {
  const { token } = await params;
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from('dor_assessments')
    .select('*')
    .eq('share_token', token)
    .maybeSingle();
  if (!data) notFound();
  return <DorSharedView assessment={data as DorAssessment} />;
}
