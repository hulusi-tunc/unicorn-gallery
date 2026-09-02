// Versions already accepted by the gallery must not be re-sent on the next
// push. Re-shipping the whole history is what inflated single frames past the
// upload size cap once auto-update had re-snapped a slot many times.
//
// Run: bun tests/version-payload-test.ts

import { MAX_SNAP_VERSIONS } from "../src/bun/snap-orchestrator";
import type { SessionRecord, SnapRecord } from "../src/bun/snap-orchestrator";
import { sessionToPlatformManifest } from "../src/bun/upload";

const snap = {
	sessionId: "s1",
	sequence: 0,
	projectId: "proj",
	platform: "web",
	route: "/home",
	navStack: ["home"],
	stateHash: "h0",
	capturedAt: new Date().toISOString(),
	image: "home.png",
	flowId: "f1",
	versions: [
		{ image: "home-v1.png", capturedAt: "2026-01-01T00:00:00Z" },
		{ image: "home-v2.png", capturedAt: "2026-01-02T00:00:00Z", uploaded: true },
		{ image: "home-v3.png", capturedAt: "2026-01-03T00:00:00Z", uploaded: true },
	],
} as unknown as SnapRecord;

const session = {
	sessionId: "s1",
	startedAt: new Date().toISOString(),
	snaps: [snap],
} as unknown as SessionRecord;

const flows = [{ id: "f1", name: "Flow One", projectId: "proj" }] as never;
const manifest = sessionToPlatformManifest(session, flows, [snap]);
const frame = manifest?.flows[0]?.frames[0];

let failed = false;
const check = (label: string, cond: boolean): void => {
	console.log(`${cond ? "✓" : "✗"} ${label}`);
	if (!cond) failed = true;
};

console.log("versions in payload =", JSON.stringify(frame?.versions));
check("only the un-uploaded version is sent", frame?.versions?.length === 1);
check(
	"and it is the right one",
	frame?.versions?.[0]?.image === "home-v1.png",
);

// All-uploaded slot should send no versions block at all.
const allUp = {
	...snap,
	versions: (snap.versions ?? []).map((v) => ({ ...v, uploaded: true })),
} as SnapRecord;
const m2 = sessionToPlatformManifest(
	{ ...session, snaps: [allUp] } as unknown as SessionRecord,
	flows,
	[allUp],
);
check(
	"a fully-pushed history sends nothing",
	m2?.flows[0]?.frames[0]?.versions === undefined,
);

check("retention cap is a sane bound", MAX_SNAP_VERSIONS > 0 && MAX_SNAP_VERSIONS <= 10);
console.log("MAX_SNAP_VERSIONS   =", MAX_SNAP_VERSIONS);

console.log(failed ? "\nFAILED" : "\nPASSED");
process.exit(failed ? 1 : 0);
