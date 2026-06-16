import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DorTool } from '@/components/dor-tool';

export const metadata: Metadata = {
  title: 'Readiness Check — Unicorn Studio',
  description:
    'A free Definition of Ready self-check. Score a PRD / WBS handoff before design starts.',
};

// Public, no-login calculator. Anyone can fill it in, see their verdict, and
// save an anonymous result with a shareable read-only link.
export default function PublicDorPage(): ReactNode {
  return <DorTool mode="public" apps={[]} initialHistory={[]} designerName="" />;
}
