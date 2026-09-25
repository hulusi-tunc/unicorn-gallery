import type { ReactNode } from 'react';

/**
 * Placeholders for a project page while its data loads, laid out on the same
 * grid as the real page (AppHeader, FlowSidebar, the flow strips) so the
 * content drops into place instead of jumping. Shimmer comes from the
 * `.skeleton` class in globals.css, which holds still under reduced motion.
 */

const CONTAINER = 'mx-auto w-full max-w-[1600px] px-6 lg:px-10 xl:px-16';

function Bar({ className = '', style }: { className?: string; style?: React.CSSProperties }): ReactNode {
  return <span aria-hidden className={`skeleton block rounded ${className}`} style={style} />;
}

/** Whole project: header, flow sidebar and content. Shown on entering a project. */
export function ProjectSkeleton(): ReactNode {
  return (
    <div
      role="status"
      aria-label="Loading project"
      className="flex flex-col overflow-hidden"
      style={{ height: 'calc(100vh - 60px)' }}
    >
      <div className={CONTAINER} style={{ paddingTop: 24, paddingBottom: 20 }}>
        <Bar className="rounded-2xl" style={{ width: 72, height: 72 }} />
        <Bar className="mt-5 h-[38px] w-72 rounded-lg" />
        <div className="mt-5 flex gap-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Bar className="h-3 w-14" />
              <Bar className="h-4 w-24" />
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-2">
          <Bar className="h-9 w-16 rounded-full" />
          <Bar className="h-9 w-20 rounded-full" />
          <Bar className="h-9 w-9 rounded-full" />
        </div>
      </div>
      <div className={`${CONTAINER} flex min-h-0 flex-1`}>
        <aside className="hidden w-[240px] shrink-0 flex-col gap-4 pr-6 pt-4 md:flex">
          <Bar className="h-8 w-full rounded-lg" />
          {[70, 85, 60, 90, 75, 55, 80, 65].map((w, i) => (
            <Bar key={i} className="h-3.5" style={{ width: `${w}%`, marginLeft: i % 3 === 0 ? 0 : 16 }} />
          ))}
        </aside>
        <ProjectContentSkeleton />
      </div>
    </div>
  );
}

/**
 * Just the content column. Shown when moving between pages inside a project,
 * where the header and sidebar are already on screen.
 */
export function ProjectContentSkeleton(): ReactNode {
  return (
    <div role="status" aria-label="Loading" className="flex min-w-0 flex-1 flex-col gap-16 overflow-hidden py-4 md:pl-6">
      {[0, 1, 2].map((section) => (
        <div key={section} className="flex flex-col">
          <Bar className="h-5 w-56" />
          <Bar className="mt-2 h-3.5 w-24" />
          <div className="mt-6 flex gap-3">
            {[0, 1, 2, 3].map((card) => (
              <div
                key={card}
                className="shrink-0"
                style={{ width: 'calc(25% - 9px)', minWidth: 180, maxWidth: 300 }}
              >
                <Bar className="w-full rounded-xl" style={{ aspectRatio: '16 / 10' }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
