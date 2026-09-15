// Gallery sign-in for the standalone extension.
//
// The extension is configured with a gallery URL and nothing else. It asks the
// gallery which Supabase project to authenticate against (`/api/ext/config`),
// then posts the password straight to Supabase — no credential passes through
// the gallery app itself. What comes back is the same user access token the
// desktop app sends, so every existing gallery endpoint accepts it unchanged.

const URL_KEY = "uc.gallery.url";
const SESSION_KEY = "uc.gallery.session";

export interface StoredSession {
	accessToken: string;
	refreshToken: string;
	/** Epoch ms. Refreshed a minute early so a long upload cannot expire mid-flight. */
	expiresAt: number;
	email: string;
}

interface SupabaseConfig {
	supabaseUrl: string;
	supabaseAnonKey: string;
}

const REFRESH_MARGIN_MS = 60_000;

export async function getGalleryUrl(): Promise<string> {
	const stored = await chrome.storage.local.get(URL_KEY);
	return (stored[URL_KEY] as string | undefined) ?? "";
}

export async function setGalleryUrl(url: string): Promise<void> {
	await chrome.storage.local.set({ [URL_KEY]: trimSlash(url) });
}

export async function readSession(): Promise<StoredSession | null> {
	const stored = await chrome.storage.local.get(SESSION_KEY);
	return (stored[SESSION_KEY] as StoredSession | undefined) ?? null;
}

async function writeSession(s: StoredSession | null): Promise<void> {
	if (s) await chrome.storage.local.set({ [SESSION_KEY]: s });
	else await chrome.storage.local.remove(SESSION_KEY);
}

export function trimSlash(url: string): string {
	return url.trim().replace(/\/+$/, "");
}

async function fetchConfig(galleryUrl: string): Promise<SupabaseConfig> {
	const res = await fetch(`${galleryUrl}/api/ext/config`);
	if (!res.ok) throw new Error(`Gallery config: HTTP ${res.status}`);
	const body = (await res.json()) as
		| ({ ok: true } & SupabaseConfig)
		| { ok: false; error: string };
	if (!body.ok) throw new Error(body.error);
	return {
		supabaseUrl: body.supabaseUrl,
		supabaseAnonKey: body.supabaseAnonKey,
	};
}

interface TokenResponse {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	user?: { email?: string };
	error_description?: string;
	msg?: string;
}

async function tokenRequest(
	cfg: SupabaseConfig,
	grant: "password" | "refresh_token",
	body: Record<string, string>,
): Promise<StoredSession> {
	const res = await fetch(
		`${cfg.supabaseUrl}/auth/v1/token?grant_type=${grant}`,
		{
			method: "POST",
			headers: {
				"content-type": "application/json",
				apikey: cfg.supabaseAnonKey,
				authorization: `Bearer ${cfg.supabaseAnonKey}`,
			},
			body: JSON.stringify(body),
		},
	);
	const json = (await res.json()) as TokenResponse;
	if (!res.ok || !json.access_token) {
		throw new Error(
			json.error_description ??
				json.msg ??
				`Sign-in failed (HTTP ${res.status})`,
		);
	}
	return {
		accessToken: json.access_token,
		refreshToken: json.refresh_token,
		expiresAt: Date.now() + json.expires_in * 1000,
		email: json.user?.email ?? body.email ?? "",
	};
}

export async function signIn(
	galleryUrl: string,
	email: string,
	password: string,
): Promise<StoredSession> {
	const url = trimSlash(galleryUrl);
	const cfg = await fetchConfig(url);
	const session = await tokenRequest(cfg, "password", { email, password });
	await setGalleryUrl(url);
	await writeSession(session);
	return session;
}

export async function signOut(): Promise<void> {
	await writeSession(null);
}

/**
 * The access token to send, refreshed if it is close to expiry.
 *
 * Returns null when there is no usable session — callers treat that as
 * "not signed in" rather than an error, because it is the normal first-run
 * state and the panel has a sign-in view for it.
 */
export async function getAccessToken(): Promise<string | null> {
	const session = await readSession();
	if (!session) return null;
	if (Date.now() < session.expiresAt - REFRESH_MARGIN_MS)
		return session.accessToken;

	const galleryUrl = await getGalleryUrl();
	if (!galleryUrl) return null;
	try {
		const cfg = await fetchConfig(galleryUrl);
		const next = await tokenRequest(cfg, "refresh_token", {
			refresh_token: session.refreshToken,
		});
		// Supabase omits the email on a refresh; keep the one we signed in with.
		next.email = next.email || session.email;
		await writeSession(next);
		return next.accessToken;
	} catch {
		// A refresh token can be revoked or simply too old. Drop the session so
		// the panel falls back to the sign-in view instead of looping on 401s.
		await writeSession(null);
		return null;
	}
}
