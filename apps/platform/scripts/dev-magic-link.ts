/* Dev helper: generate a magic-link URL for an email, bypassing email delivery.
 * Usage: pnpm tsx scripts/dev-magic-link.ts <email>
 * Prints a link you can paste into a browser to sign in directly.
 */
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './load-env.js';

loadEnv();

const email = process.argv[2];
if (!email) {
  console.error('Usage: pnpm tsx scripts/dev-magic-link.ts <email>');
  process.exit(1);
}

const admin = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const redirectTo = process.env['DEV_REDIRECT_TO'] ?? 'http://localhost:3010/auth/callback';

const { data, error } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email,
  options: { redirectTo },
});

if (error) {
  console.error('Failed:', error.message);
  process.exit(1);
}

const link = data.properties?.action_link;
if (!link) {
  console.error('No action_link returned. Response:', data);
  process.exit(1);
}

console.log(`\nMagic link for ${email}:\n`);
console.log(link);
console.log('\nOpen this link in your browser to sign in.\n');
