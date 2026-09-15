import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { OrganiseBoard } from '@/components/organise-board';
import { getAppBySlug, getCurrentProfile, getManifestForApp } from '@/lib/queries';

export const dynamic = 'force-dynamic';

/**
 * Structure editor for a project.
 *
 * Agency only, and not version-scoped on purpose: an override applies to the
 * project rather than to one build, so editing while looking at an old version
 * would imply a per-version edit that does not exist.
 */
export default async function OrganisePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<ReactNode> {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);

  const [app, profile] = await Promise.all([getAppBySlug(decoded), getCurrentProfile()]);
  if (!app) notFound();
  if (!profile || profile.role !== 'agency') {
    redirect(`/app/${encodeURIComponent(decoded)}`);
  }

  const manifest = await getManifestForApp(app.id);

  return (
    <main className="mx-auto w-full max-w-[1600px] px-6 py-8 lg:px-10 xl:px-16">
      <div className="mb-6 flex items-baseline gap-3">
        <Link
          href={`/app/${encodeURIComponent(decoded)}`}
          className="flex items-center gap-1.5 text-sm opacity-60 hover:opacity-100"
        >
          <ArrowLeft size={14} /> {app.name}
        </Link>
        <h1 className="text-lg font-semibold">Organise</h1>
      </div>

      {!manifest || manifest.flows.length === 0 ? (
        <p className="text-sm opacity-60">
          Nothing captured yet — push a build and the flows will show up here.
        </p>
      ) : (
        <OrganiseBoard appSlug={decoded} platform={app.platform} flows={manifest.flows} />
      )}
    </main>
  );
}
