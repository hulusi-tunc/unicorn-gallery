// Regression test: one rejected batch must NOT sink the whole push.
//
// Before the fix, uploadSession returned on the first failing batch, so a
// single oversized screen meant zero screens landed — and because batch 0
// runs with ?replace=true, the project could be left wiped. This spins a
// mock gallery that rejects exactly one frame and asserts the rest land.
//
// Run: bun tests/partial-push-test.ts

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionRecord, SnapRecord } from "../src/bun/snap-orchestrator";
import { uploadSession } from "../src/bun/upload";

const outDir = await mkdtemp(join(tmpdir(), "uc-partial-"));

// 3 small frames + 1 deliberately huge one. SAFE_BATCH_BYTES is 3.5MB, so the
// big frame is packed into a batch of its own — which the mock then rejects.
const SMALL = new Uint8Array(1000).fill(7);
const HUGE = new Uint8Array(4_000_000).fill(9);
const names = ["a.png", "b.png", "big.png", "c.png"];
for (const n of names) {
	await writeFile(join(outDir, n), n === "big.png" ? HUGE : SMALL);
}

const snaps: SnapRecord[] = names.map((n, i) => ({
	sessionId: "s1",
	sequence: i,
	projectId: "proj",
	platform: "web",
	route: `/${n}`,
	navStack: [n.replace(".png", "")],
	stateHash: `h${i}`,
	capturedAt: new Date(Date.now() + i * 1000).toISOString(),
	image: n,
	flowId: "f1",
})) as SnapRecord[];

const session: SessionRecord = {
	sessionId: "s1",
	startedAt: new Date().toISOString(),
	snaps,
} as SessionRecord;

const flows = [{ id: "f1", name: "Flow One", projectId: "proj" }] as never;

let requests = 0;
let rejected = 0;
const server = Bun.serve({
	port: 0,
	async fetch(req) {
		requests++;
		const body = await req.arrayBuffer();
		const text = new TextDecoder().decode(new Uint8Array(body.slice(0, 200_000)));
		// Reject only the batch carrying the oversized frame, the way Vercel
		// rejects an over-limit body.
		if (text.includes("big.png")) {
			rejected++;
			return new Response("Request Entity Too Large", { status: 413 });
		}
		return Response.json({
			ok: true,
			framesCount: 1,
			build: { id: "build-123" },
			app: { slug: "demo" },
			frames: [],
		});
	},
});

const url = `http://localhost:${server.port}/api/captures/upload`;
const result = await uploadSession({
	url,
	token: "pgt_test",
	outDir,
	session,
	flows,
	allSnaps: snaps,
	replace: true,
	log: (m) => console.log(`  ${m}`),
});
server.stop(true);

console.log("\nresult.ok            =", result.ok);
let failed = false;
const check = (label: string, cond: boolean): void => {
	console.log(`${cond ? "✓" : "✗"} ${label}`);
	if (!cond) failed = true;
};

check("push did not abort on the rejected batch", result.ok === true);
check("the bad batch was actually rejected", rejected === 1);
check("more than one batch was attempted", requests > 1);
if (result.ok) {
	console.log("uploadedFrameIds     =", result.uploadedFrameIds.length);
	console.log("failures             =", JSON.stringify(result.failures));
	check("3 good frames landed", result.uploadedFrameIds.length === 3);
	check("1 batch reported as failed", result.failures.length === 1);
	check(
		"failure names the oversized frame's batch",
		result.failures[0]?.frameIds.length === 1,
	);
	check("failure carries the server error", /413/.test(result.failures[0]?.error ?? ""));
}

console.log(failed ? "\nFAILED" : "\nPASSED");
process.exit(failed ? 1 : 0);
