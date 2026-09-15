import type { FlowRunFn, PlaywrightFlowDefinition } from '../types.js';

export interface FlowMeta {
  /**
   * Render this flow nested under another flow's id. The parent must also be
   * defined somewhere in the run — a flow with no frames of its own is kept
   * precisely so it can act as a container for its children.
   */
  parentFlowId?: string;
}

export function defineFlow(id: string, name: string, run: FlowRunFn): PlaywrightFlowDefinition;
export function defineFlow(
  id: string,
  name: string,
  meta: FlowMeta,
  run: FlowRunFn,
): PlaywrightFlowDefinition;
export function defineFlow(
  id: string,
  name: string,
  metaOrRun: FlowMeta | FlowRunFn,
  maybeRun?: FlowRunFn,
): PlaywrightFlowDefinition {
  const meta = typeof metaOrRun === 'function' ? {} : metaOrRun;
  const run = typeof metaOrRun === 'function' ? metaOrRun : maybeRun;
  if (!run) {
    throw new Error(`defineFlow("${id}") was given no run function.`);
  }
  return {
    __kind: 'playwright-flow',
    id,
    name,
    ...(meta.parentFlowId ? { parentFlowId: meta.parentFlowId } : {}),
    run,
  };
}

/**
 * A flow file that owns a whole section exports its container and that
 * section's sub-flows together, in the order they should appear.
 */
export function defineFlows(
  ...flows: PlaywrightFlowDefinition[]
): PlaywrightFlowDefinition[] {
  return flows;
}
