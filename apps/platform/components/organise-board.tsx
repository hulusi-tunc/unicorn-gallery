'use client';

import { useMemo, useState, useTransition } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { DeviceBezel } from '@/components/device-bezel';
import { WebCardThumb } from '@/components/web-card-thumb';
import type { ManifestFlowSnapshot, Platform } from '@/lib/db';
import { imageHref } from '@/lib/image-href';
import {
  createFlow,
  moveFrameToFlow,
  renameFlow,
  renameFrame,
  reorderFlows,
  reorderFrames,
  resetStructure,
  setFlowHidden,
  setFlowParent,
  setFrameHidden,
  type FrameKey,
} from '@/lib/actions/structure';

/**
 * The structure editor.
 *
 * Deliberately a separate surface from the browse views rather than an edit
 * mode bolted onto them: dragging and deleting want a layout that admits it,
 * and the reading experience should not carry the weight of controls nobody
 * uses while reviewing.
 *
 * Every mutation is a server action that writes an override row and
 * revalidates, so what lands here is the same thing the gallery will render.
 */

interface Props {
  appSlug: string;
  platform: Platform;
  flows: ManifestFlowSnapshot[];
}

/** Where a frame came from — what the override tables key on. */
function keyOf(flowId: string, frame: { id: string; originFlowId?: string }): FrameKey {
  return { flowId: frame.originFlowId ?? flowId, frameId: frame.id };
}

export function OrganiseBoard({ appSlug, platform, flows }: Props): ReactNode {
  const isMobile = platform !== 'web';
  // Open on a flow that has something to show: the first entry is often a
  // section container with no screens of its own, and landing on an empty
  // grid reads as "nothing here" rather than "pick a flow".
  const [selected, setSelected] = useState<string | null>(
    flows.find((f) => f.frames.length > 0)?.id ?? flows[0]?.id ?? null,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /*
    The drag payload rides on the event's dataTransfer rather than in state.
    State is set asynchronously, so a drop that lands before React has
    re-rendered reads the previous value — which is how dropping a screen onto
    a flow silently did nothing. dataTransfer is set and read within the same
    drag, so it cannot go stale. State is kept only for the drop highlight,
    where being a render behind costs nothing.
  */
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [dragKind, setDragKind] = useState<'frame' | 'flow' | null>(null);

  const current = flows.find((f) => f.id === selected) ?? null;

  // The tree, ordered as the manifest already ordered it — the board should
  // show exactly what the gallery shows, never its own idea of the order.
  const roots = useMemo(() => flows.filter((f) => !f.parentFlowId), [flows]);
  const childrenOf = useMemo(() => {
    const m = new Map<string, ManifestFlowSnapshot[]>();
    for (const f of flows) {
      if (!f.parentFlowId) continue;
      const list = m.get(f.parentFlowId) ?? [];
      list.push(f);
      m.set(f.parentFlowId, list);
    }
    return m;
  }, [flows]);

  const run = (fn: () => Promise<{ ok?: true; error?: string }>): void => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
    });
  };

  /* ── drag payloads ── */

  const FRAME_MIME = 'application/x-uc-frame';
  const FLOW_MIME = 'application/x-uc-flow';

  const readFrameDrag = (
    e: React.DragEvent,
  ): { flowId: string; index: number } | null => {
    const raw = e.dataTransfer.getData(FRAME_MIME);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { flowId: string; index: number };
    } catch {
      return null;
    }
  };

  /* ── frames ── */

  /**
   * Reorder without a mouse.
   *
   * The drag is the fast path, not the only one: a pointer drag is unusable
   * from a keyboard and awkward with assistive tech, and this board is where
   * the order is decided, so it cannot be mouse-only.
   */
  const nudgeFrame = (index: number, delta: number): void => {
    if (!current) return;
    const to = index + delta;
    if (to < 0 || to >= current.frames.length) return;
    const next = [...current.frames];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    run(() => reorderFrames(appSlug, next.map((f) => keyOf(current.id, f))));
  };

  const moveFrameTo = (index: number, toFlowId: string): void => {
    if (!current || !toFlowId || toFlowId === current.id) return;
    const moved = current.frames[index];
    if (!moved) return;
    const destination = flows.find((f) => f.id === toFlowId);
    const order = [
      ...(destination?.frames ?? []).map((f) => keyOf(toFlowId, f)),
      keyOf(current.id, moved),
    ];
    run(() => moveFrameToFlow(appSlug, keyOf(current.id, moved), toFlowId, order));
  };

  const onFrameDrop = (e: React.DragEvent, targetIndex: number): void => {
    const drag = readFrameDrag(e);
    if (!drag || !current || drag.flowId !== current.id) return;
    const next = [...current.frames];
    const [moved] = next.splice(drag.index, 1);
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    run(() => reorderFrames(appSlug, next.map((f) => keyOf(current.id, f))));
  };

  const onDropFrameOnFlow = (e: React.DragEvent, flowId: string): void => {
    const drag = readFrameDrag(e);
    if (!drag || !current || flowId === current.id) return;
    const moved = current.frames[drag.index];
    if (!moved) return;
    const destination = flows.find((f) => f.id === flowId);
    // The destination's order is sent with the move so the screen lands at the
    // end of it rather than wherever a missing position happens to sort.
    const order = [
      ...(destination?.frames ?? []).map((f) => keyOf(flowId, f)),
      keyOf(current.id, moved),
    ];
    run(() => moveFrameToFlow(appSlug, keyOf(current.id, moved), flowId, order));
    setDropTarget(null);
  };

  /* ── flows ── */

  const onFlowDrop = (e: React.DragEvent, targetId: string): void => {
    const draggedId = e.dataTransfer.getData(FLOW_MIME);
    if (!draggedId || draggedId === targetId) return;
    const sibling = flows.find((f) => f.id === targetId);
    const dragged = flows.find((f) => f.id === draggedId);
    if (!sibling || !dragged) return;
    // Dragging only ever reorders within one level. Nesting is the "Nest in…"
    // menu instead: dropping onto a row is ambiguous — it reads equally as
    // "put it before this" and "put it inside this" — and the menu can also
    // reach a flow that has no children to drop beside.
    if ((sibling.parentFlowId ?? null) !== (dragged.parentFlowId ?? null)) return;
    const sibs = flows.filter(
      (f) => (f.parentFlowId ?? null) === (sibling.parentFlowId ?? null),
    );
    const from = sibs.findIndex((f) => f.id === draggedId);
    const to = sibs.findIndex((f) => f.id === targetId);
    const next = [...sibs];
    const [m] = next.splice(from, 1);
    if (m) next.splice(to, 0, m);
    run(() => reorderFlows(appSlug, next.map((f) => f.id)));
  };

  /**
   * Flows this one may be nested in: anything but itself and its own
   * descendants, since either would make a loop the tree cannot draw.
   */
  const nestOptions = (flowId: string): ManifestFlowSnapshot[] => {
    const banned = new Set([flowId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of flows) {
        if (f.parentFlowId && banned.has(f.parentFlowId) && !banned.has(f.id)) {
          banned.add(f.id);
          grew = true;
        }
      }
    }
    return flows.filter((f) => !banned.has(f.id));
  };

  const renderFlow = (flow: ManifestFlowSnapshot, depth: number): ReactNode => {
    const kids = childrenOf.get(flow.id) ?? [];
    const isDropping = dropTarget === flow.id;
    return (
      <div key={flow.id}>
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(FLOW_MIME, flow.id);
            e.dataTransfer.effectAllowed = 'move';
            setDragKind('flow');
          }}
          onDragEnd={() => {
            setDragKind(null);
            setDropTarget(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragKind === 'frame') setDropTarget(flow.id);
          }}
          onDragLeave={() => setDropTarget((t) => (t === flow.id ? null : t))}
          onDrop={(e) => {
            e.preventDefault();
            // Which kind it is comes off the payload, so a drop is read the
            // same way whatever the highlight state happens to say.
            if (e.dataTransfer.getData(FRAME_MIME)) onDropFrameOnFlow(e, flow.id);
            else onFlowDrop(e, flow.id);
            setDragKind(null);
          }}
          onClick={() => setSelected(flow.id)}
          className={[
            'group flex items-center gap-1.5 rounded-md px-2 py-[7px] text-sm',
            // A section container holds sub-flows and no screens of its own;
            // it reads as a heading so an empty right pane is never a surprise.
            flow.frames.length === 0 && kids.length > 0
              ? 'font-medium text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]'
              : 'text-[oklch(0.32_0.01_260)] dark:text-[oklch(0.78_0.012_260)]',
            selected === flow.id
              ? 'bg-[oklch(0.93_0.006_260)] dark:bg-[oklch(0.24_0.008_260)]'
              : 'hover:bg-[oklch(0.96_0.004_260)] dark:hover:bg-[oklch(0.2_0.007_260)]',
            isDropping ? 'ring-2 ring-blue-500' : '',
          ].join(' ')}
          style={{ marginLeft: depth * 14, cursor: 'grab' }}
        >
          <GripVertical size={13} className="shrink-0 opacity-30" />
          {kids.length > 0 ? (
            <ChevronDown size={13} className="shrink-0 opacity-50" />
          ) : (
            <ChevronRight size={13} className="shrink-0 opacity-0" />
          )}
          <button
            type="button"
            className="flex-1 truncate text-left"
            onDoubleClick={() => {
              const name = window.prompt('Flow name', flow.name);
              if (name) run(() => renameFlow(appSlug, flow.id, name));
            }}
            title="Double-click to rename"
          >
            {flow.name}
          </button>
          <span className="shrink-0 text-xs tabular-nums opacity-35">
            {flow.frames.length || ''}
          </span>
          <select
            aria-label={`Nest ${flow.name} in another flow`}
            title="Nest this flow inside another"
            className="w-[4.5rem] shrink-0 rounded border border-black/10 bg-transparent px-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-70 hover:!opacity-100 dark:border-white/15"
            value=""
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const v = e.target.value;
              e.currentTarget.value = '';
              if (!v) return;
              run(() => setFlowParent(appSlug, flow.id, v === '__top' ? null : v));
            }}
          >
            <option value="">Nest in…</option>
            <option value="__top">Top level</option>
            {nestOptions(flow.id).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label={`Delete ${flow.name}`}
            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Hide "${flow.name}" and everything under it?`)) {
                run(() => setFlowHidden(appSlug, flow.id, true));
              }
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
        {kids.map((k) => renderFlow(k, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex gap-6" style={{ opacity: pending ? 0.6 : 1 }}>
      {/* ── flow tree ── */}
      {/* Scrolls on its own: a project with thirty-odd flows makes this column
          taller than the viewport, and if it drove the page scroll the screens
          you are arranging would slide out of sight while you reached for a
          flow to drop them on. */}
      <aside className="sticky top-4 flex max-h-[calc(100vh-7rem)] w-80 shrink-0 flex-col overflow-y-auto pr-1">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="font-mono text-[10px] uppercase tracking-wider opacity-50">
            Flows
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
              onClick={() => {
                const name = window.prompt('New flow name');
                if (name) run(async () => createFlow(appSlug, name));
              }}
            >
              <Plus size={12} /> Flow
            </button>
            <button
              type="button"
              className="flex items-center gap-1 text-xs opacity-50 hover:underline hover:opacity-100"
              title="Drop every gallery edit and go back to what capture pushed"
              onClick={() => {
                if (window.confirm('Undo every rename, reorder and deletion made here?')) {
                  run(() => resetStructure(appSlug));
                }
              }}
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">{roots.map((f) => renderFlow(f, 0))}</div>
        <p className="mt-3 px-2 text-xs leading-relaxed opacity-45">
          Double-click a name to rename it. Drag a flow to reorder it among its
          siblings, or use “Nest in…” to move it under another. Screens are
          reordered and moved from the cards on the right.
        </p>
      </aside>

      {/* ── screens of the selected flow ── */}
      <section className="min-w-0 flex-1 pb-16">
        {error ? (
          <p className="mb-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
        {current ? (
          <div className="mb-5 flex items-baseline gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{current.name}</h2>
            <span className="text-sm opacity-45">
              {current.frames.length}{' '}
              {current.frames.length === 1 ? 'screen' : 'screens'}
            </span>
          </div>
        ) : null}

        {!current ? (
          <p className="text-sm opacity-50">Pick a flow.</p>
        ) : current.frames.length === 0 ? (
          <p className="text-sm opacity-50">
            “{current.name}” has no screens yet — move one here from another flow.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-5">
            {current.frames.map((frame, i) => (
              <div
                key={`${frame.originFlowId ?? current.id}::${frame.id}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    FRAME_MIME,
                    JSON.stringify({ flowId: current.id, index: i }),
                  );
                  e.dataTransfer.effectAllowed = 'move';
                  setDragKind('frame');
                }}
                onDragEnd={() => setDragKind(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onFrameDrop(e, i);
                  setDragKind(null);
                }}
                className="group flex cursor-grab flex-col gap-2.5 active:cursor-grabbing"
              >
                {/* Same card treatment as the browse grid: the screen sits in
                    its real device frame, so arranging screens looks like the
                    gallery you are arranging rather than a separate tool. */}
                <div
                  className="relative overflow-hidden rounded-xl bg-[oklch(0.96_0.004_260)] transition-shadow duration-150 group-hover:shadow-[0_8px_24px_-12px_rgba(15,20,33,0.25)] dark:bg-[oklch(0.19_0.007_260)]"
                  style={{ aspectRatio: isMobile ? '3 / 4' : '16 / 10' }}
                >
                  {isMobile ? (
                    <div className="flex h-full items-center justify-center">
                      <DeviceBezel
                        src={imageHref(frame.image)}
                        alt={frame.name}
                        style={{ height: '82%' }}
                      />
                    </div>
                  ) : (
                    <WebCardThumb src={imageHref(frame.image)} alt={frame.name} inset />
                  )}

                  {/* Controls ride on the card and only on hover. Permanent
                      arrows and a bare select under every screen turned the
                      grid into a form. */}
                  <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                    <div className="pointer-events-auto flex items-center rounded-lg bg-black/70 text-white backdrop-blur-sm">
                      <button
                        type="button"
                        aria-label={`Move ${frame.name} earlier`}
                        disabled={i === 0}
                        className="px-2 py-1.5 text-xs disabled:opacity-25"
                        onClick={() => nudgeFrame(i, -1)}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${frame.name} later`}
                        disabled={i === current.frames.length - 1}
                        className="px-2 py-1.5 text-xs disabled:opacity-25"
                        onClick={() => nudgeFrame(i, 1)}
                      >
                        →
                      </button>
                    </div>
                    <select
                      aria-label={`Move ${frame.name} to another flow`}
                      title="Move to another flow"
                      className="pointer-events-auto min-w-0 flex-1 truncate rounded-lg border-0 bg-black/70 px-2 py-1.5 text-[11px] text-white backdrop-blur-sm"
                      value=""
                      onChange={(e) => {
                        moveFrameTo(i, e.target.value);
                        e.currentTarget.value = '';
                      }}
                    >
                      <option value="">Move to…</option>
                      {flows
                        .filter((f) => f.id !== current.id)
                        .map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`Delete ${frame.name}`}
                      className="pointer-events-auto rounded-lg bg-black/70 p-1.5 text-white backdrop-blur-sm hover:bg-red-600/90"
                      onClick={() =>
                        run(() =>
                          setFrameHidden(appSlug, keyOf(current.id, frame).flowId, frame.id, true),
                        )
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="truncate pl-0.5 text-left text-sm font-medium text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]"
                  title="Double-click to rename"
                  onDoubleClick={() => {
                    const name = window.prompt('Screen name', frame.name);
                    if (name) {
                      const k = keyOf(current.id, frame);
                      run(() => renameFrame(appSlug, k.flowId, k.frameId, name));
                    }
                  }}
                >
                  {frame.name}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
