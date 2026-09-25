import { ProjectSkeleton } from '@/components/project-skeleton';

/**
 * Entering a project waits on its layout (app, manifest, builds, staff,
 * members, unresolved comments). This shows the page's shape immediately
 * instead of leaving the previous page frozen until all of that lands.
 */
export default function ProjectLoading(): React.ReactNode {
  return <ProjectSkeleton />;
}
