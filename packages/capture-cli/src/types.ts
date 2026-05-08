import type { Page } from 'playwright';

export interface GalleryConfig {
  projectId: string;
  baseUrl: string;
  appDir?: string;
  auth?: (page: Page) => Promise<void>;
  seed?: () => Promise<void>;
  skip?: string[];
  flows?: string[];
  viewport?: { width: number; height: number };
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  navigationTimeoutMs?: number;
  /** Skip the route walker entirely (e.g. for mobile-only projects). */
  skipRouteWalker?: boolean;
}

export interface FlowSnapContext {
  page: Page;
  snap: (id: string, name?: string) => Promise<void>;
}

export type FlowRunFn = (ctx: FlowSnapContext) => Promise<void>;

export interface PlaywrightFlowDefinition {
  __kind: 'playwright-flow';
  id: string;
  name: string;
  run: FlowRunFn;
}

export type Platform = 'web' | 'ios' | 'android';

export interface Manifest {
  projectId: string;
  buildSha: string;
  capturedAt: string;
  platform: Platform;
  flows: ManifestFlow[];
}

export interface ManifestFlow {
  id: string;
  name: string;
  /** When set, this flow is rendered as a sub-flow nested under `parentFlowId`. */
  parentFlowId?: string;
  /** Capture's auto-route hint (the route that auto-creates this flow). Optional metadata. */
  autoRoute?: string;
  frames: ManifestFrame[];
}

export interface ManifestFrame {
  id: string;
  name: string;
  image: string;
}
