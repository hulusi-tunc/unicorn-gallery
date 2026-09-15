// Build the unpacked Chrome extension into dist/.
//
// Two halves land there: the TypeScript in src/ bundled to plain JS, and the
// static shell in static/ (manifest, side-panel HTML + CSS, icons) copied
// across verbatim.
//
// The shell used to live in dist/ directly, which is in .gitignore — so it was
// never committed, and a clean clone could not produce an extension Chrome
// would load at all. Keeping it in static/ is what makes this reproducible.
//
// Run: bun extensions/chrome/build.ts

import { cp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outdir = join(here, "dist");

// A full wipe, now that everything in dist/ is reproducible from source.
await rm(outdir, { recursive: true, force: true });
await cp(join(here, "static"), outdir, { recursive: true });

const result = await Bun.build({
	entrypoints: [join(here, "src/popup.ts"), join(here, "src/background.ts")],
	outdir,
	target: "browser",
	format: "esm",
	minify: false,
	sourcemap: "linked",
	naming: "[name].js",
});

if (!result.success) {
	for (const m of result.logs) console.error(m);
	process.exit(1);
}

console.log(`Built ${result.outputs.length} files + the static shell → ${outdir}`);
for (const o of result.outputs) console.log(`  ${o.path}`);
