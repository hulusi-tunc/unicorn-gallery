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
  /**
   * Pixel ratio the browser renders at. 2 gives retina screenshots at the same
   * CSS layout — worth it for phone viewports, where a 1x PNG is too small to
   * read in the gallery grid.
   */
  deviceScaleFactor?: number;
  /**
   * Screenshot the whole scrollable document (default) or just the viewport.
   * Set false for a fixed-viewport app — a full-page shot there chases any
   * background image sized past the viewport and returns a frame wider and
   * taller than the device it is meant to show.
   */
  fullPage?: boolean;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  navigationTimeoutMs?: number;
  /** Skip the route walker entirely (e.g. for mobile-only projects). */
  skipRouteWalker?: boolean;
}

export interface SnapOptions {
  /**
   * Override the run's `fullPage` for this one frame. A landing page wants
   * viewport-sized frames for its sections and one whole-page frame beside
   * them, which is a per-frame decision rather than a per-run one.
   */
  fullPage?: boolean;
  /**
   * Pixel scale for this frame. `device` (the default) honours the run's
   * `deviceScaleFactor`; `css` captures one image pixel per CSS pixel however
   * the run is configured.
   *
   * A whole-page frame is the reason this exists: a landing page shot at 2x is
   * several thousand pixels tall and tens of megabytes, too large to upload in
   * one request and too large for any grid to render usefully, while the
   * viewport-sized frames beside it still want the retina detail.
   */
  scale?: 'css' | 'device';
}

export interface FlowSnapContext {
  page: Page;
  snap: (id: string, name?: string, options?: SnapOptions) => Promise<void>;
}

export type FlowRunFn = (ctx: FlowSnapContext) => Promise<void>;

export interface PlaywrightFlowDefinition {
  __kind: 'playwright-flow';
  id: string;
  name: string;
  /** Render nested under this flow id. See defineFlow's FlowMeta. */
  parentFlowId?: string;
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
  /**
   * Display order. Stamped by the uploader from the manifest's own order, so a
   * push split across several requests still lands in the order captured.
   */
  position?: number;
  /** Capture's auto-route hint (the route that auto-creates this flow). Optional metadata. */
  autoRoute?: string;
  frames: ManifestFrame[];
}

export interface ManifestFrame {
  id: string;
  name: string;
  image: string;
  /** Display order within the flow. See ManifestFlow.position. */
  position?: number;
  /** Optional short motion clip (mp4/webm) proving animations/interactions. */
  video?: string;
}
