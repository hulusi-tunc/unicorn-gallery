import type { FlowRunFn, PlaywrightFlowDefinition } from '../types.js';

export function defineFlow(
  id: string,
  name: string,
  run: FlowRunFn,
): PlaywrightFlowDefinition {
  return { __kind: 'playwright-flow', id, name, run };
}
