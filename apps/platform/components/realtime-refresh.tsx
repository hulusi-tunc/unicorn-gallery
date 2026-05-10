'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Subscribe to Postgres changes on a single table+filter and call
 * router.refresh() on each event. Lets server components re-fetch with
 * fresh data — minimal optimistic UI, but no stale state either.
 *
 * Usage:
 *   <RealtimeRefresh table="comments" filter={`frame_id=eq.${frameRowId}`} />
 *   <RealtimeRefresh table="notifications" filter={`user_id=eq.${userId}`} />
 */
export function RealtimeRefresh({
  table,
  filter,
  events = '*',
}: {
  table: 'comments' | 'notifications';
  /** Postgres filter string, e.g. `frame_id=eq.${id}`. Required so we don't fan out globally. */
  filter: string;
  /** Comma-separated event list, or '*' for all. Default: all. */
  events?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
}): null {
  const router = useRouter();
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`rt-${table}-${filter}`)
      .on(
        'postgres_changes',
        { event: events, schema: 'public', table, filter },
        () => {
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, filter, events, router]);
  return null;
}
