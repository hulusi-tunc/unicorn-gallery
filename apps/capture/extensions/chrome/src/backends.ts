// Where a snap goes.
//
// Two backends behind one interface:
//
//   desktop — the Capture app on localhost:9876. It owns a local session,
//             decides placement, and pushes to the gallery when the designer
//             says so. This is the original path and still the richer one.
//   gallery — straight to the gallery's intake API with the signed-in user's
//             token. No desktop app required, which is the point: a designer
//             or PM can install the extension alone and start filing screens.
//
// The panel picks at load: a gallery session wins, otherwise the desktop if it
// answers, otherwise neither and the panel asks the user to sign in.

import { getAccessToken, getGalleryUrl } from "./session";

export const DESKTOP_BASE = "http://localhost:9876";

export type Project = { slug: string; name: string; baseUrl?: string };
export type FlowOption = { id: string; name: string; parentFlowId?: string };

export type Placement = { flowName: string; kind: "auto-new" | "existing" };
export type PushResult =
	| { ok: true; record: { route: string }; placement: Placement }
	| { ok: false; error: string };

export interface SnapInput {
	projectId: string;
	url: string;
	title?: string;
	fullPage: boolean;
	flowId?: string;
	pngBytes: Uint8Array;
}

export interface VideoInput {
	projectId: string;
	url: string;
	videoBytes: Uint8Array;
	mimeType: string;
}

export interface Backend {
	/** Shown in the panel so it is never a mystery where snaps are going. */
	readonly label: string;
	readonly canCreateProjects: boolean;
	listProjects(): Promise<Project[]>;
	listFlows(projectId: string): Promise<FlowOption[]>;
	pushSnap(input: SnapInput): Promise<PushResult>;
	pushVideo(input: VideoInput): Promise<PushResult>;
	createProject?(name: string): Promise<Project>;
}

/* ── desktop ─────────────────────────────────────────────────────────────── */

export const desktopBackend: Backend = {
	label: "Capture desktop",
	canCreateProjects: false,

	async listProjects() {
		const res = await fetch(`${DESKTOP_BASE}/web-ext/projects`);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const body = (await res.json()) as
			| { ok: true; projects: Project[] }
			| { ok: false; error: string };
		if (!body.ok) throw new Error(body.error);
		return body.projects;
	},

	async listFlows(projectId) {
		const res = await fetch(
			`${DESKTOP_BASE}/web-ext/flows?projectId=${encodeURIComponent(projectId)}`,
		);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const body = (await res.json()) as
			| { ok: true; flows: FlowOption[] }
			| { ok: false; error: string };
		if (!body.ok) throw new Error(body.error);
		return body.flows;
	},

	async pushSnap(input) {
		const params = new URLSearchParams({
			projectId: input.projectId,
			url: input.url,
			fullPage: input.fullPage ? "1" : "0",
		});
		if (input.title) params.set("title", input.title);
		if (input.flowId) params.set("flowId", input.flowId);
		const res = await fetch(`${DESKTOP_BASE}/web-ext/snap?${params}`, {
			method: "POST",
			headers: { "content-type": "image/png" },
			body: input.pngBytes as BodyInit,
		});
		return (await res.json()) as PushResult;
	},

	async pushVideo(input) {
		const params = new URLSearchParams({
			projectId: input.projectId,
			url: input.url,
		});
		const res = await fetch(`${DESKTOP_BASE}/web-ext/video?${params}`, {
			method: "POST",
			headers: { "content-type": input.mimeType },
			body: input.videoBytes as BodyInit,
		});
		return (await res.json()) as PushResult;
	},
};

/** True when the desktop app is up. Used to pick a backend, so it must be quick. */
export async function desktopIsRunning(): Promise<boolean> {
	try {
		const ctl = new AbortController();
		const timer = setTimeout(() => ctl.abort(), 1200);
		const res = await fetch(`${DESKTOP_BASE}/web-ext/projects`, {
			signal: ctl.signal,
		});
		clearTimeout(timer);
		return res.ok;
	} catch {
		return false;
	}
}

/* ── gallery ─────────────────────────────────────────────────────────────── */

/** The shape `/api/projects/mine` returns — camelCase, not the column names. */
type ProjectWithToken = Project & {
	platform: string;
	projectToken: string | null;
};

/**
 * Upload tokens, kept for the life of the panel.
 *
 * `/api/projects/mine` hands back a `pgt_` token per project the user may
 * touch, and the intake endpoint takes that rather than the user's JWT. They
 * are cached here so a snap is one request rather than two.
 */
const tokenCache = new Map<string, string>();

/** Frame counts per flow, so an appended snap sorts after what is already there. */
const positionCache = new Map<
	string,
	{ flows: number; frames: Map<string, number> }
>();

async function authHeaders(): Promise<Record<string, string>> {
	const token = await getAccessToken();
	if (!token) throw new Error("Not signed in to the gallery.");
	return { authorization: `Bearer ${token}` };
}

async function galleryFetch(
	path: string,
	init?: RequestInit,
): Promise<Response> {
	const base = await getGalleryUrl();
	if (!base) throw new Error("No gallery URL set.");
	const headers = { ...(await authHeaders()), ...(init?.headers ?? {}) };
	return fetch(`${base}${path}`, { ...init, headers });
}

export const galleryBackend: Backend = {
	label: "Gallery",
	canCreateProjects: true,

	async listProjects() {
		const res = await galleryFetch("/api/projects/mine");
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const body = (await res.json()) as { projects?: ProjectWithToken[] };
		const projects = (body.projects ?? []).filter((p) => p.platform === "web");
		tokenCache.clear();
		for (const p of projects) {
			if (p.projectToken) tokenCache.set(p.slug, p.projectToken);
		}
		return projects.map((p) => ({ slug: p.slug, name: p.name }));
	},

	async listFlows(projectId) {
		const manifest = await readManifest(projectId);
		positionCache.set(projectId, {
			flows: manifest.flows.length,
			frames: new Map(
				manifest.flows.map((f) => [
					f.id,
					manifest.frames.filter((fr) => fr.flow_id === f.id).length,
				]),
			),
		});
		return manifest.flows.map((f) => ({
			id: f.id,
			name: f.name,
			parentFlowId: f.parentFlowId,
		}));
	},

	async pushSnap(input) {
		try {
			const flow = resolveFlow(input);
			const frame = frameFromUrl(input.url, input.title, input.fullPage);
			const image = `screenshots/${flow.id}/${frame.id}.png`;
			const counts = positionCache.get(input.projectId);

			const manifest = {
				projectId: input.projectId,
				buildSha: buildShaForToday(),
				capturedAt: new Date().toISOString(),
				platform: "web",
				flows: [
					{
						id: flow.id,
						name: flow.name,
						position: counts?.frames.has(flow.id)
							? undefined
							: (counts?.flows ?? 0),
						frames: [
							{
								id: frame.id,
								name: frame.name,
								image,
								position: counts?.frames.get(flow.id) ?? 0,
							},
						],
					},
				],
			};

			const form = new FormData();
			form.append(
				"manifest",
				new Blob([JSON.stringify(manifest)], { type: "application/json" }),
			);
			form.append(
				image,
				new Blob([input.pngBytes as BlobPart], { type: "image/png" }),
				`${frame.id}.png`,
			);

			const res = await uploadToIntake(input.projectId, form);
			if (!res.ok) return res;

			bumpCounts(input.projectId, flow.id);
			return {
				ok: true,
				record: { route: frame.name },
				placement: {
					flowName: flow.name,
					kind: flow.isNew ? "auto-new" : "existing",
				},
			};
		} catch (err) {
			return { ok: false, error: (err as Error).message };
		}
	},

	async pushVideo() {
		// The intake takes a clip as a second part beside the frame it belongs
		// to, so a clip with no snap has nothing to attach to. The panel always
		// snaps a cover frame first, and that push is what carries the clip.
		return {
			ok: false,
			error:
				"Clips need the Capture desktop app — the gallery attaches a clip to a frame, not on its own.",
		};
	},

	async createProject(name) {
		const slug = slugify(name);
		if (!slug) throw new Error("That name has no letters or digits to slug.");
		const res = await galleryFetch("/api/projects", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ slug, name: name.trim(), platform: "web" }),
		});
		const body = (await res.json()) as {
			slug?: string;
			name?: string;
			projectToken?: string;
			error?: string;
		};
		if (!res.ok || !body.slug) {
			throw new Error(
				body.error ?? `Could not create project (HTTP ${res.status})`,
			);
		}
		if (body.projectToken) tokenCache.set(body.slug, body.projectToken);
		return { slug: body.slug, name: body.name ?? name };
	},
};

interface ManifestShape {
	flows: { id: string; name: string; parentFlowId?: string }[];
	frames: { id: string; flow_id: string }[];
}

async function readManifest(projectId: string): Promise<ManifestShape> {
	const base = await getGalleryUrl();
	const token = await projectToken(projectId);
	const res = await fetch(`${base}/api/captures/manifest`, {
		headers: { authorization: `Bearer ${token}` },
	});
	// A project with no pushes yet has no manifest; that is a new project, not
	// a failure, so it reads as an empty tree rather than an error.
	if (!res.ok) return { flows: [], frames: [] };
	const body = (await res.json()) as Partial<ManifestShape>;
	return { flows: body.flows ?? [], frames: body.frames ?? [] };
}

async function projectToken(projectId: string): Promise<string> {
	const cached = tokenCache.get(projectId);
	if (cached) return cached;
	await galleryBackend.listProjects();
	const token = tokenCache.get(projectId);
	if (!token) throw new Error(`No upload token for "${projectId}".`);
	return token;
}

async function uploadToIntake(
	projectId: string,
	form: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const base = await getGalleryUrl();
	const token = await projectToken(projectId);
	const res = await fetch(`${base}/api/captures/upload`, {
		method: "POST",
		headers: { authorization: `Bearer ${token}` },
		body: form,
	});
	if (res.ok) return { ok: true };
	const text = await res.text().catch(() => "");
	return {
		ok: false,
		error: `Upload failed: HTTP ${res.status} ${text.slice(0, 160)}`,
	};
}

function bumpCounts(projectId: string, flowId: string): void {
	const counts = positionCache.get(projectId);
	if (!counts) return;
	const seen = counts.frames.get(flowId);
	if (seen === undefined) {
		counts.frames.set(flowId, 1);
		counts.flows += 1;
	} else {
		counts.frames.set(flowId, seen + 1);
	}
}

/**
 * One build per day of capturing.
 *
 * A build is the gallery's unit of version, and a version per individual snap
 * would bury the switcher. A day is the span a designer actually thinks in
 * ("what did we capture on Tuesday"), and snaps within it accumulate.
 */
function buildShaForToday(): string {
	return `ext-${new Date().toISOString().slice(0, 10)}`;
}

/** The flow a snap belongs to: the one picked, or one derived from the URL. */
function resolveFlow(input: SnapInput): {
	id: string;
	name: string;
	isNew: boolean;
} {
	if (input.flowId) {
		const counts = positionCache.get(input.projectId);
		return {
			id: input.flowId,
			name: input.flowId,
			isNew: !counts?.frames.has(input.flowId),
		};
	}
	const seg = firstSegment(input.url);
	const id = seg || "home";
	const counts = positionCache.get(input.projectId);
	return { id, name: humanize(id), isNew: !counts?.frames.has(id) };
}

function firstSegment(rawUrl: string): string {
	try {
		const path = new URL(rawUrl).pathname.split("/").filter(Boolean);
		return path[0] ? slugify(path[0]) : "";
	} catch {
		return "";
	}
}

/** A stable frame id per URL, so re-snapping a page replaces it rather than piling up. */
function frameFromUrl(
	rawUrl: string,
	title: string | undefined,
	fullPage: boolean,
): { id: string; name: string } {
	let path = "";
	try {
		path = new URL(rawUrl).pathname;
	} catch {
		path = "";
	}
	const segs = path.split("/").filter(Boolean).map(slugify).filter(Boolean);
	const base = segs.length > 0 ? segs.join("-") : "index";
	const suffix = fullPage ? "" : "-viewport";
	return {
		id: `${base}${suffix}`.slice(0, 80),
		name: title?.trim() || humanize(base),
	};
}

function slugify(s: string): string {
	return s
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
}

function humanize(id: string): string {
	const words = id.split("-").filter(Boolean);
	if (words.length === 0) return "Home";
	return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** Whichever backend this panel should use, or null when neither is available. */
export async function pickBackend(): Promise<Backend | null> {
	const token = await getAccessToken();
	if (token && (await getGalleryUrl())) return galleryBackend;
	if (await desktopIsRunning()) return desktopBackend;
	return null;
}
