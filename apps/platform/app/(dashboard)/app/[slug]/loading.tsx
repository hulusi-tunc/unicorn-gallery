import { ProjectContentSkeleton } from '@/components/project-skeleton';

/**
 * Moving between pages inside a project (landing, a flow, organise, history):
 * the header and sidebar stay, and the content column shows its shape while
 * the next page loads.
 */
export default function ProjectPageLoading(): React.ReactNode {
  return <ProjectContentSkeleton />;
}
