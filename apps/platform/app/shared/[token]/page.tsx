import { Camera } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import type { ManifestFlow, ManifestFrame, Platform } from '@unicorn-studio/gallery-capture';
import { DeviceBezel } from '@/components/device-bezel';
import { WebCardThumb } from '@/components/web-card-thumb';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { imageHref } from '@/lib/image-href';
import type {
  AppRow,
  Frame,
  ManifestFlowSnapshot,
  ManifestFrameSnapshot,
  ManifestSnapshot,
} from '@/lib/db';

// Public token-gated route — no per-request auth, so we can cache aggressively.
// 60s revalidate strikes a balance: customers see new pushes within a minute,
// agency users still get instant feedback on their authenticated views.
export const revalidate = 60;

interface FlowNode {
  flow: ManifestFlow;
  children: FlowNode[];
}

function buildFlowTree(flows: readonly ManifestFlow[]): FlowNode[] {
  const ids = new Set(flows.map((f) => f.id));
  const childrenOf = new Map<string | undefined, ManifestFlow[]>();
  for (const f of flows) {
    const key = f.parentFlowId && ids.has(f.parentFlowId) ? f.parentFlowId : undefined;
    const list = childrenOf.get(key) ?? [];
    list.push(f);
    childrenOf.set(key, list);
  }
  const build = (parent: string | undefined): FlowNode[] =>
    (childrenOf.get(parent) ?? []).map((f) => ({
      flow: f,
      children: build(f.id),
    }));
  return build(undefined);
}

async function loadSharedApp(
  token: string,
): Promise<{ app: AppRow; manifest: ManifestSnapshot | null } | null> {
  const admin = getSupabaseAdminClient();

  const { data: app } = await admin
    .from('apps')
    .select('*')
    .eq('public_share_token', token)
    .maybeSingle();
  if (!app) return null;

  const { data: frames } = await admin
    .from('frames')
    .select('*')
    .eq('app_id', app.id)
    .order('flow_position', { ascending: true, nullsFirst: false })
    .order('flow_id', { ascending: true })
    .order('frame_position', { ascending: true, nullsFirst: false })
    .order('frame_id', { ascending: true });

  if (!frames || frames.length === 0) {
    return { app: app as AppRow, manifest: null };
  }

  const manifest = framesToManifest(frames as Frame[], app as AppRow);
  return { app: app as AppRow, manifest };
}

function framesToManifest(frames: Frame[], app: AppRow): ManifestSnapshot {
  // Group rows by flow_id while keeping the order they came back in.
  const flowMap = new Map<string, ManifestFlowSnapshot>();
  for (const f of frames) {
    let flow = flowMap.get(f.flow_id);
    if (!flow) {
      flow = {
        id: f.flow_id,
        name: f.flow_name,
        parentFlowId: f.parent_flow_id ?? undefined,
        position: f.flow_position ?? undefined,
        frames: [],
      };
      flowMap.set(f.flow_id, flow);
    }
    const frameSnapshot: ManifestFrameSnapshot = {
      id: f.frame_id,
      name: f.frame_name,
      position: f.frame_position ?? undefined,
      image: f.latest_image_url ?? '',
    };
    flow.frames.push(frameSnapshot);
  }
  return {
    projectId: app.id,
    buildSha: '',
    capturedAt: app.created_at,
    platform: app.platform,
    flows: Array.from(flowMap.values()),
  };
}

export default async function SharedAppPage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<ReactNode> {
  const { token } = await params;
  const result = await loadSharedApp(token);
  if (!result) notFound();
  const { app, manifest } = result;

  const accent = app.accent_color ?? 'oklch(0.5 0.22 254)';

  return (
    <div className="min-h-screen bg-white text-[oklch(0.24_0.01_260)] dark:bg-[oklch(0.145_0.006_260)] dark:text-[oklch(0.82_0.012_260)]">
      <header
        className="border-b border-[oklch(0.9_0.007_260)] dark:border-[oklch(0.24_0.008_260)]"
        style={{ background: 'inherit' }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-5">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ background: accent, fontFamily: 'serif', fontWeight: 600, fontSize: 16 }}
          >
            {app.icon_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={app.icon_url}
                alt=""
                className="h-full w-full rounded-lg object-cover"
              />
            ) : (
              app.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
              Shared
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]">
              {app.name}
            </h1>
            {app.tagline ? (
              <p className="mt-0.5 text-sm text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
                {app.tagline}
              </p>
            ) : null}
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
            Read-only
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-2 py-8">
        {!manifest || manifest.flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center">
            <Camera size={20} className="text-[oklch(0.62_0.01_260)]" />
            <p className="text-sm text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
              No screens captured yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-12">
            {buildFlowTree(manifest.flows).map((node) => (
              <FlowSection
                key={node.flow.id}
                node={node}
                platform={manifest.platform}
                isSub={false}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="mt-12 border-t border-[oklch(0.9_0.007_260)] py-6 text-center dark:border-[oklch(0.24_0.008_260)]">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
          Shared by Unicorn Studio
        </p>
      </footer>
    </div>
  );
}

function FlowSection({
  node,
  platform,
  isSub,
}: {
  node: FlowNode;
  platform: Platform;
  isSub: boolean;
}): ReactNode {
  return (
    <section
      className={
        isSub
          ? 'ml-10 border-l-2 border-[oklch(0.92_0.01_260)] pl-6 dark:border-[oklch(0.26_0.01_260)]'
          : undefined
      }
    >
      <div
        className={
          isSub
            ? 'flex items-baseline justify-between px-2 pb-2'
            : 'flex items-baseline justify-between px-8 pb-3'
        }
      >
        <div>
          <h2
            className={
              isSub
                ? 'text-sm font-semibold tracking-tight text-[oklch(0.20_0.008_260)] dark:text-[oklch(0.92_0.005_260)]'
                : 'text-base font-semibold tracking-tight text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]'
            }
          >
            {node.flow.name}
          </h2>
        </div>
        <span className="text-xs text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
          {node.flow.frames.length} frame{node.flow.frames.length === 1 ? '' : 's'}
        </span>
      </div>
      <ReadonlyJourneyStrip flow={node.flow} platform={platform} />
      {node.children.length > 0 && (
        <div className="mt-6 flex flex-col gap-8">
          {node.children.map((child) => (
            <FlowSection
              key={child.flow.id}
              node={child}
              platform={platform}
              isSub={true}
            />
          ))}
        </div>
      )}
    </section>
  );
}

const MOBILE_CARD_HEIGHT = 380;
const WEB_CARD_HEIGHT = 220;
const WEB_CARD_WIDTH = 360;

function ReadonlyJourneyStrip({
  flow,
  platform,
}: {
  flow: ManifestFlow;
  platform: Platform;
}): ReactNode {
  return (
    <div className="no-scrollbar overflow-x-auto px-10 pb-10 pt-4">
      <ol className="flex items-start gap-6">
        {flow.frames.map((frame, i) => (
          <li key={frame.id} className="flex shrink-0 flex-col gap-2">
            <ReadonlyCard frame={frame} step={i + 1} platform={platform} />
            <p className="px-2 text-xs text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
              {frame.name}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ReadonlyCard({
  frame,
  step,
  platform,
}: {
  frame: ManifestFrame;
  step: number;
  platform: Platform;
}): ReactNode {
  const src = frame.image ? imageHref(frame.image) : null;
  const isMobile = platform === 'ios' || platform === 'android';

  if (isMobile) {
    const height = MOBILE_CARD_HEIGHT;
    return (
      <div className="flex shrink-0 flex-col items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.08em] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
          {String(step).padStart(2, '0')}
        </span>
        {src ? (
          <DeviceBezel src={src} alt={frame.name} style={{ height }} />
        ) : (
          <div
            style={{ height, aspectRatio: '450 / 920' }}
            className="shrink-0 rounded-[18%] bg-[oklch(0.93_0.005_260)] dark:bg-[oklch(0.20_0.008_260)]"
          />
        )}
      </div>
    );
  }

  return (
    <div className="group flex shrink-0 flex-col items-start gap-2">
      <span className="font-mono text-[10px] tracking-[0.08em] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
        {String(step).padStart(2, '0')}
      </span>
      {src ? (
        <WebCardThumb src={src} alt={frame.name} width={WEB_CARD_WIDTH} height={WEB_CARD_HEIGHT} />
      ) : (
        <div
          className="overflow-hidden rounded-lg bg-white shadow-sm dark:bg-[oklch(0.18_0.008_260)]"
          style={{ width: WEB_CARD_WIDTH, height: WEB_CARD_HEIGHT }}
        />
      )}
    </div>
  );
}
