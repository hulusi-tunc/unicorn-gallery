import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  title,
  body,
  hint,
  icon,
}: {
  title: string;
  body: string;
  hint?: ReactNode;
  icon?: ReactNode;
}): ReactNode {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-xl space-y-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900/50 text-neutral-500">
          {icon ?? <Inbox size={20} />}
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-50">{title}</h1>
          <p className="text-sm leading-relaxed text-neutral-400">{body}</p>
        </div>
        {hint ? (
          <pre className="overflow-x-auto rounded-md border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-left font-mono text-xs leading-relaxed text-neutral-300">
            {hint}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
