import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import {
  PDFDocument,
  StandardFonts,
  appendBezierCurve,
  clip,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import type { Platform } from '@/lib/db';
import { chooseBezel, type BezelSpec } from '@/lib/bezel-specs';
import {
  getAppBySlug,
  getBuildByVersion,
  getCurrentProfile,
  getManifestForApp,
} from '@/lib/queries';

export const runtime = 'nodejs';

/**
 * Download every screen in a project as a single PDF.
 *
 * Auth: agency-only (PMs + designers). Customers are blocked at the API
 * layer too, not just the header button.
 *
 * Versioning: `?v=N` exports that build's snapshot; no param exports the
 * latest visible build. Matches the same URL contract as the gallery
 * pages themselves so "download what I'm looking at" works.
 *
 * Layout: each flow gets its own section starting on a fresh page; ios/
 * android screens render inside the same aspect-matched device bezel the
 * gallery uses (iPhone or iPad, chosen per screenshot from lib/bezel-specs);
 * web screens get a plain bordered card.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await ctx.params;

  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  if (profile.role !== 'agency') {
    return NextResponse.json(
      { error: 'Only PMs and designers can download project PDFs.' },
      { status: 403 },
    );
  }

  const app = await getAppBySlug(decodeURIComponent(slug));
  if (!app) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  const vParam = request.nextUrl.searchParams.get('v');
  const versionNumber = vParam ? Number(vParam) : null;
  if (vParam && (!Number.isFinite(versionNumber) || versionNumber! < 1)) {
    return NextResponse.json({ error: 'Invalid version.' }, { status: 400 });
  }

  let buildId: string | undefined;
  let resolvedVersion: number | null = null;
  if (versionNumber != null) {
    const build = await getBuildByVersion(app.id, versionNumber);
    if (!build) {
      return NextResponse.json({ error: `Version v${versionNumber} not found.` }, { status: 404 });
    }
    buildId = build.id;
    resolvedVersion = build.version;
  }

  const manifest = await getManifestForApp(app.id, buildId);

  // Group frames by flow, preserving the manifest's flow + frame ordering.
  // Empty flows are dropped so we never spend a page on a "Flow X · 0 screens"
  // header with nothing under it.
  const flowGroups: FlowGroup[] = manifest
    ? manifest.flows
        .map((flow) => ({
          id: flow.id,
          name: flow.name,
          parentFlowId: flow.parentFlowId,
          frames: flow.frames.map((frame) => ({
            name: frame.name,
            imageUrl: frame.image,
          })),
        }))
        .filter((g) => g.frames.length > 0)
    : [];

  // Single flat fetch keeps concurrency bounded across the whole job, rather
  // than re-doing it per flow.
  const allUrls = flowGroups.flatMap((g) => g.frames.map((f) => f.imageUrl));
  const allImages = await fetchImagesBounded(allUrls, 8);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`${app.name} — Screens`);
  pdf.setCreator('Unicorn Studio Gallery');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  const platform = app.platform;

  const versionLabel = resolvedVersion != null ? `v${resolvedVersion}` : 'Latest';

  if (flowGroups.length === 0) {
    drawEmptyState(pdf, font, boldFont, app.name, versionLabel);
  } else {
    await drawFlows(pdf, font, boldFont, app.name, versionLabel, platform, flowGroups, allImages);
  }

  const bytes = await pdf.save();
  const buffer = Buffer.from(bytes);

  const filename = `${app.slug}-${resolvedVersion != null ? `v${resolvedVersion}` : 'latest'}.pdf`;

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, no-store',
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Image fetching
// ─────────────────────────────────────────────────────────────────────────────

type FetchedImage =
  | { kind: 'png'; bytes: Uint8Array }
  | { kind: 'jpg'; bytes: Uint8Array }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'missing' };

async function fetchImagesBounded(urls: string[], limit: number): Promise<FetchedImage[]> {
  const out = new Array<FetchedImage>(urls.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, urls.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= urls.length) return;
      out[i] = await fetchImage(urls[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

async function fetchImage(url: string): Promise<FetchedImage> {
  if (!url) return { kind: 'missing' };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return { kind: 'unsupported', reason: `HTTP ${res.status}` };
    const buf = new Uint8Array(await res.arrayBuffer());
    const format = detectImageFormat(buf);
    if (format === 'png' || format === 'jpg') return { kind: format, bytes: buf };
    return { kind: 'unsupported', reason: format };
  } catch (err) {
    return { kind: 'unsupported', reason: (err as Error).message };
  }
}

function detectImageFormat(b: Uint8Array): 'png' | 'jpg' | 'unknown' {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  return 'unknown';
}

/**
 * Lazily embed the frame PNG for a bezel spec, cached per asset so an
 * all-iPhone project embeds one frame image, not one per screenshot.
 * Returns null when the asset is missing or unreadable — the cell falls
 * back to a borderless card rather than failing the whole download.
 */
function makeBezelLoader(pdf: PDFDocument): (spec: BezelSpec) => Promise<PDFImage | null> {
  const cache = new Map<string, Promise<PDFImage | null>>();
  return (spec) => {
    let entry = cache.get(spec.light);
    if (!entry) {
      entry = readFile(path.join(process.cwd(), 'public', spec.light))
        .then((bytes) => pdf.embedPng(bytes))
        .catch(() => null);
      cache.set(spec.light, entry);
    }
    return entry;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF layout
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_W = 595.28; // A4 portrait
const PAGE_H = 841.89;
const MARGIN = 36;
const HEADER_H = 22;
const HEADER_GAP = 14;
const FLOW_BAND_H = 30;
const FLOW_BAND_GAP = 14;
const CELL_GUTTER = 18;
const CAPTION_H = 18;
const CAPTION_GAP = 6;
const TEXT_DARK = rgb(0.08, 0.08, 0.09);
const TEXT_MUTED = rgb(0.42, 0.42, 0.45);
const SURFACE = rgb(0.96, 0.96, 0.97);
const BORDER = rgb(0.86, 0.86, 0.88);
const SCREEN_BG = rgb(0, 0, 0);

interface FrameEntry {
  name: string;
  imageUrl: string;
}

interface FlowGroup {
  id: string;
  name: string;
  parentFlowId?: string;
  frames: FrameEntry[];
}

interface GridSpec {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  gridTop: number;
  perPage: number;
}

function computeGrid(platform: Platform, landscapeMobile: boolean): GridSpec {
  // Portrait mobile bezels are tall (aspect 0.49–0.77) — a 3x2 grid leaves
  // room for each bezel to render at a usable size. Landscape captures
  // (iPad in landscape) and web screens are wide and look better in a
  // 2-column grid.
  const wide = platform === 'web' || landscapeMobile;
  const cols = wide ? 2 : 3;
  const rows = wide ? 3 : 2;
  const cellW = (PAGE_W - MARGIN * 2 - CELL_GUTTER * (cols - 1)) / cols;
  const gridTop =
    PAGE_H - MARGIN - HEADER_H - HEADER_GAP - FLOW_BAND_H - FLOW_BAND_GAP;
  const gridAvailH = gridTop - MARGIN;
  const cellH = (gridAvailH - CELL_GUTTER * (rows - 1)) / rows;
  return { cols, rows, cellW, cellH, gridTop, perPage: cols * rows };
}

// Aspect ratio above which we treat a web snap as a full-page capture and
// give it dedicated pages (multi-page if the scroll is very long). Below
// this threshold it stays in the standard grid.
const FULL_PAGE_ASPECT = 1.4;

type SlotItem = { frame: FrameEntry; image: FetchedImage; embedded: PDFImage | null };
type Slot =
  | { kind: 'grid'; items: SlotItem[] }
  | { kind: 'fullpage'; item: SlotItem };

async function drawFlows(
  pdf: PDFDocument,
  font: PDFFont,
  boldFont: PDFFont,
  projectName: string,
  versionLabel: string,
  platform: Platform,
  flows: FlowGroup[],
  images: FetchedImage[],
): Promise<void> {
  // Pre-embed every image so we can (a) size the grid from the dominant
  // orientation — landscape iPad captures need wider cells than portrait
  // phones — and (b) know how many PDF pages each flow will need before
  // drawing the first one, keeping the running "X of Y" counter accurate.
  const flowItems: Array<{ flow: FlowGroup; items: SlotItem[] }> = [];
  let imageOffset = 0;
  for (const flow of flows) {
    const flowImages = images.slice(imageOffset, imageOffset + flow.frames.length);
    imageOffset += flow.frames.length;
    const items: SlotItem[] = [];
    for (let i = 0; i < flow.frames.length; i++) {
      const embedded = await tryEmbed(pdf, flowImages[i]!);
      items.push({ frame: flow.frames[i]!, image: flowImages[i]!, embedded });
    }
    flowItems.push({ flow, items });
  }

  const measured = flowItems
    .flatMap((f) => f.items)
    .filter((it): it is SlotItem & { embedded: PDFImage } => it.embedded != null);
  const landscapeMobile =
    platform !== 'web' &&
    measured.length > 0 &&
    measured.filter((it) => it.embedded.width > it.embedded.height).length * 2 > measured.length;
  const grid = computeGrid(platform, landscapeMobile);
  const bezelFor = makeBezelLoader(pdf);

  const planByFlow: Array<{ flow: FlowGroup; slots: Slot[]; totalPages: number }> = [];
  let totalPages = 0;
  for (const { flow, items } of flowItems) {
    const slots: Slot[] = [];
    let currentGrid: SlotItem[] = [];
    for (const item of items) {
      const { embedded } = item;
      const isFullPage =
        platform === 'web' &&
        embedded != null &&
        embedded.height / embedded.width >= FULL_PAGE_ASPECT;
      if (isFullPage) {
        if (currentGrid.length > 0) {
          slots.push({ kind: 'grid', items: currentGrid });
          currentGrid = [];
        }
        slots.push({ kind: 'fullpage', item });
      } else {
        currentGrid.push(item);
        if (currentGrid.length >= grid.perPage) {
          slots.push({ kind: 'grid', items: currentGrid });
          currentGrid = [];
        }
      }
    }
    if (currentGrid.length > 0) slots.push({ kind: 'grid', items: currentGrid });

    // Count pages for the running total.
    let flowPages = 0;
    for (const slot of slots) {
      if (slot.kind === 'grid') {
        flowPages += 1;
      } else {
        flowPages += countFullPagePages(slot.item.embedded);
      }
    }
    planByFlow.push({ flow, slots, totalPages: flowPages });
    totalPages += flowPages;
  }

  // Pre-build a breadcrumb path for each flow so the band reads
  // "Parent › Child" instead of just the leaf name. Cycles are guarded
  // by depth-cap; missing parents fall back to the local name.
  const flowsById = new Map(flows.map((f) => [f.id, f]));
  const flowPathById = new Map<string, string>();
  for (const f of flows) {
    const chain: string[] = [];
    let cursor: FlowGroup | undefined = f;
    let depth = 0;
    while (cursor && depth < 8) {
      chain.unshift(cursor.name);
      cursor = cursor.parentFlowId ? flowsById.get(cursor.parentFlowId) : undefined;
      depth += 1;
    }
    flowPathById.set(f.id, chain.join(' › '));
  }

  let pageNum = 0;
  for (const planned of planByFlow) {
    const { flow, slots, totalPages: flowPages } = planned;
    const flowPath = flowPathById.get(flow.id) ?? flow.name;
    let pInFlow = 0;
    for (const slot of slots) {
      if (slot.kind === 'grid') {
        pageNum++;
        pInFlow++;
        const page = pdf.addPage([PAGE_W, PAGE_H]);
        drawHeader(page, font, boldFont, projectName, versionLabel, pageNum, totalPages);
        drawFlowBand(page, font, boldFont, flowPath, flow.frames.length, pInFlow - 1, flowPages);
        for (let cell = 0; cell < slot.items.length; cell++) {
          const item = slot.items[cell]!;
          const col = cell % grid.cols;
          const row = Math.floor(cell / grid.cols);
          const x = MARGIN + col * (grid.cellW + CELL_GUTTER);
          const y = grid.gridTop - row * (grid.cellH + CELL_GUTTER) - grid.cellH;
          await drawCell(
            pdf, page, font, boldFont, platform, bezelFor,
            item, x, y, grid.cellW, grid.cellH,
          );
        }
      } else {
        const used = await drawFullPageSnap(
          pdf, font, boldFont, projectName, versionLabel,
          flowPath, flow.frames.length, slot.item,
          pageNum, totalPages, pInFlow, flowPages,
        );
        pageNum += used;
        pInFlow += used;
      }
    }
  }
}

function countFullPagePages(_embedded: PDFImage | null): number {
  // Always one page per snap, even when the snap is a tall full-page
  // capture. User preference: fit-to-page, never paginate a single snap.
  return 1;
}

async function drawFullPageSnap(
  pdf: PDFDocument,
  font: PDFFont,
  boldFont: PDFFont,
  projectName: string,
  versionLabel: string,
  flowName: string,
  flowFrameCount: number,
  item: SlotItem,
  pageNumBase: number,
  totalPages: number,
  pInFlowStart: number,
  flowPages: number,
): Promise<number> {
  const usableW = PAGE_W - MARGIN * 2;
  const usableTop =
    PAGE_H - MARGIN - HEADER_H - HEADER_GAP - FLOW_BAND_H - FLOW_BAND_GAP;
  const usableBottom = MARGIN + CAPTION_H + CAPTION_GAP;
  const usableH = usableTop - usableBottom;

  const page = pdf.addPage([PAGE_W, PAGE_H]);
  drawHeader(page, font, boldFont, projectName, versionLabel, pageNumBase + 1, totalPages);
  drawFlowBand(page, font, boldFont, flowName, flowFrameCount, pInFlowStart, flowPages);

  if (!item.embedded) {
    drawPlaceholderLabel(page, font, placeholderText(item.image), MARGIN, usableBottom, usableW, usableH);
    drawCaption(page, font, boldFont, item.frame.name, MARGIN, MARGIN, usableW);
    return 1;
  }

  // Single-page render. Always fit the WHOLE image inside the usable area —
  // for tall full-page snaps that means the image gets significantly scaled
  // down, but the user explicitly preferred "one snap per page" over multi-
  // page chopping. Keep horizontal-center so a viewport-aspect snap doesn't
  // glue to the left edge.
  const fit = fitContain(item.embedded.width, item.embedded.height, usableW, usableH);
  const imgX = MARGIN + (usableW - fit.w) / 2;
  const imgY = usableBottom + (usableH - fit.h) / 2;
  drawDropShadow(page, imgX, imgY, fit.w, fit.h);
  page.drawImage(item.embedded, { x: imgX, y: imgY, width: fit.w, height: fit.h });

  drawCaption(page, font, boldFont, item.frame.name, MARGIN, MARGIN, usableW);

  return 1;
}

const SHADOW_LAYERS: Array<{ off: number; alpha: number }> = [
  { off: 1, alpha: 0.18 },
  { off: 3, alpha: 0.10 },
  { off: 6, alpha: 0.06 },
];

/**
 * Soft drop shadow under a screenshot — pdf-lib doesn't have CSS-style
 * filters, so we stack three slightly-offset gray rectangles with
 * decreasing alpha. Cheap, looks decent in any PDF reader.
 */
function drawDropShadow(page: PDFPage, x: number, y: number, w: number, h: number): void {
  for (const layer of SHADOW_LAYERS) {
    page.drawRectangle({
      x: x + layer.off * 0.4,
      y: y - layer.off,
      width: w,
      height: h,
      color: rgb(0, 0, 0),
      opacity: layer.alpha,
    });
  }
}

async function drawCell(
  pdf: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  platform: Platform,
  bezelFor: (spec: BezelSpec) => Promise<PDFImage | null>,
  item: SlotItem,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<void> {
  const imageH = h - CAPTION_H - CAPTION_GAP;
  const imageY = y + CAPTION_H + CAPTION_GAP;

  // Pick the frame whose screen aspect best matches this screenshot — same
  // selection the gallery's DeviceBezel makes on screen. Unmeasurable images
  // fall back to the iPhone frame.
  const spec = chooseBezel(
    item.embedded ? item.embedded.width / item.embedded.height : null,
  );
  const bezel = platform === 'web' ? null : await bezelFor(spec);

  if (platform === 'web' || !bezel) {
    await drawWebCard(pdf, page, font, item.image, x, imageY, w, imageH, item.embedded);
  } else {
    drawBezeledCell(page, font, spec, bezel, item, x, imageY, w, imageH);
  }

  drawCaption(page, font, boldFont, item.frame.name, x, y, w);
}

/**
 * Web platform: a bordered, slightly-rounded card with the screenshot
 * letterboxed inside on a black background — same visual language as
 * DeviceFrame's web branch in the gallery.
 */
async function drawWebCard(
  pdf: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  image: FetchedImage,
  x: number,
  y: number,
  w: number,
  h: number,
  preembedded?: PDFImage | null,
): Promise<void> {
  const embedded = preembedded ?? (await tryEmbed(pdf, image));
  if (embedded) {
    // Width-fit and top-align so a viewport snap (1440x900 ≈ 1.6) fills the
    // cell cleanly without center-letterboxing top/bottom. If the image is
    // taller than the cell, clip the bottom rather than shrink it height-
    // first — the user can see the rest in the lightbox / full-page page.
    const scaleByWidth = w / embedded.width;
    const drawnW = w;
    const drawnH = embedded.height * scaleByWidth;
    const visibleH = Math.min(drawnH, h);
    drawDropShadow(page, x, y + h - visibleH, drawnW, visibleH);
    page.pushOperators(pushGraphicsState(), rectangle(x, y, w, h), clip(), endPath());
    page.drawImage(embedded, {
      x,
      y: y + h - drawnH,
      width: drawnW,
      height: drawnH,
    });
    page.pushOperators(popGraphicsState());
  } else {
    page.drawRectangle({ x, y, width: w, height: h, color: SCREEN_BG });
    drawPlaceholderLabel(page, font, placeholderText(image), x, y, w, h);
  }
}

/**
 * Mobile platforms: render the screenshot inside the aspect-matched device
 * frame PNG (iPhone or iPad). The bezel asset is opaque chrome around a
 * transparent rounded screen cutout; we draw the screen content first
 * (clipped to the same rounded rect the bezel exposes) then stamp the bezel
 * on top.
 */
function drawBezeledCell(
  page: PDFPage,
  font: PDFFont,
  spec: BezelSpec,
  bezel: PDFImage,
  item: SlotItem,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  // Fit a bezel-aspect box inside the cell.
  const cellRatio = w / h;
  let bezelW: number;
  let bezelH: number;
  if (cellRatio > spec.frameAspect) {
    bezelH = h;
    bezelW = h * spec.frameAspect;
  } else {
    bezelW = w;
    bezelH = w / spec.frameAspect;
  }
  const bezelX = x + (w - bezelW) / 2;
  const bezelY = y + (h - bezelH) / 2;

  // Screen viewport — the area inside the bezel where pixels show through.
  // Spec insets are % from the frame's top-left; PDF y runs bottom-up, so
  // the screen's bottom edge sits at (100 - top - height)% of the frame.
  const screenW = bezelW * (spec.width / 100);
  const screenH = bezelH * (spec.height / 100);
  const screenX = bezelX + bezelW * (spec.left / 100);
  const screenY = bezelY + bezelH * ((100 - spec.top - spec.height) / 100);
  const radius = Math.min(screenW * spec.radiusFrac, spec.radiusCapPx ?? Infinity);

  // Clip to the rounded screen rect so the screenshot's square corners
  // don't poke into the bezel's rounded cutout.
  page.pushOperators(pushGraphicsState());
  drawRoundedRectPath(page, screenX, screenY, screenW, screenH, radius);
  page.pushOperators(clip(), endPath());

  // Black background fills any letterbox bars if the screenshot's aspect
  // doesn't match the chosen screen exactly.
  page.drawRectangle({
    x: screenX,
    y: screenY,
    width: screenW,
    height: screenH,
    color: SCREEN_BG,
  });

  const embedded = item.embedded;
  if (embedded) {
    const fit = fitContain(embedded.width, embedded.height, screenW, screenH);
    page.drawImage(embedded, {
      x: screenX + (screenW - fit.w) / 2,
      y: screenY + (screenH - fit.h) / 2,
      width: fit.w,
      height: fit.h,
    });
  }

  page.pushOperators(popGraphicsState());

  // Bezel chrome stamped on top — its transparent screen area lets the
  // clipped screenshot show through with the right rounded outline.
  page.drawImage(bezel, {
    x: bezelX,
    y: bezelY,
    width: bezelW,
    height: bezelH,
  });

  if (!embedded) {
    drawPlaceholderLabel(
      page,
      font,
      placeholderText(item.image),
      screenX,
      screenY,
      screenW,
      screenH,
    );
  }
}

async function tryEmbed(pdf: PDFDocument, image: FetchedImage): Promise<PDFImage | null> {
  if (image.kind !== 'png' && image.kind !== 'jpg') return null;
  try {
    return image.kind === 'png'
      ? await pdf.embedPng(image.bytes)
      : await pdf.embedJpg(image.bytes);
  } catch {
    return null;
  }
}

function placeholderText(image: FetchedImage): string {
  if (image.kind === 'missing') return 'No image';
  if (image.kind === 'unsupported') return `Unsupported: ${image.reason}`;
  return 'Could not embed image';
}

function fitContain(
  srcW: number,
  srcH: number,
  boxW: number,
  boxH: number,
): { w: number; h: number } {
  const srcRatio = srcW / srcH;
  const boxRatio = boxW / boxH;
  if (srcRatio > boxRatio) return { w: boxW, h: boxW / srcRatio };
  return { w: boxH * srcRatio, h: boxH };
}

function drawCaption(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  frameName: string,
  x: number,
  y: number,
  w: number,
): void {
  const size = 9;
  const text = fitText(safe(frameName) || 'Untitled', boldFont, size, w);
  safeDrawText(page, text, {
    x,
    y: y + (CAPTION_H - size) / 2,
    size,
    font: boldFont,
    color: TEXT_DARK,
  });
}

function drawHeader(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  projectName: string,
  versionLabel: string,
  pageNum: number,
  totalPages: number,
): void {
  const y = PAGE_H - MARGIN - 14;
  const titleSize = 11;
  const metaSize = 9;
  const title = fitText(safe(projectName), boldFont, titleSize, PAGE_W - MARGIN * 2 - 140);
  safeDrawText(page, title, { x: MARGIN, y, size: titleSize, font: boldFont, color: TEXT_DARK });

  const meta = `${safe(versionLabel)} · Page ${pageNum} of ${totalPages}`;
  const metaWidth = font.widthOfTextAtSize(meta, metaSize);
  safeDrawText(page, meta, {
    x: PAGE_W - MARGIN - metaWidth,
    y: y + 1,
    size: metaSize,
    font,
    color: TEXT_MUTED,
  });

  page.drawLine({
    start: { x: MARGIN, y: y - 8 },
    end: { x: PAGE_W - MARGIN, y: y - 8 },
    thickness: 0.5,
    color: BORDER,
  });
}

function drawFlowBand(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  flowName: string,
  totalScreens: number,
  pageIdxInFlow: number,
  flowTotalPages: number,
): void {
  const bandY = PAGE_H - MARGIN - HEADER_H - HEADER_GAP - FLOW_BAND_H;
  page.drawRectangle({
    x: MARGIN,
    y: bandY,
    width: PAGE_W - MARGIN * 2,
    height: FLOW_BAND_H,
    color: SURFACE,
    borderColor: BORDER,
    borderWidth: 0.5,
  });

  // Small "Flow" kicker, then flow name on the same row.
  const kickerSize = 8;
  const titleSize = 13;
  const innerPad = 12;
  const baselineY = bandY + (FLOW_BAND_H - titleSize) / 2 + 2;

  const kicker = 'FLOW';
  safeDrawText(page, kicker, {
    x: MARGIN + innerPad,
    y: baselineY + 1,
    size: kickerSize,
    font,
    color: TEXT_MUTED,
  });
  const kickerW = font.widthOfTextAtSize(kicker, kickerSize);

  const titleX = MARGIN + innerPad + kickerW + 10;
  const rightLabel =
    flowTotalPages > 1
      ? `${totalScreens} screens · ${pageIdxInFlow + 1}/${flowTotalPages}`
      : `${totalScreens} screen${totalScreens === 1 ? '' : 's'}`;
  const rightSize = 9;
  const rightW = font.widthOfTextAtSize(rightLabel, rightSize);
  const titleMax = PAGE_W - MARGIN - innerPad - rightW - 14 - titleX;
  const title = fitText(safe(flowName) || 'Untitled flow', boldFont, titleSize, Math.max(0, titleMax));
  safeDrawText(page, title, {
    x: titleX,
    y: baselineY,
    size: titleSize,
    font: boldFont,
    color: TEXT_DARK,
  });

  safeDrawText(page, rightLabel, {
    x: PAGE_W - MARGIN - innerPad - rightW,
    y: baselineY + 2,
    size: rightSize,
    font,
    color: TEXT_MUTED,
  });
}

function drawEmptyState(
  pdf: PDFDocument,
  font: PDFFont,
  boldFont: PDFFont,
  projectName: string,
  versionLabel: string,
): void {
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  drawHeader(page, font, boldFont, projectName, versionLabel, 1, 1);
  const msg = 'No screens captured for this version yet.';
  const size = 11;
  const w = font.widthOfTextAtSize(msg, size);
  safeDrawText(page, msg, {
    x: (PAGE_W - w) / 2,
    y: PAGE_H / 2,
    size,
    font,
    color: TEXT_MUTED,
  });
}

function drawPlaceholderLabel(
  page: PDFPage,
  font: PDFFont,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const size = 9;
  const text = fitText(safe(label), font, size, w - 16);
  const tw = font.widthOfTextAtSize(text, size);
  safeDrawText(page, text, {
    x: x + (w - tw) / 2,
    y: y + h / 2 - size / 2,
    size,
    font,
    color: TEXT_MUTED,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Path helpers
// ─────────────────────────────────────────────────────────────────────────────

const KAPPA = 0.5522847498307936; // 4*(sqrt(2)-1)/3 — quarter-circle approx

function drawRoundedRectPath(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  const c = radius * (1 - KAPPA);
  page.pushOperators(
    moveTo(x + radius, y),
    lineTo(x + w - radius, y),
    appendBezierCurve(x + w - c, y, x + w, y + c, x + w, y + radius),
    lineTo(x + w, y + h - radius),
    appendBezierCurve(x + w, y + h - c, x + w - c, y + h, x + w - radius, y + h),
    lineTo(x + radius, y + h),
    appendBezierCurve(x + c, y + h, x, y + h - c, x, y + h - radius),
    lineTo(x, y + radius),
    appendBezierCurve(x, y + c, x + c, y, x + radius, y),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Text helpers
// ─────────────────────────────────────────────────────────────────────────────

function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (maxWidth <= 0) return '';
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const ellipsis = '...';
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (font.widthOfTextAtSize(text.slice(0, mid) + ellipsis, size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + ellipsis;
}

// WinAnsi (the Helvetica encoding) covers Latin-1 + a few extras but not
// everything. Anything outside it would throw inside drawText; sanitize
// unknown code points to '?' so a single weird name never aborts the PDF.
function safe(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20) {
      out += ' ';
    } else if (code <= 0x7e || (code >= 0xa0 && code <= 0xff)) {
      out += ch;
    } else if (code === 0x2026) {
      out += '...';
    } else {
      out += '?';
    }
  }
  return out;
}

function safeDrawText(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb> },
): void {
  try {
    page.drawText(text, opts);
  } catch {
    page.drawText(text.replace(/[^\x20-\x7e]/g, '?'), opts);
  }
}
