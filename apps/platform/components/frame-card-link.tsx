'use client';

import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { type FramePreview, frameCardHandlers } from '@/lib/frame-preview';

/**
 * A frame card's Link that primes the frame modal's loading shell on click
 * (see lib/frame-preview). A client wrapper so server-rendered grids can use
 * it with plain, serialisable props.
 */
export function FrameCardLink({
  preview,
  ...props
}: ComponentProps<typeof Link> & { preview: Omit<FramePreview, 'mode'> }): ReactNode {
  return <Link {...props} {...frameCardHandlers(preview)} />;
}
