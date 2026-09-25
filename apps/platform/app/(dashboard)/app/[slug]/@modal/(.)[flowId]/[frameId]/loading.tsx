import { FrameModalSkeleton } from '@/components/frame-modal-skeleton';

/**
 * Shown the instant a frame card is clicked, and between frames on prev/next,
 * while the modal's data loads. Without it the click appeared to do nothing
 * until every query had finished.
 */
export default function FrameModalLoading(): React.ReactNode {
  return <FrameModalSkeleton />;
}
