'use client';

import { useEffect } from 'react';
import { markFrameRead } from '@/lib/actions/notifications';

/**
 * Fire-and-forget client component that stamps frame_reads for the current
 * frame on mount. Lives in the frame detail page so the unread indicator
 * clears the first time a user lands here.
 */
export function MarkFrameRead({
  frameRowId,
  appSlug,
}: {
  frameRowId: string;
  appSlug: string;
}): null {
  useEffect(() => {
    void markFrameRead({ frameRowId, appSlug });
  }, [frameRowId, appSlug]);
  return null;
}
