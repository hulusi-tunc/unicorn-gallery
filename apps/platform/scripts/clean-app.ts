// One-shot cleanup: delete every frame (and cascading comments) for one app.
// Useful after a manifest-shape change so the next capture push starts fresh
// instead of intermixing old + new flow_ids.
//
// Usage:
//   pnpm tsx scripts/clean-app.ts <slug>
//
// e.g. `pnpm tsx scripts/clean-app.ts folleli`
import pg from 'pg';
import { loadEnv } from './load-env.js';

loadEnv();

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: tsx scripts/clean-app.ts <slug>');
  process.exit(1);
}

const rawUrl = process.env['POSTGRES_URL_NON_POOLING'] ?? process.env['POSTGRES_URL'];
if (!rawUrl) {
  console.error('POSTGRES_URL_NON_POOLING (or POSTGRES_URL) is required.');
  process.exit(1);
}
const url = rawUrl.replace(/[?&]sslmode=require\b/, '').replace(/([?&])$/, '');
const sslSeparator = url.includes('?') ? '&' : '?';
const finalUrl = `${url}${sslSeparator}sslmode=no-verify`;

const pool = new pg.Pool({
  connectionString: finalUrl,
  ssl: { rejectUnauthorized: false },
});
const client = await pool.connect();
try {
  const appRow = await client.query<{ id: string }>(
    'select id from public.apps where slug = $1 limit 1',
    [slug],
  );
  const app = appRow.rows[0];
  if (!app) {
    console.error(`No app with slug "${slug}"`);
    process.exitCode = 1;
  } else {
    const del = await client.query(
      'delete from public.frames where app_id = $1',
      [app.id],
    );
    const buildsDel = await client.query(
      'delete from public.builds where app_id = $1',
      [app.id],
    );
    console.log(
      `✓ Cleaned ${del.rowCount ?? 0} frame(s) and ${buildsDel.rowCount ?? 0} build(s) for app "${slug}"`,
    );
    console.log('  Now run "Push to web" in capture to repopulate.');
  }
} catch (err) {
  console.error('Cleanup failed:', err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
