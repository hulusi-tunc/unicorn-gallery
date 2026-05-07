import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { loadEnv } from './load-env.js';

loadEnv();

const rawUrl = process.env['POSTGRES_URL_NON_POOLING'] ?? process.env['POSTGRES_URL'];
if (!rawUrl) {
  console.error('POSTGRES_URL_NON_POOLING (or POSTGRES_URL) is required.');
  process.exit(1);
}

// pg-node mishandles `sslmode=require` against Supabase's chain (self-signed-in-chain).
// Use sslmode=no-verify so we still encrypt but skip strict CA validation.
const url = rawUrl.replace(/[?&]sslmode=require\b/, '').replace(/([?&])$/, '');
const sslSeparator = url.includes('?') ? '&' : '?';
const finalUrl = `${url}${sslSeparator}sslmode=no-verify`;

const sqlPath = resolve(process.cwd(), 'db/schema.sql');
const sql = await readFile(sqlPath, 'utf8');

const pool = new pg.Pool({
  connectionString: finalUrl,
  ssl: { rejectUnauthorized: false },
});
const client = await pool.connect();
try {
  console.log('Applying schema from', sqlPath);
  await client.query(sql);
  console.log('✓ Migration applied');
} catch (err) {
  console.error('Migration failed:', err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
