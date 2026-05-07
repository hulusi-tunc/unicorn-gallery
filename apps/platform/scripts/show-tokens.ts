/* List apps + their project tokens. Use these tokens with `gallery-capture --upload`. */
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './load-env.js';

loadEnv();

const admin = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data, error } = await admin
  .from('apps')
  .select('slug, name, platform, project_token')
  .order('created_at', { ascending: false });

if (error) {
  console.error(error.message);
  process.exit(1);
}

if (!data || data.length === 0) {
  console.log('No apps yet. Run `pnpm db:seed` to create the Folleli sample.');
  process.exit(0);
}

console.log('');
for (const app of data) {
  console.log(`  ${app.name} (${app.slug}) · ${app.platform}`);
  console.log(`    token: ${app.project_token}`);
  console.log(
    `    upload: gallery-capture --upload http://localhost:3010/api/captures/upload --project-token ${app.project_token}`,
  );
  console.log('');
}
